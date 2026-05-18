import type { CrawlResult } from './crawl.js';

export type JobStatus = 'running' | 'done' | 'error';

export interface CrawlJob {
  id: string;
  startUrl: string;
  status: JobStatus;
  result?: CrawlResult;
  errorMessage?: string;
  startedAt: number;
  finishedAt?: number;
}

// Only one job slot — we only need the most recent one
let currentJob: CrawlJob | null = null;

export function createJob(startUrl: string): CrawlJob {
  const job: CrawlJob = {
    id: Math.random().toString(36).slice(2),
    startUrl,
    status: 'running',
    startedAt: Date.now(),
  };
  currentJob = job;
  return job;
}

export function resolveJob(id: string, result: CrawlResult): void {
  if (currentJob?.id === id) {
    currentJob.status = 'done';
    currentJob.result = result;
    currentJob.finishedAt = Date.now();
  }
}

export function rejectJob(id: string, err: unknown): void {
  if (currentJob?.id === id) {
    currentJob.status = 'error';
    currentJob.errorMessage = err instanceof Error ? err.message : 'Crawl failed.';
    currentJob.finishedAt = Date.now();
  }
}

export function getJob(): CrawlJob | null {
  return currentJob;
}
