import { randomBytes } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { ArticleExtractionJob, Entry } from '../db/models.js';
import { ArticleExtractionJobRepository, EntryRepository, FeedRepository } from '../db/repositories/index.js';
import { extractDoi, extractFirstImageFromHtml, extractPmid } from './feedNormalizer.js';
import { getResponseHeader, requestText } from './outboundHttp.js';
import { runWithConcurrency } from '../utils/concurrency.js';

const EXTRACTION_CONCURRENCY = 2;
const EXTRACTION_MAX_ATTEMPTS = 3;
const EXTRACTION_LEASE_TIMEOUT_MS = 10 * 60 * 1000;
const EXTRACTION_BACKOFF_MS = [5 * 60 * 1000, 30 * 60 * 1000, 6 * 60 * 60 * 1000];
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; Aurora RSS Reader/1.0; +https://github.com/xiongsircool/aurora-rss-reader)';

function extractMetaContent(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const content = document.querySelector(selector)?.getAttribute('content');
    if (content) {
      return content;
    }
  }
  return null;
}

function normalizeMaybeUrl(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

export function extractReadableArticle(html: string, url: string): {
  content: string | null;
  imageUrl: string | null;
  doi: string | null;
  pmid: string | null;
} {
  const dom = new JSDOM(html, { url });
  try {
    const { document } = dom.window;
    const article = new Readability(document).parse();
    const imageUrl = normalizeMaybeUrl(
      extractMetaContent(document, [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[name="citation_image"]',
      ]) || extractFirstImageFromHtml(article?.content || html, url),
      url
    );

    const doi = extractMetaContent(document, [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="prism.doi"]',
    ]) || extractDoi({ link: url });

    const pmid = extractMetaContent(document, [
      'meta[name="citation_pmid"]',
      'meta[name="pmid"]',
    ]) || extractPmid({ link: url });

    return {
      content: article?.content || null,
      imageUrl,
      doi,
      pmid,
    };
  } finally {
    dom.window.close();
  }
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }

  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
}

export class ArticleExtractionService {
  private entryRepo = new EntryRepository();
  private feedRepo = new FeedRepository();
  private jobRepo = new ArticleExtractionJobRepository();
  private pumpPromise: Promise<void> | null = null;
  private leaseOwner = `${process.pid}-${randomBytes(4).toString('hex')}`;

  enqueueEntry(entry: Entry): void {
    if (!entry.url) {
      this.entryRepo.update(entry.id, {
        content_extraction_status: 'skipped',
        content_extraction_error: null,
      });
      return;
    }

    this.jobRepo.createOrReset({
      entry_id: entry.id,
      max_attempts: EXTRACTION_MAX_ATTEMPTS,
    });

    this.entryRepo.update(entry.id, {
      content_extraction_status: 'queued',
      content_extraction_error: null,
      content_source_url: entry.url,
    });
  }

  async pumpPendingJobs(limit: number = EXTRACTION_CONCURRENCY): Promise<void> {
    if (this.pumpPromise) {
      return this.pumpPromise;
    }

    this.pumpPromise = this.doPump(limit).finally(() => {
      this.pumpPromise = null;
    });

    return this.pumpPromise;
  }

  private async doPump(limit: number): Promise<void> {
    this.jobRepo.requeueExpiredRunningJobs(EXTRACTION_LEASE_TIMEOUT_MS);

    while (true) {
      const jobs = this.jobRepo.leaseDueJobs(limit, this.leaseOwner);
      if (jobs.length === 0) {
        return;
      }

      await runWithConcurrency(jobs, limit, async (job) => {
        await this.processJob(job);
      });
    }
  }

  private async processJob(job: ArticleExtractionJob): Promise<void> {
    const entry = this.entryRepo.findById(job.entry_id);
    if (!entry) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    const feed = this.feedRepo.findById(entry.feed_id);
    if (!feed || feed.view_type !== 'articles' || !entry.url) {
      this.entryRepo.update(entry.id, {
        content_extraction_status: 'skipped',
        content_extraction_error: null,
      });
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    this.entryRepo.update(entry.id, {
      content_extraction_status: 'running',
      content_extraction_error: null,
    });

    try {
      const response = await requestText(entry.url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9,zh;q=0.8',
        },
        timeoutMs: 30_000,
        maxRetries: 2,
        maxRedirects: 3,
        maxResponseBytes: 2 * 1024 * 1024,
        acceptedStatusCodes: [200],
        networkPolicy: 'public',
        logContext: 'article-extract',
      });

      const contentType = getResponseHeader(response.headers, 'content-type');
      if (!isHtmlContentType(contentType)) {
        this.entryRepo.update(entry.id, {
          content_extraction_status: 'skipped',
          content_extraction_error: 'Skipped non-HTML content',
          content_source_url: response.url,
        });
        this.jobRepo.markSucceeded(job.id);
        return;
      }

      const extracted = extractReadableArticle(response.body, response.url);
      if (!extracted.content) {
        throw new Error('Article content could not be extracted');
      }

      this.entryRepo.update(entry.id, {
        readability_content: extracted.content,
        image_url: entry.image_url ?? extracted.imageUrl ?? null,
        doi: entry.doi ?? extracted.doi ?? null,
        pmid: entry.pmid ?? extracted.pmid ?? null,
        content_extraction_status: 'succeeded',
        content_extraction_error: null,
        content_extracted_at: new Date().toISOString(),
        content_source_url: response.url,
      });
      this.jobRepo.markSucceeded(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextRunAt = job.attempts < job.max_attempts
        ? new Date(Date.now() + EXTRACTION_BACKOFF_MS[Math.min(job.attempts - 1, EXTRACTION_BACKOFF_MS.length - 1)]).toISOString()
        : null;

      this.entryRepo.update(entry.id, {
        content_extraction_status: 'failed',
        content_extraction_error: message,
        content_source_url: entry.url,
      });
      this.jobRepo.markFailed(job.id, message, nextRunAt);
    }
  }
}

export const articleExtractionService = new ArticleExtractionService();
