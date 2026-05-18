export interface Agent {
  id: string;
  name: string;
  allowed_domains: string; // JSON array of strings
  ticket_email: string;
  trigger_phrases: string; // JSON array of strings
  created_at: number;
}

export interface Document {
  id: string;
  agent_id: string;
  filename: string;
  content_type: string;
  uploaded_at: number;
  source_url: string | null;
  last_crawled_at: number | null;
  char_count: number | null;
  embedding_cost_usd: number | null;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  user_email: string | null;
  started_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ticket_triggered: number;
  created_at: number;
}

export interface Ticket {
  id: string;
  conversation_id: string;
  user_email: string;
  created_at: number;
}

export interface Instructions {
  id: 1;
  tone_persona: string;
  scope_guardrails: string;
  escalation_hints: string;
  additional_context: string;
  updated_at: number;
}

export interface Config {
  key: string;
  value: string;
}

export type CrawlInterval = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CrawlSource {
  id: string;
  agent_id: string;
  start_url: string;
  max_pages: number;
  crawl_interval: CrawlInterval;
  last_crawled_at: number | null;
  next_crawl_at: number | null;
  created_at: number;
}

export interface AiLog {
  id: string;
  conversation_id: string | null;
  model: string;
  system_prompt: string;
  messages: string;       // JSON
  response_text: string;
  steps: string;          // JSON
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cost_usd: number | null;
  created_at: number;
}
