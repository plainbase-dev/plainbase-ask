import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agent, AiLog, Instructions, CrawlSource, CrawlInterval } from './schema.js';

const DB_PATH = process.env.DATABASE_PATH ?? '/data/db.sqlite';

export const db = new Database(DB_PATH);

sqliteVec.load(db);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

runMigrations();
seedDefaultAgent();

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();
    console.log(`[db] applied migration: ${file}`);
  }
}

function seedDefaultAgent() {
  const existing = db.prepare('SELECT id FROM agents LIMIT 1').get();
  if (existing) return;
  db.prepare(`
    INSERT INTO agents (name, allowed_domains, trigger_phrases)
    VALUES ('Default Agent', '[]', '["talk to a human","speak to someone","real person","contact support","human agent"]')
  `).run();
  console.log('[db] seeded default agent');
}

export function getAgent(): Agent {
  return db.prepare('SELECT * FROM agents LIMIT 1').get() as Agent;
}

export function getInstructions(): Instructions {
  return db.prepare('SELECT * FROM instructions WHERE id = 1').get() as Instructions;
}

export function getConfig(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function getConfigValue(key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function insertAiLog(entry: {
  conversationId: string | null;
  model: string;
  systemPrompt: string;
  messages: string;
  responseText: string;
  steps: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  costUsd: number | null;
}): void {
  db.prepare(`
    INSERT INTO ai_logs
      (conversation_id, model, system_prompt, messages, response_text, steps,
       input_tokens, output_tokens, thinking_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.conversationId,
    entry.model,
    entry.systemPrompt,
    entry.messages,
    entry.responseText,
    entry.steps,
    entry.inputTokens,
    entry.outputTokens,
    entry.thinkingTokens,
    entry.costUsd,
  );
}

export function getAiLogs(limit = 100, offset = 0): AiLog[] {
  return db.prepare(
    'SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as AiLog[];
}

export function getAiLog(id: string): AiLog | undefined {
  return db.prepare('SELECT * FROM ai_logs WHERE id = ?').get(id) as AiLog | undefined;
}

export function countAiLogs(): number {
  return (db.prepare('SELECT COUNT(*) as n FROM ai_logs').get() as { n: number }).n;
}

// ── Crawl Sources ─────────────────────────────────────────────────────────────

const INTERVAL_DAYS: Record<Exclude<CrawlInterval, 'none'>, number> = {
  daily:    1,
  weekly:   7,
  biweekly: 14,
  monthly:  30,
};

export function getCrawlScheduleConfig(): { runHour: number; timezone: string } {
  const rawHour = getConfigValue('crawl_run_hour', '0');
  const rawTz   = getConfigValue('timezone', 'UTC');
  const runHour = Math.max(0, Math.min(23, parseInt(rawHour, 10) || 0));
  // Validate timezone — fall back to UTC if unrecognised
  try {
    Intl.DateTimeFormat(undefined, { timeZone: rawTz });
    return { runHour, timezone: rawTz };
  } catch {
    return { runHour, timezone: 'UTC' };
  }
}

function hourInTimezone(ms: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    .formatToParts(new Date(ms));
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  return h === 24 ? 0 : h; // some implementations return 24 for midnight
}

function nextHourOccurrence(afterMs: number, runHour: number, timezone: string): number {
  // Snap to the start of the current hour, then advance to the next runHour slot
  const currentHourStart = Math.floor(afterMs / 3_600_000) * 3_600_000;
  const currentHour = hourInTimezone(currentHourStart, timezone);

  let hoursToAdd: number;
  if (currentHour < runHour) {
    hoursToAdd = runHour - currentHour;
  } else if (currentHour === runHour) {
    hoursToAdd = 0;
  } else {
    hoursToAdd = 24 - currentHour + runHour;
  }

  const candidateMs = currentHourStart + hoursToAdd * 3_600_000;

  // DST check: verify the hour is still runHour after the offset shift
  const actualHour = hourInTimezone(candidateMs, timezone);
  if (actualHour !== runHour) {
    // Clocks changed — shift by the difference (typically ±1 h)
    return Math.floor((candidateMs + (runHour - actualHour) * 3_600_000) / 1000);
  }

  return Math.floor(candidateMs / 1000);
}

function computeNextCrawlAt(
  interval: CrawlInterval,
  lastCrawledAt: number | null,
  runHour: number,
  timezone: string,
): number | null {
  if (interval === 'none') return null;
  const days = INTERVAL_DAYS[interval];
  // If never crawled, schedule after one interval from now
  const baseMs = lastCrawledAt !== null
    ? (lastCrawledAt + days * 86_400) * 1000
    : Date.now() + days * 86_400 * 1000;
  return nextHourOccurrence(baseMs, runHour, timezone);
}

export function getCrawlSources(agentId: string): CrawlSource[] {
  return db.prepare(
    'SELECT * FROM crawl_sources WHERE agent_id = ? ORDER BY created_at DESC'
  ).all(agentId) as CrawlSource[];
}

export function upsertCrawlSource(
  agentId: string,
  startUrl: string,
  maxPages: number,
  interval: CrawlInterval,
): CrawlSource {
  const existing = db.prepare(
    'SELECT * FROM crawl_sources WHERE agent_id = ? AND start_url = ?'
  ).get(agentId, startUrl) as CrawlSource | undefined;

  // New source: set next_crawl_at = null — markCrawlSourceDone will set it after the first crawl.
  // Existing source: recompute from last_crawled_at using current schedule config.
  let nextCrawlAt: number | null = null;
  if (existing?.last_crawled_at != null) {
    const { runHour, timezone } = getCrawlScheduleConfig();
    nextCrawlAt = computeNextCrawlAt(interval, existing.last_crawled_at, runHour, timezone);
  }

  db.prepare(`
    INSERT INTO crawl_sources (agent_id, start_url, max_pages, crawl_interval, next_crawl_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, start_url) DO UPDATE SET
      max_pages      = excluded.max_pages,
      crawl_interval = excluded.crawl_interval,
      next_crawl_at  = excluded.next_crawl_at
  `).run(agentId, startUrl, maxPages, interval, nextCrawlAt);

  return db.prepare(
    'SELECT * FROM crawl_sources WHERE agent_id = ? AND start_url = ?'
  ).get(agentId, startUrl) as CrawlSource;
}

export function updateCrawlSourceInterval(id: string, interval: CrawlInterval): void {
  const source = db.prepare('SELECT * FROM crawl_sources WHERE id = ?').get(id) as CrawlSource | undefined;
  if (!source) return;
  const { runHour, timezone } = getCrawlScheduleConfig();
  const nextCrawlAt = source.last_crawled_at != null
    ? computeNextCrawlAt(interval, source.last_crawled_at, runHour, timezone)
    : null;
  db.prepare(
    'UPDATE crawl_sources SET crawl_interval = ?, next_crawl_at = ? WHERE id = ?'
  ).run(interval, nextCrawlAt, id);
}

export function markCrawlSourceDone(id: string, now: number): void {
  const source = db.prepare('SELECT crawl_interval FROM crawl_sources WHERE id = ?').get(id) as { crawl_interval: CrawlInterval } | undefined;
  if (!source) return;
  const { runHour, timezone } = getCrawlScheduleConfig();
  const nextCrawlAt = computeNextCrawlAt(source.crawl_interval, now, runHour, timezone);
  db.prepare(
    'UPDATE crawl_sources SET last_crawled_at = ?, next_crawl_at = ? WHERE id = ?'
  ).run(now, nextCrawlAt, id);
}

export function deleteCrawlSource(id: string): void {
  db.prepare('DELETE FROM crawl_sources WHERE id = ?').run(id);
}

export function getDueCrawlSources(): CrawlSource[] {
  return db.prepare(`
    SELECT * FROM crawl_sources
    WHERE crawl_interval != 'none'
      AND next_crawl_at IS NOT NULL
      AND next_crawl_at <= unixepoch()
    ORDER BY next_crawl_at ASC
  `).all() as CrawlSource[];
}

export function getCrawlSourceById(id: string): CrawlSource | undefined {
  return db.prepare('SELECT * FROM crawl_sources WHERE id = ?').get(id) as CrawlSource | undefined;
}

// ── System Error Log ──────────────────────────────────────────────────────────

export type ErrorSource = 'chat' | 'email' | 'ticket' | 'knowledge' | 'crawler' | 'widget' | 'admin';

export function logSystemError(source: ErrorSource, route: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? (err.stack ?? null) : null;
  try {
    db.prepare(
      `INSERT INTO system_errors (source, route, message, stack) VALUES (?, ?, ?, ?)`
    ).run(source, route, message, stack);
  } catch {
    // never let the logger crash the process
  }
}
