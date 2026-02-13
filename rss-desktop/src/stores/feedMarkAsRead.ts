/**
 * Feed Mark-As-Read Utilities
 *
 * Extracted from feedStore: pure helper functions for determining
 * which entries to mark as read based on date/time criteria.
 */

import type { Entry } from '../types'

export interface MarkAsReadOptions {
  feedId?: string
  groupName?: string
  olderThan?: string
  timeField?: string
}

export interface MarkAsReadResult {
  success: boolean
  message: string
  marked_count: number
  feed_counts: Record<string, number>
}

export function parseOlderThan(olderThan?: string | null): Date | null {
  if (!olderThan) return null
  if (olderThan === 'all' || olderThan === 'current') return null
  const match = olderThan.match(/^(\d+)([hdmy])$/)
  const now = Date.now()
  if (!match) {
    return new Date(now - 30 * 24 * 60 * 60 * 1000)
  }
  const value = Number(match[1])
  const unit = match[2]
  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs
  let deltaMs = dayMs * 30
  if (unit === 'h') deltaMs = value * hourMs
  if (unit === 'd') deltaMs = value * dayMs
  if (unit === 'm') deltaMs = value * dayMs * 30
  if (unit === 'y') deltaMs = value * dayMs * 365
  return new Date(now - deltaMs)
}

export function parseEntryDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function shouldMarkEntryRead(
  entry: Entry,
  cutoff: Date | null,
  timeField: string,
  feedId?: string,
): boolean {
  if (feedId && entry.feed_id !== feedId) return false
  if (!cutoff) return true
  const insertedAt = parseEntryDate(entry.inserted_at)
  if (timeField === 'published_at') {
    const publishedAt = parseEntryDate(entry.published_at)
    if (publishedAt) return publishedAt <= cutoff
    return insertedAt ? insertedAt <= cutoff : false
  }
  return insertedAt ? insertedAt <= cutoff : false
}
