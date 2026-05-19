# Widget

The Widget page is where you configure the chat bubble that appears on your website, and where you get the embed snippet to install it. A live preview on the right side of the page updates as you make changes.

## Widget Status

A toggle that turns the widget on or off.

- **Active** — the chat bubble is visible and the API accepts requests
- **Inactive** — the widget is hidden and any API calls return a 503 error

> In production, you must configure at least one Allowed Domain before you can enable the widget. The toggle is locked until a domain is added.

## Closed Button

**Button label text** — the text shown next to the chat icon when the widget is in its closed (minimized) state. Leave this blank to show only the icon.

*Example: "Need help? Chat with us"*

## Brand Color

A color picker for the widget's primary color. This applies to the chat button, message bubbles, and accent elements throughout the widget. Defaults to `#2563eb` (blue).

## Allowed Domains

A list of domains (one per line) that are permitted to load the widget. This is a security measure — it ensures the widget only works on your website and not on someone else's.

In development (when `NODE_ENV` is not `production`), you can leave this empty to allow any origin. In production, add your website domain before enabling the widget.

*Example:*
```
example.com
app.example.com
```

## Languages

Configure the text strings shown to visitors. You can add one language or several.

- **Single language** — no language selector is shown to visitors; the widget just uses those strings.
- **Multiple languages** — a language picker appears in the widget so visitors can choose their preferred language.

For each language you configure:

| Field | What it controls |
|---|---|
| Code | ISO 639 language code (e.g. `en`, `fr`, `de`) |
| Label | How the language appears in the picker (e.g. `🇬🇧 English`) |
| Starter message | The first message the bot sends when the widget opens |
| Widget title | The heading at the top of the chat window |
| Widget subtitle | The smaller text below the title |
| Chat input placeholder | Ghost text inside the message input box |
| Ticket button label | Text on the ticket button (shown when the AI offers escalation) |
| Ticket card title | Heading on the ticket submission form |
| Ticket card body text | Explanatory text on the ticket form |
| Office hours | Shown on the ticket card. One line per entry, use `|` to separate label from hours (e.g. `Mon – Fri | 9:00 – 18:00`). Leave empty to hide. |
| Conversation limit message | Text shown to the visitor when their conversation is sealed by any rate limit. Leave empty to use the default: "Conversation limit reached." |

## Logo

Upload a logo (PNG, JPG, SVG, or WebP, max 500 KB) to replace the default sparkle icon in the widget header and message avatars. To remove it, click **Remove logo**.

## Embed snippet

Once you've configured the widget, paste this snippet into the `<head>` of your website HTML:

```html
<script
  src="https://your-domain.com/widget.js"
  data-agent-id="your-agent-id"
></script>
```

The **Copy to clipboard** button grabs the snippet automatically with the correct values filled in.

## Live preview

The right side of the page shows a live preview iframe. Open the widget in the bottom-right corner of the preview to test your current configuration before saving.
