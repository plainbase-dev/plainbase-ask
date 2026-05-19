# Plainbase Ask

An AI-powered customer support widget you self-host. Connects to your knowledge base, answers questions, and escalates to a ticket when needed.

Check out all Plainbase tools at [plainbase.dev](https://plainbase.dev).

## Quick start

**1. Clone and configure:**

```bash
cp .env.example .env
# Fill in AI_PROVIDER, AI_API_KEY, AI_MODEL, EMBEDDING_MODEL, ADMIN_PASSWORD
```

**2. Start:**

```bash
docker compose up -d --build
```

**3. Open the admin** at `http://localhost:3000/admin`, add your documents, and configure the widget.

**4. Embed the widget** by copying the snippet from the Widget page in the admin and pasting it into your site.

> For production, set `DOMAIN=mycompany.com` in your `.env` — the container handles HTTPS automatically via Caddy. Or put your own reverse proxy in front and leave `DOMAIN` unset.

## Backups

The app stores data in two SQLite files. Litestream is bundled in the Docker image and can stream both files to any S3-compatible bucket in real time — just set `LITESTREAM_S3_BUCKET` and credentials in `.env`.

## Full documentation

See [`docs/00-getting-started.md`](docs/00-getting-started.md) for:

- How the app works and sizing guidance
- Recommended European hosting providers (Hetzner, Scaleway, Koyeb…)
- Litestream backup setup (Scaleway, Cloudflare R2, MinIO)
- Full environment variable reference
