import type { Database } from '../../platform/db'
import { generateId, nowIso } from '../../utils/id'
import type { EntryRow, NormalizedEntry } from '../models'

export type InboxFilter = 'all' | 'unread' | 'saved'

export interface ListEntriesOptions {
  filter?: InboxFilter
  feedId?: string | null
  groupName?: string | null
  /** Opaque cursor returned by a previous page. */
  cursor?: string | null
  limit?: number
}

export interface EntriesPage {
  items: EntryRow[]
  nextCursor: string | null
  hasMore: boolean
}

interface Cursor {
  t: string // published_at (or inserted_at) ISO
  id: string
}

function encodeCursor(c: Cursor): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c))))
}

function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value)))) as Cursor
  } catch {
    return null
  }
}

export class EntryRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  /**
   * Insert a normalized entry if (feed_id, guid) is new. Returns true if a row
   * was inserted, false if it already existed (dedup). User state (read/starred)
   * on existing rows is never clobbered.
   */
  async insertIfNew(feedId: string, entry: NormalizedEntry): Promise<boolean> {
    const res = await this.db.run(
      `INSERT OR IGNORE INTO entries (
        id, feed_id, guid, title, url, author, summary, content, readability_content,
        categories_json, published_at, inserted_at, read, starred,
        enclosure_url, enclosure_type, enclosure_length, duration, image_url,
        content_type, content_extraction_status, content_source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'skipped', ?)`,
      [
        generateId(),
        feedId,
        entry.guid,
        entry.title ?? null,
        entry.url ?? null,
        entry.author ?? null,
        entry.summary ?? null,
        entry.content ?? null,
        entry.readability_content ?? null,
        entry.categories_json ?? null,
        entry.published_at ?? null,
        nowIso(),
        entry.enclosure_url ?? null,
        entry.enclosure_type ?? null,
        entry.enclosure_length ?? null,
        entry.duration ?? null,
        entry.image_url ?? null,
        entry.content_type ?? null,
        entry.content_source_url ?? null,
      ],
    )
    return res.changes > 0
  }

  async get(id: string): Promise<EntryRow | null> {
    const rows = await this.db.query<EntryRow>(`SELECT * FROM entries WHERE id = ?`, [id])
    return rows[0] ?? null
  }

  async list(options: ListEntriesOptions = {}): Promise<EntriesPage> {
    const limit = Math.min(options.limit ?? 30, 100)
    const where: string[] = []
    const params: unknown[] = []

    if (options.filter === 'unread') where.push('e.read = 0')
    if (options.filter === 'saved') where.push('e.starred = 1')
    if (options.feedId) {
      where.push('e.feed_id = ?')
      params.push(options.feedId)
    }
    if (options.groupName) {
      where.push('f.group_name = ?')
      params.push(options.groupName)
    }

    // Sort key: COALESCE(published_at, inserted_at) DESC, id DESC. Cursor is a
    // keyset on (sortTime, id) so pagination is stable as new rows arrive.
    const cursor = decodeCursor(options.cursor)
    if (cursor) {
      where.push(`(COALESCE(e.published_at, e.inserted_at) < ? OR (COALESCE(e.published_at, e.inserted_at) = ? AND e.id < ?))`)
      params.push(cursor.t, cursor.t, cursor.id)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await this.db.query<EntryRow>(
      `SELECT e.* FROM entries e
       JOIN feeds f ON f.id = e.feed_id
       ${whereSql}
       ORDER BY COALESCE(e.published_at, e.inserted_at) DESC, e.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    )

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const last = items[items.length - 1]
    const nextCursor =
      hasMore && last ? encodeCursor({ t: last.published_at ?? last.inserted_at, id: last.id }) : null

    return { items, nextCursor, hasMore }
  }

  async setRead(id: string, read: boolean): Promise<void> {
    await this.db.run(`UPDATE entries SET read = ? WHERE id = ?`, [read ? 1 : 0, id])
  }

  async setStarred(id: string, starred: boolean): Promise<void> {
    await this.db.run(`UPDATE entries SET starred = ? WHERE id = ?`, [starred ? 1 : 0, id])
  }

  async setReadabilityContent(id: string, html: string, status: string): Promise<void> {
    await this.db.run(
      `UPDATE entries SET readability_content = ?, content_extraction_status = ?, content_extracted_at = ? WHERE id = ?`,
      [html, status, nowIso(), id],
    )
  }

  async unreadCount(feedId?: string): Promise<number> {
    const sql = feedId
      ? `SELECT COUNT(*) AS n FROM entries WHERE read = 0 AND feed_id = ?`
      : `SELECT COUNT(*) AS n FROM entries WHERE read = 0`
    const rows = await this.db.query<{ n: number }>(sql, feedId ? [feedId] : [])
    return rows[0]?.n ?? 0
  }
}
