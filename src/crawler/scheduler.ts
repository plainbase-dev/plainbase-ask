import { getDueCrawlSources, markCrawlSourceDone, getAgent } from '../db/client.js';
import { crawlAndIngest } from './crawl.js';
import { getJob, createJob, resolveJob, rejectJob } from './jobs.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check once per hour

export function startScheduler(): void {
  void checkDue();
  setInterval(() => void checkDue(), CHECK_INTERVAL_MS);
}

async function checkDue(): Promise<void> {
  if (getJob()?.status === 'running') return;

  const sources = getDueCrawlSources();
  if (sources.length === 0) return;

  const source = sources[0];
  const agent = getAgent();
  const job = createJob(source.start_url);
  const now = Math.floor(Date.now() / 1000);

  console.log(`[scheduler] running scheduled crawl for ${source.start_url}`);
  try {
    const result = await crawlAndIngest({
      agentId: agent.id,
      startUrl: source.start_url,
      maxPages: source.max_pages,
    });
    resolveJob(job.id, result);
    console.log(`[scheduler] crawl done: ${result.ingested} ingested, ${result.updated} updated, ${result.errors} errors`);
  } catch (err) {
    rejectJob(job.id, err);
    console.error(`[scheduler] crawl failed for ${source.start_url}:`, err);
  } finally {
    markCrawlSourceDone(source.id, now);
  }
}
