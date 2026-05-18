import { CheerioCrawler, Configuration, log } from 'crawlee';
import { getVecDb } from '../db/vecClient.js';
import { deleteDocument, ingestText } from '../rag/ingest.js';
import { logSystemError } from '../db/client.js';

export interface CrawlOptions {
  agentId: string;
  startUrl: string;
  maxPages?: number;
}

export interface CrawlResult {
  ingested: number;
  updated: number;
  errors: number;
}

export async function crawlAndIngest(options: CrawlOptions): Promise<CrawlResult> {
  const { agentId, startUrl } = options;
  const maxPages = Math.min(options.maxPages ?? 50, 200);
  const hostname = new URL(startUrl).hostname;

  const result: CrawlResult = { ingested: 0, updated: 0, errors: 0 };

  log.setLevel(log.LEVELS.WARNING);

  const config = new Configuration({
    storageClientOptions: {
      localDataDirectory: process.env.CRAWLEE_STORAGE_DIR ?? '/tmp/crawlee-storage',
    },
  });

  const crawler = new CheerioCrawler(
    {
      maxRequestsPerCrawl: maxPages,
      maxConcurrency: 3,
      requestHandlerTimeoutSecs: 30,

      async requestHandler({ $, request, enqueueLinks }) {
        const url = request.url;

        const vecDb = await getVecDb();
        const existing = vecDb
          .prepare('SELECT id FROM documents WHERE agent_id = ? AND source_url = ?')
          .get(agentId, url) as { id: string } | undefined;

        if (existing) {
          await deleteDocument(existing.id);
        }

        // Strip non-content elements, keep nav/header/footer for completeness
        $('script, style, img, picture, figure, svg').remove();

        const title = $('title').text().trim() || new URL(url).pathname;
        const rawText = $('body').text();
        const text = rawText.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

        try {
          await ingestText(agentId, title, 'text/plain', text, url);
          // Set last_crawled_at after insert (ingestText doesn't know the doc id)
          vecDb
            .prepare(
              `UPDATE documents SET last_crawled_at = unixepoch()
               WHERE agent_id = ? AND source_url = ? AND last_crawled_at IS NULL`
            )
            .run(agentId, url);

          if (existing) {
            result.updated++;
          } else {
            result.ingested++;
          }
        } catch (err) {
          console.error(`[crawler] failed to ingest ${url}:`, err);
          logSystemError('crawler', `crawl:${url}`, err);
          result.errors++;
        }

        await enqueueLinks({
          globs: [`*://${hostname}/**`],
          exclude: [/\.(pdf|png|jpg|jpeg|gif|svg|css|js|ico|xml|json|zip|woff|woff2|ttf)(\?.*)?$/i],
        });
      },

      failedRequestHandler({ request }) {
        console.error(`[crawler] request failed: ${request.url}`);
        logSystemError('crawler', `crawl:${request.url}`, new Error(`Request failed: ${request.url}`));
        result.errors++;
      },
    },
    config
  );

  await crawler.run([startUrl]);

  return result;
}
