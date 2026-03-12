/**
 * RSS Fetcher Service
 * Fast ingest + async article extraction pipeline
 */

import { EntryRepository, FeedRepository, FetchLogRepository } from '../db/repositories/index.js';
import { articleExtractionService } from './articleExtractionService.js';
import { FeedIngestService } from './feedIngestService.js';
import { normalizeFeedItem, selectFeedIcon, shouldExtractArticleContent } from './feedNormalizer.js';
import { runWithConcurrency } from '../utils/concurrency.js';

const FEED_REFRESH_CONCURRENCY = 4;

interface FetchResult {
  success: boolean;
  itemCount: number;
  error?: string;
}

const feedIngestService = new FeedIngestService();

export async function refreshFeed(feedId: string): Promise<FetchResult> {
  const feedRepo = new FeedRepository();
  const entryRepo = new EntryRepository();
  const fetchLogRepo = new FetchLogRepository();
  const startTime = Date.now();
  const fetchLog = fetchLogRepo.create({
    feed_id: feedId,
    status: 'running',
  });

  try {
    const feed = feedRepo.findById(feedId);
    if (!feed) {
      throw new Error(`Feed ${feedId} not found`);
    }

    const ingestResult = await feedIngestService.ingest(feed);
    const nowIso = new Date().toISOString();

    if (ingestResult.kind === 'not-modified') {
      feedRepo.update(feedId, {
        last_checked_at: nowIso,
        last_error: null,
        fetch_etag: ingestResult.etag ?? feed.fetch_etag,
        fetch_last_modified: ingestResult.lastModified ?? feed.fetch_last_modified,
        last_fetch_url: ingestResult.fetchUrl,
      });

      fetchLogRepo.update(fetchLog.id, {
        status: 'success',
        finished_at: nowIso,
        duration_ms: Date.now() - startTime,
        item_count: 0,
      });

      return {
        success: true,
        itemCount: 0,
      };
    }

    const { feedData } = ingestResult;
    const siteUrl = feedData.link || feed.site_url;
    const faviconUrl = selectFeedIcon(feedData, siteUrl, ingestResult.fetchUrl);

    feedRepo.update(feedId, {
      title: feedData.title || feed.title,
      site_url: siteUrl,
      description: feedData.description || feed.description,
      favicon_url: faviconUrl || feed.favicon_url,
      last_checked_at: nowIso,
      last_error: null,
      fetch_etag: ingestResult.etag ?? feed.fetch_etag,
      fetch_last_modified: ingestResult.lastModified ?? feed.fetch_last_modified,
      last_fetch_url: ingestResult.fetchUrl,
    });

    let newItemCount = 0;

    for (const item of feedData.items || []) {
      const normalized = normalizeFeedItem({
        feed,
        item,
        feedData,
        siteUrl,
      });

      if (!normalized) {
        continue;
      }

      const existing = entryRepo.findByFeedIdAndGuid(feedId, normalized.guid);
      if (existing) {
        continue;
      }

      const shouldExtract = shouldExtractArticleContent(feed, normalized.url);
      const entry = entryRepo.create({
        feed_id: feedId,
        ...normalized,
        content_extraction_status: shouldExtract ? 'queued' : 'skipped',
        content_extraction_error: null,
        content_extracted_at: null,
        content_source_url: normalized.url,
      });

      if (shouldExtract) {
        articleExtractionService.enqueueEntry(entry);
      }

      newItemCount += 1;
    }

    fetchLogRepo.update(fetchLog.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      item_count: newItemCount,
    });

    void articleExtractionService.pumpPendingJobs();

    return {
      success: true,
      itemCount: newItemCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nowIso = new Date().toISOString();

    console.error(`✗ Failed to fetch feed ${feedId}:`, errorMessage);

    feedRepo.update(feedId, {
      last_checked_at: nowIso,
      last_error: errorMessage,
    });

    fetchLogRepo.update(fetchLog.id, {
      status: 'error',
      message: errorMessage,
      finished_at: nowIso,
      duration_ms: Date.now() - startTime,
    });

    return {
      success: false,
      itemCount: 0,
      error: errorMessage,
    };
  }
}

export async function refreshAllFeeds(): Promise<void> {
  const feedRepo = new FeedRepository();
  const feeds = feedRepo.findAll();

  await runWithConcurrency(feeds, FEED_REFRESH_CONCURRENCY, async (feed) => {
    await refreshFeed(feed.id);
  });

  void articleExtractionService.pumpPendingJobs();
}
