/**
 * Entry Adapter Utility
 *
 * Normalizes CollectionEntry and TagEntry types into the standard Entry type
 * used by TimelinePanel and DetailsPanel, enabling unified rendering.
 */

import type { Entry } from '../types'
import type { CollectionEntry } from '../stores/collectionsStore'
import type { TagEntry } from '../stores/tagsStore'
import type { SearchResult } from '../stores/searchStore'

/**
 * Convert a CollectionEntry to the standard Entry type.
 * - Ensures read/starred are booleans (API may return numbers)
 * - Fills missing optional fields with null
 */
export function collectionEntryToEntry(ce: CollectionEntry): Entry {
  return {
    id: ce.id,
    feed_id: ce.feed_id,
    feed_title: ce.feed_title ?? null,
    title: ce.title ?? null,
    url: ce.url ?? null,
    author: null,
    summary: ce.summary,
    content: ce.content,
    published_at: ce.published_at,
    inserted_at: ce.inserted_at ?? null,
    read: typeof ce.read === 'boolean' ? ce.read : !!(ce.read as unknown),
    starred: typeof ce.starred === 'boolean' ? ce.starred : !!(ce.starred as unknown),
  }
}

/**
 * Convert a TagEntry to the standard Entry type.
 * - Maps is_read/is_starred (numbers) to read/starred (booleans)
 * - Fills missing optional fields with null
 */
export function tagEntryToEntry(te: TagEntry): Entry {
  return {
    id: te.id,
    feed_id: te.feed_id,
    feed_title: te.feed_title ?? null,
    title: te.title ?? null,
    url: te.url ?? null,
    author: null,
    summary: te.summary,
    content: te.content,
    published_at: te.published_at,
    inserted_at: te.inserted_at ?? null,
    read: !!te.is_read,
    starred: !!te.is_starred,
  }
}

/**
 * Convert a SearchResult to the standard Entry type.
 * - SearchResult has limited fields; fills the rest with defaults
 */
export function searchResultToEntry(sr: SearchResult): Entry {
  return {
    id: sr.id,
    feed_id: sr.feed_id,
    feed_title: sr.feed_title ?? null,
    title: sr.title ?? null,
    url: sr.url ?? null,
    author: null,
    summary: sr.content ?? null,
    content: sr.content ?? null,
    published_at: sr.published_at,
    inserted_at: null,
    read: false,
    starred: false,
  }
}
