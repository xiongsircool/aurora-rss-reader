/**
 * On-device feed fetcher. Mirrors the orchestration of
 * `backend-node/src/services/fetcher.ts` but runs entirely on the device:
 * HTTP via the platform layer, parse + normalize in the domain layer, persist
 * through repositories.
 *
 * Supports conditional requests (ETag / Last-Modified) to skip unchanged feeds,
 * dedups by (feed_id, guid), and bounds concurrency across feeds.
 */
import { httpRequest, HttpError } from '../platform/http'
import { runWithConcurrency } from '../utils/concurrency'
import type { EntryRepository, FeedRepository } from '../data/repositories'
import type { FeedRow } from '../data/models'
import { parseFeed, type ParsedFeed } from './feedParser'
import { normalizeFeedItem, selectFeedIcon } from './feedNormalizer'
import { classifyParsedEntry } from './contentType'

const FEED_REFRESH_CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 25_000

export interface RefreshResult {
  feedId: string
  ok: boolean
  newEntries: number
  notModified: boolean
  error?: string
}

const USER_AGENT = 'AuroraRSSReader/mobile (+https://github.com/xiongsircool/aurora-rss-reader)'

function siteUrlFromFeed(parsed: ParsedFeed, feedUrl: string): string | null {
  return parsed.link || (() => {
    try {
      const u = new URL(feedUrl)
      return `${u.protocol}//${u.host}`
    } catch {
      return null
    }
  })()
}

export async function refreshFeed(
  feed: FeedRow,
  repos: { feeds: FeedRepository; entries: EntryRepository },
): Promise<RefreshResult> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8' }
  if (feed.fetch_etag) headers['If-None-Match'] = feed.fetch_etag
  if (feed.fetch_last_modified) headers['If-Modified-Since'] = feed.fetch_last_modified

  try {
    const res = await httpRequest({ url: feed.url, headers, timeoutMs: FETCH_TIMEOUT_MS })

    // 304: nothing changed.
    if (res.status === 304) {
      await repos.feeds.update(feed.id, { last_checked_at: new Date().toISOString(), last_error: null })
      return { feedId: feed.id, ok: true, newEntries: 0, notModified: true }
    }

    const parsed = parseFeed(res.text)
    const siteUrl = siteUrlFromFeed(parsed, feed.url)

    // Backfill feed metadata discovered from the document on first successful fetch.
    const patch: Partial<FeedRow> = {
      last_checked_at: new Date().toISOString(),
      last_error: null,
      fetch_etag: res.headers['etag'] ?? feed.fetch_etag,
      fetch_last_modified: res.headers['last-modified'] ?? feed.fetch_last_modified,
    }
    if (!feed.title && parsed.title) patch.title = parsed.title
    if (!feed.site_url && siteUrl) patch.site_url = siteUrl
    if (!feed.description && parsed.description) patch.description = parsed.description
    if (!feed.favicon_url) {
      const icon = selectFeedIcon(parsed, siteUrl, feed.url)
      if (icon) patch.favicon_url = icon
    }
    await repos.feeds.update(feed.id, patch)

    let newEntries = 0
    for (const item of parsed.items) {
      const normalized = normalizeFeedItem(item, feed.url)
      if (!normalized) continue
      normalized.content_type = classifyParsedEntry(normalized)
      const inserted = await repos.entries.insertIfNew(feed.id, normalized)
      if (inserted) newEntries += 1
    }

    return { feedId: feed.id, ok: true, newEntries, notModified: false }
  } catch (err) {
    if (err instanceof HttpError && err.status === 304) {
      await repos.feeds.update(feed.id, { last_checked_at: new Date().toISOString(), last_error: null })
      return { feedId: feed.id, ok: true, newEntries: 0, notModified: true }
    }
    const message = err instanceof Error ? err.message : String(err)
    await repos.feeds.update(feed.id, { last_checked_at: new Date().toISOString(), last_error: message })
    return { feedId: feed.id, ok: false, newEntries: 0, notModified: false, error: message }
  }
}

/** Refresh every subscribed feed with bounded concurrency. */
export async function refreshAllFeeds(repos: {
  feeds: FeedRepository
  entries: EntryRepository
}): Promise<RefreshResult[]> {
  const feeds = await repos.feeds.list()
  const results: RefreshResult[] = []
  await runWithConcurrency(feeds, FEED_REFRESH_CONCURRENCY, async (feed) => {
    results.push(await refreshFeed(feed, repos))
  })
  return results
}
