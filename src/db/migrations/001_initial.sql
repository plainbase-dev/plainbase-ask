CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL,
  allowed_domains TEXT NOT NULL DEFAULT '[]',
  ticket_email TEXT NOT NULL DEFAULT '',
  trigger_phrases TEXT NOT NULL DEFAULT '["talk to a human","speak to someone","real person","contact support","human agent"]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  user_email TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  ticket_triggered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  user_email TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS instructions (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  tone_persona TEXT NOT NULL DEFAULT 'You are a friendly and concise support assistant.',
  scope_guardrails TEXT NOT NULL DEFAULT 'Only answer questions related to our product. For anything else, let the user know you can''t help with that.',
  escalation_hints TEXT NOT NULL DEFAULT 'Always offer a ticket for billing or account access issues, even if the user doesn''t ask.',
  additional_context TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO instructions (id) VALUES (1);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config VALUES
  ('rate_limit_messages_per_second', '0.2'),
  ('rate_limit_max_messages_per_conv', '50'),
  ('rate_limit_max_conversations_per_ip', '5'),
  ('conversation_memory_window', '10'),
  ('max_response_tokens', '1000'),
  ('languages', '[]'),
  ('cost_input_per_1m', '0'),
  ('cost_output_per_1m', '0'),
  ('cost_embedding_per_1m', '0'),
  ('widget_active', '0'),
  ('primary_color', '#2563eb'),
  ('logo_data', ''),
  ('logo_mime', '');

CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  model TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  messages TEXT NOT NULL DEFAULT '[]',
  response_text TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  thinking_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS ai_logs_created_at ON ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_logs_conversation_id ON ai_logs(conversation_id);

CREATE TABLE IF NOT EXISTS crawl_sources (
  id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  agent_id         TEXT    NOT NULL,
  start_url        TEXT    NOT NULL,
  max_pages        INTEGER NOT NULL DEFAULT 50,
  crawl_interval   TEXT    NOT NULL DEFAULT 'none',
  last_crawled_at  INTEGER,
  next_crawl_at    INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(agent_id, start_url)
);

CREATE TABLE IF NOT EXISTS system_errors (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  source     TEXT    NOT NULL,
  route      TEXT    NOT NULL DEFAULT '',
  message    TEXT    NOT NULL,
  stack      TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS system_errors_created_at ON system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS system_errors_source     ON system_errors(source);
