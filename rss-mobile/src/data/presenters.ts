/**
 * Map database rows to the UI view-model types the components already consume
 * (InboxEntry / ReaderEntry / SourceItem). Keeps the on-device data layer
 * compatible with the existing Vue components.
 */
import type { EntryRow, FeedRow } from './models'
import { buildEntryPresentation, type EntryPresentationInput } from '../domain/entryPresentation'
import type { EntryContentType } from '../domain/contentType'
import type { InboxEntry, ReaderEntry, SourceItem } from '../types'

function feedDisplayTitle(feed: Pick<FeedRow, 'custom_title' | 'title' | 'url'>): string | null {
  return feed.custom_title || feed.title || feed.url || null
}

function toPresentationInput(entry: EntryRow, feed?: FeedRow | null): EntryPresentationInput {
  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    summary: entry.summary,
    content: entry.content,
    readability_content: entry.readability_content,
    enclosure_url: entry.enclosure_url,
    enclosure_type: entry.enclosure_type,
    duration: entry.duration,
    image_url: entry.image_url,
    content_extraction_status: entry.content_extraction_status,
    content_source_url: entry.content_source_url,
    feed_url: feed?.url ?? null,
    feed_site_url: feed?.site_url ?? null,
    feed_view_type: feed?.view_type ?? null,
  }
}

/** Build the lightweight inbox row for a list. Uses the stored content_type hint. */
export function toInboxEntry(entry: EntryRow, feed: FeedRow | null): InboxEntry {
  const presentation = buildEntryPresentation(toPresentationInput(entry, feed))
  const contentType = (entry.content_type as EntryContentType | null) ?? presentation.content_type
  return {
    id: entry.id,
    feed_id: entry.feed_id,
    feed_title: feed ? feedDisplayTitle(feed) : null,
    feed_group_name: feed?.group_name ?? null,
    feed_favicon_url: feed?.favicon_url ?? null,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    preview_text: presentation.preview_text,
    published_at: entry.published_at,
    inserted_at: entry.inserted_at,
    read: entry.read === 1,
    starred: entry.starred === 1,
    content_type: contentType,
    lead_image_url: presentation.lead_image_url,
    image_count: presentation.images.length,
    video: presentation.video
      ? { thumbnail_url: presentation.video.thumbnail_url, duration: presentation.video.duration, platform: presentation.video.platform }
      : null,
    reading_time_minutes: presentation.reading_time_minutes,
    extraction_status: presentation.extraction_status,
  }
}

/** Build the full reader view-model for an opened entry. */
export function toReaderEntry(entry: EntryRow, feed: FeedRow | null, aiSummary: string | null): ReaderEntry {
  const presentation = buildEntryPresentation(toPresentationInput(entry, feed))
  return {
    id: entry.id,
    feed_id: entry.feed_id,
    feed_title: feed ? feedDisplayTitle(feed) : null,
    feed_group_name: feed?.group_name ?? null,
    feed_favicon_url: feed?.favicon_url ?? null,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    summary: entry.summary,
    content: entry.content,
    readability_content: entry.readability_content,
    published_at: entry.published_at,
    inserted_at: entry.inserted_at,
    read: entry.read === 1,
    starred: entry.starred === 1,
    ai_summary: aiSummary,
    presentation,
  }
}

export function toSourceItem(feed: FeedRow, unreadCount: number): SourceItem {
  return {
    id: feed.id,
    url: feed.url,
    title: feedDisplayTitle(feed),
    group_name: feed.group_name ?? 'default',
    favicon_url: feed.favicon_url,
    view_type: feed.view_type ?? 'articles',
    unread_count: unreadCount,
    last_checked_at: feed.last_checked_at,
    last_error: feed.last_error,
    enabled: true,
    source_label: feed.url.includes('rsshub') ? 'RSSHub' : 'Auto-detected',
  }
}
