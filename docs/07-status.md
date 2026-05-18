# Status

The Status page is a live snapshot of your deployment — widget state, AI spend, ticketing configuration, and crawler health all in one place. Nothing is editable here; it's purely an at-a-glance health check with links to configure each component.

## Top stat strip

Four summary tiles:

- **Widget** — Active or Inactive
- **Ticketing** — Enabled or Disabled
- **AI Model** — the current model and provider (e.g. `gpt-4o · openai`)
- **Total Cost** — estimated spend over the selected time period (7 / 30 / 90 days)

## AI Spend

Detailed cost breakdown for the selected period. Use the **7d / 30d / 90d** tabs to change the window.

| Stat | What it shows |
|---|---|
| Chat Cost | Estimated cost of LLM chat calls |
| Embedding Cost | Cost of generating embeddings when documents were ingested |
| LLM Calls | Total number of AI calls made |
| Tokens (in / out) | Total input and output tokens consumed |

Cost estimates are calculated using the per-token rates you configured in [Config → Cost Tracking](./04-config.md). They're an estimate, not what you're actually billed.

## Widget

A summary of the widget's current state:

- On/Off status
- Which domains are in the allowed list
- Active AI provider and model

Click **Configure** to jump directly to the [Widget](./06-widget.md) settings.

## Ticketing

Shows whether the ticket feature is enabled and what email address tickets are sent to. Click **Configure** to jump to [Config → Ticket Feature](./04-config.md#03--ticket-feature).

## Knowledge Base Crawlers

A table of all your registered crawl sources, showing:

- The source URL
- Its crawl schedule (daily / weekly / biweekly / monthly, or "Manual only")
- When it was last crawled
- When the next crawl is due (shown as "Overdue" in orange if the scheduled time has passed)

If a crawl is currently running, a blue "Running" banner appears at the top of the card showing which URL is active and how long it's been running.

Click **Manage** to go to the [Knowledge Base](./02-knowledge-base.md) page where you can add, remove, or manually trigger sources.
