# Config

Config is where you manage the runtime settings for the assistant. Some settings (the AI model and provider) are locked to environment variables and require a server restart to change. Everything else is editable here and applies on save.

## 01 — LLM Provider

Shows which AI provider and models are currently active. These are **read-only** in the UI — they reflect what's set in your environment variables.

| Setting | Environment variable | What it does |
|---|---|---|
| Provider | `AI_PROVIDER` | Which AI service to use: `openai`, `anthropic`, `mistral`, or `google` |
| Chat model | `AI_MODEL` | The model identifier passed to the provider (e.g. `gpt-4o`, `claude-sonnet-4-6`) |
| Embedding model | `EMBEDDING_MODEL` | The model used to generate embeddings for the knowledge base |
| API key | `AI_API_KEY` | Your API key for the selected provider |

To change any of these, update your `.env` file and restart the server. The page shows a warning reminding you of this.

> **Note on Anthropic:** Anthropic has no embedding model of its own. If `AI_PROVIDER=anthropic`, set `OPENAI_API_KEY` separately — embeddings will use OpenAI.

## 02 — Cost Tracking

The assistant logs token usage on every AI call. Here you set the per-token rates used to estimate spend in the Conversations view and the Status page.

These rates are for **display only** — they don't affect what your provider actually charges you. Set them to match your provider's current published pricing.

| Setting | What to enter |
|---|---|
| Input (USD / 1M tokens) | Cost per million input tokens |
| Output (USD / 1M tokens) | Cost per million output tokens |
| Embedding (USD / 1M tokens) | Cost per million tokens for embedding generation |

## 03 — Ticket Feature

Controls whether the assistant can offer to create a support ticket.

**Feature enabled** (toggle) — when on, the AI has access to a ticket tool and can surface a ticket button to the user. When off, the tool is removed entirely and ticket-related fields in Instructions are disabled.

**Support inbox** — the email address where ticket notifications are sent. Each ticket email includes the visitor's email and a transcript of the conversation.

You can test the email configuration with the **Send test** button in the card header.

SMTP credentials for sending ticket emails are set via environment variables:

| Variable | What it does |
|---|---|
| `SMTP_HOST` | Your SMTP server hostname |
| `SMTP_PORT` | SMTP port (typically `587` for TLS, `465` for SSL) |
| `SMTP_SECURE` | Set to `true` for port 465 (SSL), `false` otherwise |
| `SMTP_USER` | SMTP login username |
| `SMTP_PASS` | SMTP login password |
| `SMTP_FROM` | The "From" address on outgoing emails (defaults to `SMTP_USER`) |

## 04 — Rate Limits

Guardrails that protect your model budget and prevent abuse. All five have sensible defaults you can reset with the **Reset to defaults** button.

| Setting | Default | What it does |
|---|---|---|
| Messages per second per IP | `0.2` | How fast a single IP address can send messages. Requests above this rate receive a 429 error. |
| Max active conversations per IP | `5` | How many simultaneous chat sessions one IP address can hold open. |
| Max messages per conversation | `50` | Once a conversation hits this limit, it's sealed — the visitor has to start a new one. |
| Conversation memory window | `10` | How many recent messages the AI sees as context on each call. Higher = better memory, higher cost. |
| Max response tokens | `1000` | Hard cap on how long each individual AI reply can be. |

## 05 — Crawl Schedule

Controls when the automatic re-crawler fires each day.

| Setting | What it does |
|---|---|
| Timezone | IANA timezone used for scheduling and timestamp display throughout the admin. Examples: `Europe/Brussels`, `America/New_York`, `Asia/Tokyo`. Defaults to `UTC`. |
| Run hour | The hour of the day (0–23, in the configured timezone) at which scheduled crawls trigger. Defaults to `0` (midnight). |

The scheduler checks for due crawls every 60 minutes. A source only crawls if its next scheduled time falls within the current run hour.
