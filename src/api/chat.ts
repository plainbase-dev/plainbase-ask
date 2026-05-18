import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, getAgent, getInstructions, getConfigValue, insertAiLog, logSystemError } from '../db/client.js';
import { buildSystemPrompt } from '../llm/prompt.js';
import { streamChatResponse } from '../llm/stream.js';
import { checkKeywordTrigger } from '../ticket/trigger.js';
import type { Message } from '../db/schema.js';
import type { CoreMessage } from 'ai';

// --- Rate limiting state ---

interface IpBucket {
  tokens: number;
  lastRefill: number;
  conversationCount: number;
}

interface LoginAttempts {
  count: number;
  firstAttempt: number;
}

const ipBuckets = new Map<string, IpBucket>();
const loginAttempts = new Map<string, LoginAttempts>();

export { loginAttempts };

function getRateLimitConfig() {
  return {
    messagesPerSecond: parseFloat(getConfigValue('rate_limit_messages_per_second', '0.2')),
    maxConversationsPerIp: parseInt(getConfigValue('rate_limit_max_conversations_per_ip', '5'), 10),
    maxMessagesPerConv: parseInt(getConfigValue('rate_limit_max_messages_per_conv', '50'), 10),
    memoryWindow: parseInt(getConfigValue('conversation_memory_window', '10'), 10),
  };
}

function checkRateLimit(ip: string): boolean {
  const config = getRateLimitConfig();
  const now = Date.now();
  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: 1, lastRefill: now, conversationCount: 0 };
    ipBuckets.set(ip, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(1, bucket.tokens + elapsed * config.messagesPerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function incrementConversationCount(ip: string): boolean {
  const config = getRateLimitConfig();
  const bucket = ipBuckets.get(ip);
  if (!bucket) return true;
  if (bucket.conversationCount >= config.maxConversationsPerIp) return false;
  bucket.conversationCount += 1;
  return true;
}

// --- Domain validation ---

export function isOriginAllowed(origin: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    return allowedDomains.some(d => {
      const domain = d.toLowerCase().replace(/^www\./, '');
      return originHost === domain || originHost === `www.${domain}`;
    });
  } catch {
    return false;
  }
}

// --- Chat schema ---

const chatSchema = z.object({
  conversationId: z.string().nullable().optional(),
  agentId: z.string().min(1),
  message: z.string().min(1).max(2000),
  language: z.string().max(20).regex(/^[a-zA-Z\- ]*$/).nullable().optional(),
});

// --- Route ---

type ChatEnv = { Variables: { adminPreview: boolean } };
export const chatRouter = new Hono<ChatEnv>();

chatRouter.options('/chat', (c) => {
  const origin = c.req.header('Origin') ?? '';
  const agent = getAgent();
  const allowedDomains = JSON.parse(agent.allowed_domains) as string[];

  if (isOriginAllowed(origin, allowedDomains)) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Vary', 'Origin');
  }
  c.res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  c.res.headers.set('Access-Control-Max-Age', '86400');
  return c.body(null, 204);
});

