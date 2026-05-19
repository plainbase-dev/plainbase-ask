import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  adminAuth, createSession, destroySession, setSessionCookie, clearSessionCookie,
  isLoginRateLimited, recordLoginFailure, clearLoginAttempts, isValidSession,
  isPasswordCorrect, getCsrfToken, csrfProtect,
} from './middleware/auth.js';
import { db, getAgent, upsertCrawlSource, markCrawlSourceDone, updateCrawlSourceInterval, deleteCrawlSource, getCrawlSourceById, logSystemError } from '../db/client.js';
import type { CrawlInterval } from '../db/schema.js';
import { chatRouter } from '../api/chat.js';
import { ticketRouter } from '../api/ticket.js';
import { widgetRouter } from '../api/widget.js';
import { dashboardView } from './views/dashboard.js';
import { knowledgeView } from './views/knowledge.js';
import { instructionsView } from './views/instructions.js';
import { configView } from './views/config.js';
import { conversationsView, convDetailFragment } from './views/conversations.js';
import { widgetConfigView, widgetPreviewFrame } from './views/widget-config.js';
import { statusView } from './views/status.js';
import { ingestFile, deleteDocument, validateUpload } from '../rag/ingest.js';
import { crawlAndIngest } from '../crawler/crawl.js';
import { createJob, resolveJob, rejectJob, getJob } from '../crawler/jobs.js';
import { html } from 'hono/html';

const DEFAULTS = {
  tone_persona: 'You are a friendly and concise support assistant.',
  scope_guardrails: "Only answer questions related to our product. For anything else, let the user know you can't help with that.",
  escalation_hints: "Always offer a ticket for billing or account access issues, even if the user doesn't ask.",
  additional_context: '',
};

// Private/loopback IP ranges that must not be crawled (SSRF protection)
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|169\.254\.|::1$|fc00:|fd)/i;
const PRIVATE_HOSTNAMES = new Set(['localhost']);

function validateCrawlUrl(raw: string): void {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid URL format.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.');
  }
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(host) || PRIVATE_IP_RE.test(host)) {
    throw new Error('Private and internal URLs are not allowed.');
  }
}

