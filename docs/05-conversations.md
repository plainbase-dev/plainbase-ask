# Conversations

The Conversations view is where you review everything visitors have said to the assistant. You can read message threads, inspect what the AI actually did under the hood, and export data for analysis.

## Layout

The page is split into two panels:

- **Left panel** — a scrollable list of conversations, newest first
- **Right panel** — the full detail of whichever conversation is selected

Clicking a conversation in the left panel loads its detail on the right without navigating away.

## Filtering and searching

The filter bar at the top lets you narrow the list:

- **Search** — type any text to filter by visitor email, conversation ID, or message content. The list updates automatically as you type.
- **Ticket filter** — click the Ticket chip to show only conversations where a support ticket was submitted.

Filters combine — you can search for an email and filter to ticket conversations at the same time.

## Conversation list

Each row in the list shows:
- Visitor email (or "anonymous" if none was collected)
- When the conversation started (relative time — "5m", "yesterday", etc.)
- The first message the visitor sent (truncated)
- Conversation ID (shortened)
- Number of messages
- A "Ticket" badge if a ticket was submitted in that conversation

Pagination sits at the bottom of the list — 20 conversations per page.

## Conversation detail

Selecting a conversation opens two tabs:

### Messages tab

The full message thread in order, showing both visitor messages and assistant replies. Each message is labeled with its role (user or assistant). If the AI triggered the ticket button during a specific turn, that message is marked with a "Ticket trigger" badge.

If a ticket was submitted, a badge at the top shows the visitor's email and when the ticket was created.

### AI Logs tab

A technical view of every AI call that happened in this conversation. Useful for debugging why the bot gave a particular answer.

At the top: summary stats for the whole conversation — number of LLM calls, total input tokens, total output tokens, estimated cost.

Each row in the logs table represents one LLM call. You can expand any row to see:

- The full system prompt that was sent
- The messages array passed to the model (including retrieved knowledge base chunks)
- Any tool calls and their results (e.g. a knowledge base search)
- The final response text
- Thinking tokens (for models that support extended reasoning)

## Exporting

The **Export CSV** button (top right of the filter bar) downloads a CSV file of all conversations matching the current filters. Useful for feeding into a spreadsheet or BI tool.
