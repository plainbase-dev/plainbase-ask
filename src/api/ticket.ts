import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, getAgent, logSystemError } from '../db/client.js';
import { sendTicketEmail } from '../ticket/email.js';
import { isOriginAllowed } from './chat.js';
import type { Message } from '../db/schema.js';

const ticketSchema = z.object({
  conversationId: z.string().min(1),
  userEmail: z.string().email(),
});

const TICKET_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ticketLastSubmission = new Map<string, number>();

function checkTicketRateLimit(ip: string): boolean {
  const now = Date.now();
  // Clean up entries older than the window
  for (const [key, ts] of ticketLastSubmission) {
    if (now - ts > TICKET_RATE_WINDOW_MS) ticketLastSubmission.delete(key);
  }
  const last = ticketLastSubmission.get(ip);
  if (last !== undefined && now - last < TICKET_RATE_WINDOW_MS) return false;
  ticketLastSubmission.set(ip, now);
  return true;
}

type TicketEnv = { Variables: { adminPreview: boolean } };
export const ticketRouter = new Hono<TicketEnv>();

ticketRouter.post(
  '/ticket',
  (c, next) => {
    console.log('[ticket] request received from origin:', c.req.header('Origin') ?? '(none)');
    return next();
  },
  zValidator('json', ticketSchema, (result, c) => {
    if (!result.success) {
      console.error('[ticket] validation failed:', JSON.stringify(result.error.flatten()));
      return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
    }
  }),
  async (c) => {
    const origin = c.req.header('Origin') ?? '';
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim()
      ?? c.req.header('CF-Connecting-IP')
      ?? 'unknown';

    console.log('[ticket] processing for ip:', ip);

    const agent = getAgent();
    const allowedDomains = JSON.parse(agent.allowed_domains) as string[];
    console.log('[ticket] allowed_domains:', allowedDomains, '| origin:', origin);

    if (!c.get('adminPreview')) {
      if (isOriginAllowed(origin, allowedDomains)) {
        c.res.headers.set('Access-Control-Allow-Origin', origin);
        c.res.headers.set('Vary', 'Origin');
      } else if (allowedDomains.length > 0) {
        console.warn('[ticket] blocked — origin not in allowed_domains');
        return c.json({ error: 'Domain not allowed' }, 403);
      }
    }

    if (!checkTicketRateLimit(ip)) {
      console.warn('[ticket] blocked — rate limit hit for ip:', ip);
      return c.json({ error: 'Too many ticket submissions. Please wait before trying again.' }, 429);
    }

    const { conversationId, userEmail } = c.req.valid('json');
    console.log('[ticket] conversationId:', conversationId, '| userEmail:', userEmail);

    // Verify conversation belongs to this agent
    const conversation = db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND agent_id = ?'
    ).get(conversationId, agent.id);

    if (!conversation) {
      console.warn('[ticket] conversation not found:', conversationId, 'for agent:', agent.id);
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Check if ticket already created for this conversation
    const existing = db.prepare(
      'SELECT id FROM tickets WHERE conversation_id = ?'
    ).get(conversationId);

    if (existing) {
      console.warn('[ticket] duplicate ticket for conversation:', conversationId);
      return c.json({ error: 'Ticket already created for this conversation' }, 409);
    }

    // Fetch full conversation
    const messages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId) as Message[];

    // Insert ticket
    db.prepare(
      'INSERT INTO tickets (conversation_id, user_email) VALUES (?, ?)'
    ).run(conversationId, userEmail);

    // Update conversation with user email
    db.prepare(
      'UPDATE conversations SET user_email = ? WHERE id = ?'
    ).run(userEmail, conversationId);

    // Send email (non-blocking failure — ticket is still recorded)
    if (agent.ticket_email) {
      try {
        await sendTicketEmail({
          to: agent.ticket_email,
          userEmail,
          messages,
        });
        console.log('[ticket] email sent to', agent.ticket_email);
      } catch (err) {
        console.error('[ticket] email send failed:', err);
        logSystemError('email', 'POST /api/ticket', err);
      }
    } else {
      console.warn('[ticket] skipping email — ticket_email not configured');
    }

    return c.json({ success: true, conversationId });
  }
);