export function registerAdminRoutes(app: Hono): void {
  const admin = new Hono();

  // CSRF protection — must run before all POST handlers (including login)
  admin.use('*', csrfProtect);

  // --- Login ---

  admin.get('/login', (c) => {
    const token = getCookie(c, 'admin_session');
    if (isValidSession(token)) return c.redirect('/admin');
    const csrfToken = getCsrfToken(c);
    return c.html(loginPage(csrfToken));
  });

  admin.post('/login', async (c) => {
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim()
      ?? c.req.header('CF-Connecting-IP')
      ?? 'unknown';

    if (isLoginRateLimited(ip)) {
      const csrfToken = getCsrfToken(c);
      return c.html(loginPage(csrfToken, 'Too many failed attempts. Try again in 15 minutes.'), 429);
    }

    const body = await c.req.parseBody();
    const password = body['password'] as string;

    if (!process.env.ADMIN_PASSWORD) {
      return c.html(loginPage('ADMIN_PASSWORD environment variable is not set.'), 500);
    }

    if (!isPasswordCorrect(password, process.env.ADMIN_PASSWORD)) {
      recordLoginFailure(ip);
      const csrfToken = getCsrfToken(c);
      return c.html(loginPage(csrfToken, 'Incorrect password.'), 401);
    }

    clearLoginAttempts(ip);
    const token = createSession();
    setSessionCookie(c, token);
    return c.redirect('/admin');
  });

  admin.get('/logout', (c) => {
    const token = getCookie(c, 'admin_session');
    if (token) destroySession(token);
    clearSessionCookie(c);
    return c.redirect('/admin/login');
  });

  // Content-Security-Policy for admin UI (unsafe-inline needed for inline styles in views)
  admin.use('*', async (c, next) => {
    await next();
    const isPreviewFrame = c.req.path.endsWith('/widget/preview-frame');
    c.res.headers.set(
      'Content-Security-Policy',
      isPreviewFrame
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'"
        : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
  });

  // Apply auth to everything below
  admin.use('*', adminAuth);

  // --- Dashboard ---

  admin.get('/', async (c) => {
    interface ErrorBySource { source: string; count: number; }
    const errorsBySource = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM system_errors
      WHERE created_at >= unixepoch() - 86400
      GROUP BY source
    `).all() as ErrorBySource[];
    const errorMap = Object.fromEntries(errorsBySource.map(r => [r.source, r.count]));
    return c.html(await dashboardView(errorMap));
  });

  // --- Knowledge Base ---

  admin.get('/knowledge', async (c) => {
    const csrfToken = getCsrfToken(c);
    return c.html(await knowledgeView(csrfToken));
  });

  admin.post('/knowledge', async (c) => {
    const agent = getAgent();
    let body: Awaited<ReturnType<typeof c.req.parseBody>>;
    try {
      body = await c.req.parseBody();
    } catch {
      const csrfToken = getCsrfToken(c);
      return c.html(await knowledgeView(csrfToken, 'Invalid form data.'));
    }

    const file = body['file'] instanceof File ? body['file'] : null;
    if (!file || file.size === 0) {
      const csrfToken = getCsrfToken(c);
      return c.html(await knowledgeView(csrfToken, 'No file selected.'));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    try {
      validateUpload(file.name, contentType, file.size, buffer);
      await ingestFile(agent.id, file.name, contentType, buffer);
    } catch (err) {
      logSystemError('knowledge', 'POST /admin/knowledge', err);
      const csrfToken = getCsrfToken(c);
      return c.html(await knowledgeView(csrfToken, err instanceof Error ? err.message : 'Upload failed.'));
    }

    return c.redirect('/admin/knowledge');
  });

  admin.post('/knowledge/crawl', async (c) => {
    const agent = getAgent();
    const body = await c.req.parseBody();
    const url = (body['url'] as string ?? '').trim();
    const maxPages = Math.min(parseInt((body['max_pages'] as string) ?? '50', 10) || 50, 200);
    const rawInterval = (body['crawl_interval'] as string ?? 'none').trim();
    const validIntervals: CrawlInterval[] = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];
    const interval: CrawlInterval = validIntervals.includes(rawInterval as CrawlInterval)
      ? (rawInterval as CrawlInterval)
      : 'none';

    if (!url) {
      const csrfToken = getCsrfToken(c);
      return c.html(await knowledgeView(csrfToken, 'Please enter a URL.'));
    }
    try { validateCrawlUrl(url); } catch (err) {
      logSystemError('crawler', 'POST /admin/knowledge/crawl', err);
      const csrfToken = getCsrfToken(c);
      return c.html(await knowledgeView(csrfToken, err instanceof Error ? err.message : 'Invalid URL.'));
    }

    const source = upsertCrawlSource(agent.id, url, maxPages, interval);
    const job = createJob(url);
    const startedAt = Math.floor(Date.now() / 1000);
    crawlAndIngest({ agentId: agent.id, startUrl: url, maxPages })
      .then(result => {
        resolveJob(job.id, result);
        markCrawlSourceDone(source.id, startedAt);
      })
      .catch(err => rejectJob(job.id, err));

    return c.redirect('/admin/knowledge');
  });

  admin.post('/knowledge/crawl-source/:id/interval', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.parseBody();
    const rawInterval = (body['crawl_interval'] as string ?? 'none').trim();
    const validIntervals: CrawlInterval[] = ['none', 'daily', 'weekly', 'biweekly', 'monthly'];
    const interval: CrawlInterval = validIntervals.includes(rawInterval as CrawlInterval)
      ? (rawInterval as CrawlInterval)
      : 'none';
    updateCrawlSourceInterval(id, interval);
    return c.redirect('/admin/knowledge');
  });

  admin.post('/knowledge/crawl-source/:id/delete', (c) => {
    const { id } = c.req.param();
    deleteCrawlSource(id);
    return c.redirect('/admin/knowledge');
  });

  admin.post('/knowledge/crawl-source/:id/crawl-now', async (c) => {
    const { id } = c.req.param();
    const agent = getAgent();
    const source = getCrawlSourceById(id);
    if (!source || source.agent_id !== agent.id) {
      return c.redirect('/admin/knowledge');
    }
    const job = createJob(source.start_url);
    const startedAt = Math.floor(Date.now() / 1000);
    crawlAndIngest({ agentId: agent.id, startUrl: source.start_url, maxPages: source.max_pages })
      .then(result => {
        resolveJob(job.id, result);
        markCrawlSourceDone(source.id, startedAt);
      })
      .catch(err => rejectJob(job.id, err));
    return c.redirect('/admin/knowledge');
  });

  admin.get('/knowledge/crawl/status', (c) => {
    return c.json(getJob() ?? { status: 'idle' });
  });

  admin.post('/knowledge/:id/delete', async (c) => {
    const { id } = c.req.param();
    const agent = getAgent();
    const { getVecDb } = await import('../db/vecClient.js');
    try {
      const vecDb = await getVecDb();
      const doc = vecDb.prepare('SELECT id FROM documents WHERE id = ? AND agent_id = ?').get(id, agent.id);
      if (doc) await deleteDocument(id);
    } catch {
      // vec DB not yet initialized or doc not found — nothing to delete
    }
    return c.redirect('/admin/knowledge');
  });

  // --- Instructions ---

  admin.get('/instructions', (c) => {
    const csrfToken = getCsrfToken(c);
    return c.html(instructionsView(c.req.query('saved') === '1', csrfToken));
  });

  admin.post('/instructions', async (c) => {
    const body = await c.req.parseBody();
    const action = body['action'] as string;
    const resetField = body['reset_field'] as keyof typeof DEFAULTS | undefined;

    if (resetField && DEFAULTS[resetField] !== undefined) {
      db.prepare(`UPDATE instructions SET ${resetField} = ?, updated_at = unixepoch() WHERE id = 1`)
        .run(DEFAULTS[resetField]);
      return c.redirect('/admin/instructions');
    }

    if (action === 'save') {
      db.prepare(`
        UPDATE instructions SET
          tone_persona = ?, scope_guardrails = ?, escalation_hints = ?, additional_context = ?,
          updated_at = unixepoch()
        WHERE id = 1
      `).run(
        body['tone_persona'] ?? '',
        body['scope_guardrails'] ?? '',
        body['escalation_hints'] ?? '',
        body['additional_context'] ?? ''
      );

      const agent = getAgent();
      const rawPhrases = (body['trigger_phrases'] as string) ?? '';
      const triggerPhrases = rawPhrases.split('\n').map(s => s.trim()).filter(Boolean);
      db.prepare('UPDATE agents SET trigger_phrases = ? WHERE id = ?')
        .run(JSON.stringify(triggerPhrases), agent.id);
    }

    return c.redirect('/admin/instructions?saved=1');
  });

  // --- Config ---

  admin.get('/config', (c) => {
    const saved = c.req.query('saved') === '1';
    const csrfToken = getCsrfToken(c);
    return c.html(configView(saved, csrfToken, undefined));
  });

  admin.post('/config', async (c) => {
    const body = await c.req.parseBody();
    const agent = getAgent();

    db.prepare('UPDATE agents SET ticket_email = ? WHERE id = ?')
      .run((body['ticket_email'] as string) ?? '', agent.id);

    // ticket_enabled is a checkbox — absent when unchecked, so handle separately
    const ticketEnabled = (body['ticket_enabled'] as string | undefined) === '1' ? '1' : '0';
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('ticket_enabled', ticketEnabled);

    const configKeys = [
      'rate_limit_messages_per_second',
      'rate_limit_max_conversations_per_ip',
      'rate_limit_max_messages_per_conv',
      'rate_limit_max_cost_per_conv',
      'conversation_memory_window',
      'max_response_tokens',
      'cost_input_per_1m',
      'cost_output_per_1m',
      'cost_embedding_per_1m',
      'timezone',
      'crawl_run_hour',
    ] as const;

    for (const key of configKeys) {
      const val = body[key] as string | undefined;
      if (val !== undefined) {
        db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, val);
      }
    }

    return c.redirect('/admin/config?saved=1');
  });

  // --- Conversations ---

  admin.get('/conversations', (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const q = c.req.query('q') ?? '';
    const ticket = c.req.query('ticket') === '1';
    const blocked = c.req.query('blocked') === '1';
    const selectedId = c.req.query('id') ?? null;
    return c.html(conversationsView({ page, q, ticket, blocked, selectedId }));
  });

  // AJAX detail fragment — returns only the inner detail pane HTML
  admin.get('/conversations/detail', (c) => {
    const id = c.req.query('id') ?? null;
    return c.html(convDetailFragment(id));
  });

  // Redirect old per-conversation URLs to the unified split-pane view
  admin.get('/conversations/:id', (c) => {
    const { id } = c.req.param();
    return c.redirect(`/admin/conversations?id=${encodeURIComponent(id)}`, 301);
  });

  // --- Widget Config ---

  admin.get('/widget', (c) => {
    const host = `${c.req.header('X-Forwarded-Proto') ?? c.req.url.split('://')[0]}://${c.req.header('host') ?? 'localhost:3000'}`;
    const saved = c.req.query('saved') === '1';
    const csrfToken = getCsrfToken(c);
    return c.html(widgetConfigView(host, saved, csrfToken));
  });

  admin.post('/widget', async (c) => {
    const body = await c.req.parseBody();
    const agent = getAgent();

    const allowedDomains = ((body['allowed_domains'] as string) ?? '')
      .split('\n').map(s => s.trim()).filter(Boolean);

    db.prepare('UPDATE agents SET allowed_domains = ? WHERE id = ?')
      .run(JSON.stringify(allowedDomains), agent.id);

    const isProduction = process.env.NODE_ENV !== 'development';
    const widgetActiveRequested = body['widget_active'] === '1';
    const widgetActive = (isProduction && allowedDomains.length === 0)
      ? '0'
      : (widgetActiveRequested ? '1' : '0');
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('widget_active', widgetActive);

    if (isProduction && allowedDomains.length === 0 && widgetActiveRequested) {
      const host = `${c.req.header('X-Forwarded-Proto') ?? c.req.url.split('://')[0]}://${c.req.header('host') ?? 'localhost:3000'}`;
      const csrfToken = getCsrfToken(c);
      return c.html(widgetConfigView(host, false, csrfToken, 'Set at least one allowed domain before enabling the widget in production.'));
    }

    const widgetConfigKeys = [
      'widget_button_text',
      'languages',
      'primary_color',
    ] as const;

    for (const key of widgetConfigKeys) {
      const val = body[key] as string | undefined;
      if (val !== undefined) {
        db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, val);
      }
    }

    return c.redirect('/admin/widget?saved=1');
  });

  admin.post('/widget/logo', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!(file instanceof File)) {
      return c.redirect('/admin/widget?saved=0');
    }
    const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      return c.redirect('/admin/widget?saved=0');
    }
    if (file.size > 500 * 1024) {
      return c.redirect('/admin/widget?saved=0');
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const b64 = bytes.toString('base64');
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('logo_data', b64);
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('logo_mime', file.type);
    return c.redirect('/admin/widget?saved=1');
  });

  admin.post('/widget/logo/delete', (c) => {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('logo_data', '');
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('logo_mime', '');
    return c.redirect('/admin/widget?saved=1');
  });

  admin.get('/widget/preview-frame', (c) => {
    const host = `${c.req.header('X-Forwarded-Proto') ?? c.req.url.split('://')[0]}://${c.req.header('host') ?? 'localhost:3000'}`;
    const agent = getAgent();
    return c.html(widgetPreviewFrame(host, agent.id));
  });

  // --- Status ---

  admin.get('/status', async (c) => {
    const rawDays = parseInt(c.req.query('days') ?? '30', 10);
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;

    const filterSource = c.req.query('source') || null;
    const filterRoute  = c.req.query('route')  || null;

    interface RecentError { source: string; route: string; message: string; created_at: number; }
    const recentErrors = db.prepare(`
      SELECT source, route, message, created_at
      FROM system_errors
      WHERE (? IS NULL OR source = ?)
        AND (? IS NULL OR route  = ?)
      ORDER BY created_at DESC
      LIMIT 20
    `).all(filterSource, filterSource, filterRoute, filterRoute) as RecentError[];

    interface DistinctSource { source: string; }
    interface DistinctRoute  { route: string; }
    const errorSources = (db.prepare(`SELECT DISTINCT source FROM system_errors ORDER BY source`).all() as DistinctSource[]).map(r => r.source);
    const errorRoutes  = (db.prepare(`SELECT DISTINCT route  FROM system_errors ORDER BY route`).all()  as DistinctRoute[]).map(r => r.route);

    return c.html(await statusView(days, recentErrors, errorSources, errorRoutes, filterSource, filterRoute));
  });

  admin.get('/logs', (c) => c.redirect('/admin/conversations', 301));
  admin.get('/logs/:id', (c) => c.redirect('/admin/conversations', 301));

  // Preview routes: public API behind adminAuth, without widget_active check.
  // The widget page's preview iframe points its apiBase here.
  const preview = new Hono<{ Variables: { adminPreview: boolean } }>();
  preview.use('*', adminAuth);
  preview.use('*', async (c, next) => { c.set('adminPreview', true); await next(); });
  preview.route('/api', chatRouter);
  preview.route('/api', ticketRouter);
  preview.route('/', widgetRouter);
  app.route('/admin/preview', preview);

  app.route('/admin', admin);
}