chatRouter.post(
  '/chat',
  zValidator('json', chatSchema),
  async (c) => {
    const origin = c.req.header('Origin') ?? '';
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim()
      ?? c.req.header('CF-Connecting-IP')
      ?? 'unknown';

    const agent = getAgent();
    const allowedDomains = JSON.parse(agent.allowed_domains) as string[];

    // CORS header
    if (isOriginAllowed(origin, allowedDomains)) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Vary', 'Origin');
    } else if (allowedDomains.length > 0) {
      return c.json({ error: 'Domain not allowed' }, 403);
    }

    if (!c.get('adminPreview') && getConfigValue('widget_active', '0') !== '1') {
      return c.json({ error: 'Widget is disabled' }, 503);
    }

    // Rate limit
    if (!checkRateLimit(ip)) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    const { conversationId, agentId, message, language } = c.req.valid('json');

    // Verify agentId matches the deployed agent
    if (agentId !== agent.id) {
      return c.json({ error: 'Invalid agent' }, 400);
    }

    // Resolve or create conversation
    let convId = conversationId;
    let isNewConversation = false;
    if (convId) {
      // Verify ownership
      const existing = db.prepare(
        'SELECT id FROM conversations WHERE id = ? AND agent_id = ?'
      ).get(convId, agentId);
      if (!existing) {
        convId = undefined; // treat as new
      }
    }

    if (!convId) {
      if (!incrementConversationCount(ip)) {
        return c.json({ error: 'Too many active conversations' }, 429);
      }
      const row = db.prepare(
        'INSERT INTO conversations (agent_id) VALUES (?) RETURNING id'
      ).get(agentId) as { id: string };
      convId = row.id;
      isNewConversation = true;
    }

    // Check per-conversation message cap
    const config = getRateLimitConfig();
    const msgCount = (db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
    ).get(convId) as { count: number }).count;

    if (msgCount >= config.maxMessagesPerConv) {
      return c.json({ error: 'Conversation message limit reached' }, 429);
    }

    // Keyword trigger pre-check (only when ticket feature is enabled)
    const ticketEnabled = getConfigValue('ticket_enabled', '1') !== '0';
    const triggerPhrases = JSON.parse(agent.trigger_phrases) as string[];
    const keywordTriggered = ticketEnabled && checkKeywordTrigger(message, triggerPhrases);

    // Store user message
    db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    ).run(convId, 'user', message);

    // Fetch conversation history (memory window)
    const history = (db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(convId, config.memoryWindow) as { role: string; content: string }[]).reverse();

    const coreMessages: CoreMessage[] = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const instructions = getInstructions();

    let languageLabel: string | null = null;
    if (language) {
      let configuredLanguages: { code: string; label: string }[] = [];
      try { configuredLanguages = JSON.parse(getConfigValue('languages', '[]')); } catch { /* ignore */ }
      const match = configuredLanguages.find(l => l.code === language);
      const cleanLabel = match?.label.replace(/\p{Emoji_Presentation}/gu, '').trim();
      languageLabel = cleanLabel ? `${cleanLabel} (${language})` : language;
    }

    const systemPrompt = buildSystemPrompt({ triggerPhrases, instructions, language: languageLabel });

    let ticketTriggered = keywordTriggered;
    let assistantContent = '';

    const streamResponse = await streamChatResponse({
      agentId,
      messages: coreMessages,
      systemPrompt,
      onTicketTrigger: () => {
        ticketTriggered = true;
      },
      onLog: (logData) => {
        try {
          insertAiLog({
            conversationId: convId ?? null,
            model: logData.model,
            systemPrompt,
            messages: JSON.stringify(coreMessages),
            responseText: logData.responseText,
            steps: JSON.stringify(logData.steps),
            inputTokens: logData.inputTokens,
            outputTokens: logData.outputTokens,
            thinkingTokens: logData.thinkingTokens,
            costUsd: logData.costUsd,
          });
        } catch (err) {
          console.error('[ai_log] failed to save log:', err);
        }
      },
    });

    // Consume stream to capture assistant text for DB storage
    // We pipe it through while also capturing the text
    const [streamForClient, streamForCapture] = streamResponse.body!.tee();

    // Capture assistant response asynchronously
    (async () => {
      try {
        const reader = streamForCapture.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split('\n')) {
            if (line.startsWith('0:')) {
              try {
                assistantContent += JSON.parse(line.slice(2));
              } catch { /* skip malformed */ }
            }
          }
        }
      } catch (err) {
        console.error('[chat] stream capture error:', err);
        logSystemError('chat', 'POST /api/chat', err);
      } finally {
        if (assistantContent) {
          db.prepare(
            'INSERT INTO messages (conversation_id, role, content, ticket_triggered) VALUES (?, ?, ?, ?)'
          ).run(convId, 'assistant', assistantContent, ticketTriggered ? 1 : 0);
        }
      }
    })();

    return new Response(streamForClient, {
      headers: {
        ...Object.fromEntries(streamResponse.headers.entries()),
        'X-Conversation-Id': convId,
      },
    });
  }
);
