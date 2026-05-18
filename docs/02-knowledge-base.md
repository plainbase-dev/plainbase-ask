# Knowledge Base

The Knowledge Base is where you feed the assistant information. Every answer the bot gives is grounded in what you've put here — it won't make things up beyond what's indexed.

There are two ways to add content: upload a file, or point the crawler at a website. Both result in the same thing: text gets chunked into small pieces, turned into embeddings (numerical representations the AI can search over), and stored so the bot can retrieve relevant passages when answering a question.

## Stats strip

At the top of the page:

- **Documents** — number of sources currently indexed
- **Chunks** — number of searchable text segments (one document becomes many chunks)
- **Corpus size** — total character count of indexed content
- **Embed spend** — cumulative cost of generating embeddings (in USD)

## 01 — Upload a document

Drop a PDF or Markdown file onto the upload zone (or click to browse). The file gets processed immediately — chunked, embedded, and added to the knowledge base.

**Accepted formats:** `.pdf`, `.md`  
**Size limit:** set via `MAX_UPLOAD_SIZE_MB` (default: 10 MB)

After uploading, the document appears in the Documents table below.

## 02 — Crawl a website

Point the crawler at a URL and it will walk links from that starting point, staying on the same domain. Good for indexing a help center, docs site, or any structured web content.

**Settings when starting a crawl:**

| Setting | What it does | Default |
|---|---|---|
| Start URL | Where the crawl begins | — |
| Max pages | Hard upper limit on how many pages get crawled | 50 (max 200) |
| Rechecking interval | How often this source is automatically re-crawled | No rechecking |

The crawler respects `robots.txt`, so pages that a site has blocked will be skipped.

While a crawl is running, a status banner appears with a **Stop** button. Once it finishes, you'll see a summary: pages ingested, pages updated, and any errors.

## 03 — Scheduled sources

Any URL you crawled with a rechecking interval set shows up here. This table lets you manage those recurring crawls.

For each source you can:
- Change the **interval** (daily / weekly / biweekly / monthly / none) and save it inline
- **Crawl now** — trigger an immediate re-crawl regardless of the schedule
- **Delete** the source — removes it from the schedule (the already-indexed content stays until you delete individual documents)

The scheduled crawler runs once per hour and only triggers sources whose next crawl time has passed. You configure what time of day that happens in the [Config](./04-config.md) section (crawl schedule).

## 04 — Documents table

Every indexed source — whether uploaded or crawled — appears here. The table shows:

- **Source** — filename for uploads, URL for crawled pages
- **Type** — Web, PDF, or Markdown
- **Chunks** — how many searchable segments were created from this source
- **Size** — approximate character count
- **Embed cost** — what it cost to embed this document
- **Last crawled** — only relevant for web sources

You can **filter by name** using the search box at the top of the table.

To remove a document, click the trash icon on its row. Deletion is immediate — the bot stops drawing on that content on the very next request.

## Environment variables

| Variable | What it controls |
|---|---|
| `EMBEDDING_MODEL` | The model used to generate embeddings (e.g. `text-embedding-3-small`) |
| `MAX_UPLOAD_SIZE_MB` | Maximum file size for uploads |
| `CRAWLEE_STORAGE_DIR` | Temporary storage for the crawler's request queue |
| `VEC_DATABASE_PATH` | Where the vector database file is stored |

> **Important:** If you change `EMBEDDING_MODEL`, you must delete the vector database and re-index all documents. The embedding dimension is fixed when the first document is uploaded.