function loginPage(csrfToken: string, error?: string): string {
  return String(html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admin Login — plainbase ask</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: white; padding: 36px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.1); width: 340px; }
    h1 { font-size: 18px; margin-bottom: 24px; color: #0f172a; }
    .logo { display: block; margin-bottom: 28px; }
    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; color: #374151; }
    input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none; }
    input:focus { border-color: #2563eb; }
    button { margin-top: 16px; width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #dc2626; font-size: 13px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <svg class="logo" width="80" height="30" viewBox="0 0 80 30" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="30" rx="7" fill="#2a2a2a"/><line x1="15" y1="4" x2="15" y2="26" stroke="white" stroke-width="2.6" stroke-linecap="round"/><circle cx="23" cy="15" r="6.5" fill="none" stroke="white" stroke-width="2.6"/><text x="36" y="20.5" font-family="Geist,ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="900" fill="white" letter-spacing="0.3">ASK</text></svg>
    <form method="POST" action="/admin/login">
      <input type="hidden" name="_csrf" value="${csrfToken}" />
      <label>Password</label>
      <input type="password" name="password" autofocus autocomplete="current-password" />
      <button type="submit">Log in</button>
      ${error ? `<div class="error">${error}</div>` : ''}
    </form>
  </div>
</body>
</html>`);
}
