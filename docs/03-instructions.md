# Instructions

Instructions let you shape how the assistant behaves — its tone, what topics it covers, and when it offers to escalate to a human. Changes take effect as soon as you save; no restart or redeploy needed.

## How the prompt works

Every time a visitor sends a message, the assistant assembles a system prompt from four layers stacked together:

1. **System Rules** — hardcoded rules shipped with the platform. Defines how the bot searches the knowledge base, handles ticket escalation, what markdown it can use, and how it cites sources. You can read it on this page but cannot edit it.
2. **Company Instructions** — the four fields you edit on this page. These get substituted into the system prompt on every request.
3. **Knowledge Base** — the top matching chunks retrieved from your indexed documents, included as context for each turn.
4. **Conversation memory** — the last 10 messages of the current conversation (configurable in [Config](./04-config.md)).

The Instructions page lets you edit Layer 2.

## The four editable fields

### Tone & Persona
How the bot sounds and what name/personality it projects. Keep it short — 1–3 sentences is plenty.

*Example: "You are Maya, a friendly support specialist for Acme Co. Warm, concise, and never pushy."*

### Scope & Guardrails
What topics the assistant will answer, and what it will politely decline. Use this to keep the bot focused on your product rather than going off-topic.

*Example: "Only answer questions about our software products, billing, and warranty. Decline to discuss competitors or provide legal advice."*

### Escalation Hints
Tells the bot when to proactively offer the ticket button — based on what the user is trying to do, not on specific keywords. (Keyword matching is handled separately by Ticket Trigger Phrases below.)

*Example: "Always offer a ticket if the user mentions a broken device, a missing shipment, or asks to speak to a real person."*

> This field is disabled if the ticket feature is turned off in [Config](./04-config.md).

### Additional Context
A free-form catch-all for anything that doesn't fit the other fields. Good for time-sensitive information like current promotions, temporary policies, or store hours.

*Example: "We're running a Spring sale through 31 May — all plans are 20% off."*

### Ticket Trigger Phrases
A list of phrases (one per line) that immediately surface the ticket button when they appear in a user's message, regardless of what the AI decides. Case-insensitive.

*Example:*
```
talk to a human
speak to someone
real person
contact support
```

> This field is also disabled if the ticket feature is off.

## Saving changes

As soon as you edit any field, a save bar appears at the bottom of the screen showing how many fields have unsaved changes. Click **Save instructions** to apply. Click **Discard** to revert all fields back to their last saved state.

Each field also has a **Reset to default** button that reverts just that field to the platform default (without affecting other fields).

## Viewing the system rules

The full base prompt (Layer 1) is shown read-only on this page. The parts in `{curly_braces}` are placeholders filled in at request time from your Company Instructions. You can see approximately how many tokens it consumes.
