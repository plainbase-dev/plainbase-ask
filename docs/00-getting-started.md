# Getting Started — Hosting & Setup

This guide walks you through deploying Plainbase Ask on a European cloud provider, setting up S3-compatible backups with Litestream, and getting the admin up and running.

## How the app works, briefly

Plainbase Ask is a Node.js server packaged as a Docker container. It stores everything in two SQLite files on disk:

- `db.sqlite` — conversations, config, tickets, agent settings
- `vec.sqlite` — the vector database (document chunks and embeddings)

**SQLite** is a database engine that runs inside the app process and stores its data in a plain file on disk — no separate database server, no network connection, no credentials to manage. It's the most widely deployed database in the world, used in browsers, phones, and desktop apps. For a single-server deployment like this one, it's faster than Postgres for reads and has zero operational overhead.

The tradeoff is that you need the disk to persist across restarts — handled either by a Docker volume or by Litestream, which continuously streams both files to S3.

---

## Sizing: how much server do you need?

The bottleneck isn't the app itself — it's fast and lightweight. The bottleneck is the LLM API calls, which are network-bound and happen per message.

**Minimum (getting started, low traffic):**

- 1 vCPU
- 512 MB RAM
- 5 GB disk (for the databases and Docker image)

**Comfortable (up to ~1,000 visitors/day):**

- 1–2 vCPU
- 1–2 GB RAM
- 10–20 GB disk

At 1,000 daily visitors, assuming an average of 3–5 messages per conversation, you're looking at roughly 3,000–5,000 LLM calls/day. The server handles this easily on a single core. Most of the time it's just waiting on the OpenAI/Anthropic API to respond — CPU barely moves.

The main reasons to scale up: if you're crawling large websites regularly (the crawler is CPU-intensive during embeddings), or if you're storing years of conversation history and the SQLite files grow large.

---

## Choosing a host

All of the options below support Docker and are based in Europe.

### Hetzner + Coolify (recommended for most setups)

Hetzner has some of the best price-to-performance in Europe. Pair it with [Coolify](https://coolify.io) (an open-source PaaS you self-host on the same server) and you get a Heroku-like deployment experience: push, redeploy, manage env vars in a UI.

- A **CX22** (2 vCPU, 4 GB RAM, €4.15/mo) is more than enough for 1,000 visitors/day
- Coolify installs via a one-line script on the server
- You then deploy Plainbase Ask as a Docker Compose app from the Coolify dashboard

Good if you're comfortable SSHing into a server once to set up Coolify, then want a GUI for everything after.

### Scaleway

French cloud provider, GDPR-native, strong on compliance. Their **DEV1-S** (2 vCPU, 2 GB RAM, ~€7/mo) works well. They also offer S3-compatible object storage (Scaleway Object Storage) which you can use directly for Litestream backups — no need for AWS.

Good if GDPR compliance documentation matters to your customers or your legal team.

### Koyeb

European PaaS (HQ in Paris) that runs containers natively — no server management at all. You push a Docker image or point it at a GitHub repo and it runs.

The catch: Koyeb uses ephemeral storage, so **Litestream is required** — the SQLite files must be backed up to S3 continuously or you lose data on every redeploy.

Their **Starter** plan (0.5 vCPU, 512 MB RAM) handles low traffic. For 1,000 visitors/day, use the **Standard** tier (1 vCPU, 2 GB RAM).

Good if you want zero server management and are comfortable with the Litestream dependency.

### Scalingo

French PaaS similar to Heroku, built for European compliance. Docker deployments are supported. Like Koyeb, storage is ephemeral — Litestream required.

Their **M** container size (1 vCPU, 1 GB RAM) is a reasonable starting point.

Good for teams that want a managed PaaS with European data residency guarantees.

### OVHcloud

Large French provider. More infrastructure-oriented than the others — you manage the server yourself (no built-in PaaS). Their **Starter** VPS (1 vCPU, 2 GB RAM, ~€6/mo) works fine.

Good if you already use OVH for other infrastructure.

---

## Setting up with Docker Compose

The simplest path for a VPS (Hetzner, OVHcloud, or similar).

**1. Install Docker on your server:**

```bash
curl -fsSL https://get.docker.com | sh
```

> **On a Mac?** You can use [OrbStack](https://orbstack.dev) instead of Docker Desktop — it's faster, lighter on resources, and replaces Docker Desktop entirely. `docker compose` commands work exactly the same.

**2. Copy the project files to your server**, or clone from your repo.

**3. Create your `.env` file** from the example:

```bash
cp .env.example .env
```

Then fill in the required values (see [Environment variables](#environment-variables) below).

**4. Start the container:**

```bash
docker compose up -d
```

The admin is now accessible at `http://your-server-ip:3000/admin`.

**5. Enable HTTPS**

Put a reverse proxy in front of the container to handle TLS. The app listens on port 3000. If you're on Hetzner + Coolify, Coolify's built-in Traefik proxy handles this automatically. For a plain VPS, Nginx or Caddy in front of the container works well.

> **Without HTTPS:** set `NODE_ENV=development` to disable the Secure flag on the session cookie. The `NODE_ENV=production` setting requires HTTPS.

---

## Setting up Litestream (S3 backups)

Litestream is already bundled in the Docker image. It streams both SQLite databases to S3 in real time — so if your server dies, you restore from S3 and lose at most a few seconds of data.

You need an S3-compatible bucket. Options:

- **Scaleway Object Storage** — S3-compatible, French data centers, good price
- **Hetzner Object Storage** — S3-compatible, German data centers, very cheap
- **Cloudflare R2** — no egress fees, EU storage available, S3-compatible

> **Important:** The bucket must have **private** access control. Conversation data is sensitive — it should never be publicly readable.

### Step 1: Create a bucket

Create a private bucket with your preferred provider. Note the bucket name and create access credentials (access key ID + secret key).

### Step 2: Add the Litestream env vars

In your `.env`:

```bash
LITESTREAM_S3_BUCKET=your-bucket-name
LITESTREAM_ACCESS_KEY_ID=your-access-key
LITESTREAM_SECRET_ACCESS_KEY=your-secret-key

# Region (default: us-east-1 — change to match your bucket)
LITESTREAM_S3_REGION=fr-par

# Endpoint — omit for AWS S3; required for any other provider
LITESTREAM_S3_ENDPOINT=https://s3.fr-par.scw.cloud   # Scaleway example
# LITESTREAM_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com  # Cloudflare R2
# LITESTREAM_S3_ENDPOINT=http://minio:9000                           # self-hosted MinIO
```

No changes to `litestream.yml` are needed — it reads all values from env vars.

### Step 3: Start (or restart) the container

When `LITESTREAM_S3_BUCKET` is set, the entrypoint script automatically:

- Tries to **restore** the databases from S3 on startup (if they don't already exist on disk)
- Wraps the app with **continuous replication** — every write is streamed to S3 within seconds

```bash
docker compose up -d
```

### Verifying replication

Check the container logs — you should see Litestream output alongside the app:

```bash
docker compose logs -f
```

You're looking for lines like `litestream: replica sync` without errors.

### Restoring from backup

If you're moving to a new server and want to restore from S3, simply start the container with the same env vars and an empty `/data` directory. The entrypoint detects the missing database files and restores them automatically before starting the app.

---

## Setting up ticketing

When a visitor can't find the answer they need, the widget can offer an escalation form that captures their email address and submits a support ticket. The ticket is stored in the database and — if SMTP is configured — an email containing the full conversation transcript is sent to the address you configure.

Email is intentionally the delivery mechanism here because it's universal. You can point it at a plain support inbox and handle tickets manually, or forward it straight into any tool that accepts email-to-ticket (Zendesk, HubSpot, Crisp, Freshdesk, Linear, etc.) — the ticket arrives like any other inbound support request and works with whatever workflow you already have.

### How it works

1. The visitor clicks "Get help from a human" (or similar — the label is configurable in the Widget settings).
2. They enter their email address and submit.
3. The app records the ticket in `db.sqlite` and sends an email to the address you've set in **Admin → Config → Ticket email**.
4. The ticket appears in **Admin → Tickets**, where you can review the conversation.

One ticket per conversation is enforced. Submissions are also rate-limited to one per IP per hour to prevent abuse.

The email is sent non-blocking — if the SMTP send fails, the ticket is still recorded in the database and you'll see an error in the container logs.

### SMTP env vars

```bash
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_SECURE=false          # set to true for port 465 (TLS)
SMTP_USER=your@email.com
SMTP_PASS=your-smtp-password
SMTP_FROM=bot@yourcompany.com   # optional — defaults to SMTP_USER
```

Any standard SMTP server works: Gmail (with an app password), Postmark, Resend, Brevo, your own Postfix, etc.

### Recipient address

The **Ticket email** field (where notifications land) is set in the admin UI at **Config → Ticket email** — not in `.env`. This lets you change the destination without restarting the container.

If **Ticket email** is left blank, tickets are still recorded in the database but no email is sent.

---

## Choosing an AI provider

Plainbase Ask needs two models: a **chat model** (generates answers) and an **embedding model** (turns your documents and queries into vectors for semantic search). Both are set via environment variables.

**If a provider doesn't offer an embedding model, you'll need a second provider just for embeddings.** The `AI_PROVIDER` variable controls both, so if your chat provider has no embeddings, set `EMBEDDING_PROVIDER` and `EMBEDDING_API_KEY` to a fallback. Mistral offers both chat and embeddings — it's the simplest choice if you want a single provider.

### Provider overview

| Provider                    | `AI_PROVIDER` | Chat models                                  | Embedding model                                    |
| --------------------------- | ------------- | -------------------------------------------- | -------------------------------------------------- |
| **Mistral** _(recommended)_ | `mistral`     | `mistral-medium-3-5`, `mistral-small-latest` | `mistral-embed`                                    |
| OpenAI                      | `openai`      | `gpt-5.4-mini`,`gpt-5.4-nano`                | `text-embedding-3-small`, `text-embedding-3-large` |
| Anthropic                   | `anthropic`   | `claude-sonnet-4-6`, `claude-haiku-4-5`      | None — use a fallback provider                     |
| Google                      | `google`      | `gemini-2.5-flash`, `gemini-2.5-flash-lite`  | `gemini-embedding-2`                               |

### Recommended setup

The simplest single-provider setup uses Mistral for everything:

```bash
AI_PROVIDER=mistral
AI_API_KEY=your-mistral-api-key
AI_MODEL=mistral-large-latest
EMBEDDING_MODEL=mistral-embed
```

---

## Environment variables reference

See `.env.example` for the full list. The critical ones for production:

| Variable                       | Required                           | Notes                                                                        |
| ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------- |
| `AI_PROVIDER`                  | Yes                                | `openai`, `anthropic`, `mistral`, `google`                                   |
| `AI_API_KEY`                   | Yes                                | API key for the chosen provider                                              |
| `AI_MODEL`                     | Yes                                | e.g. `mistral-large-latest`, `gpt-4o`, `claude-sonnet-4-6`                   |
| `EMBEDDING_MODEL`              | Yes                                | e.g. `mistral-embed`, `text-embedding-3-small`                               |
| `EMBEDDING_PROVIDER`           | If chat provider has no embeddings | e.g. `mistral`                                                               |
| `EMBEDDING_API_KEY`            | If `EMBEDDING_PROVIDER` is set     | API key for the embedding provider                                           |
| `ADMIN_PASSWORD`               | Yes                                | Change this before going live                                                |
| `NODE_ENV`                     | Yes                                | Set to `production` (requires HTTPS)                                         |
| `DATABASE_PATH`                | No                                 | Defaults to `/data/db.sqlite`                                                |
| `VEC_DATABASE_PATH`            | No                                 | Defaults to `/data/vec.sqlite`                                               |
| `PORT`                         | No                                 | Defaults to `3000`                                                           |
| `LITESTREAM_S3_BUCKET`         | If using backups                   | Bucket name                                                                  |
| `LITESTREAM_ACCESS_KEY_ID`     | If using backups                   | S3-compatible access key                                                     |
| `LITESTREAM_SECRET_ACCESS_KEY` | If using backups                   | S3-compatible secret key                                                     |
| `LITESTREAM_S3_REGION`         | If using backups                   | Bucket region (default: `us-east-1`)                                         |
| `LITESTREAM_S3_ENDPOINT`       | Non-AWS only                       | e.g. `https://s3.nl-ams.scw.cloud`                                           |
| `SMTP_HOST`                    | If using tickets                   | SMTP server hostname                                                         |
| `SMTP_PORT`                    | If using tickets                   | SMTP port (default: `587`)                                                   |
| `SMTP_SECURE`                  | If using tickets                   | `true` for port 465/TLS, otherwise `false`                                   |
| `SMTP_USER`                    | If using tickets                   | SMTP username                                                                |
| `SMTP_PASS`                    | If using tickets                   | SMTP password                                                                |
| `SMTP_FROM`                    | No                                 | Sender address (defaults to `SMTP_USER`)                                     |

---

## Next steps

Once the server is running and you can log into `/admin`:

1. Go to **Knowledge Base** and add your first document or crawl your help center
2. Go to **Instructions** and write your tone and scope
3. Go to **Config** and set your cost tracking rates and SMTP if you want tickets
4. Go to **Widget**, add your domain to the allowed list, configure your language strings, and enable the widget
5. Copy the embed snippet and paste it into your website
