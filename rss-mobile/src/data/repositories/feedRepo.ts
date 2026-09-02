import type { Database } from '../../platform/db'
import { generateId, nowIso } from '../../utils/id'
import type { FeedCreateInput, FeedRow } from '../models'

export class FeedRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async list(): Promise<FeedRow[]> {
    return this.db.query<FeedRow>(`SELECT * FROM feeds ORDER BY group_name, title COLLATE NOCASE`)
  }

  async get(id: string): Promise<FeedRow | null> {
    const rows = await this.db.query<FeedRow>(`SELECT * FROM feeds WHERE id = ?`, [id])
    return rows[0] ?? null
  }

  async getByUrl(url: string): Promise<FeedRow | null> {
    const rows = await this.db.query<FeedRow>(`SELECT * FROM feeds WHERE url = ?`, [url])
    return rows[0] ?? null
  }

  /** Create a feed, or return the existing one if the URL is already subscribed. */
  async create(input: FeedCreateInput): Promise<FeedRow> {
    const existing = await this.getByUrl(input.url)
    if (existing) return existing

    const now = nowIso()
    const id = generateId()
    await this.db.run(
      `INSERT INTO feeds (id, url, title, site_url, description, favicon_url, group_name, view_type, update_interval_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.url,
        input.title ?? null,
        input.site_url ?? null,
        input.description ?? null,
        input.favicon_url ?? null,
        input.group_name ?? 'default',
        input.view_type ?? 'articles',
        60,
        now,
        now,
      ],
    )
    return (await this.get(id))!
  }

  async update(id: string, patch: Partial<FeedRow>): Promise<void> {
    const allowed: (keyof FeedRow)[] = [
      'title',
      'custom_title',
      'site_url',
      'description',
      'favicon_url',
      'group_name',
      'view_type',
      'last_checked_at',
      'last_error',
      'fetch_etag',
      'fetch_last_modified',
      'update_interval_minutes',
    ]
    const cols: string[] = []
    const params: unknown[] = []
    for (const key of allowed) {
      if (key in patch) {
        cols.push(`${key} = ?`)
        params.push(patch[key] ?? null)
      }
    }
    if (!cols.length) return
    cols.push(`updated_at = ?`)
    params.push(nowIso(), id)
    await this.db.run(`UPDATE feeds SET ${cols.join(', ')} WHERE id = ?`, params)
  }

  async remove(id: string): Promise<void> {
    await this.db.run(`DELETE FROM entry_tags WHERE entry_id IN (SELECT id FROM entries WHERE feed_id = ?)`, [id])
    await this.db.run(`DELETE FROM summaries WHERE entry_id IN (SELECT id FROM entries WHERE feed_id = ?)`, [id])
    await this.db.run(`DELETE FROM translations WHERE entry_id IN (SELECT id FROM entries WHERE feed_id = ?)`, [id])
    await this.db.run(`DELETE FROM entries WHERE feed_id = ?`, [id])
    await this.db.run(`DELETE FROM feeds WHERE id = ?`, [id])
  }

  async groups(): Promise<string[]> {
    const rows = await this.db.query<{ group_name: string | null }>(
      `SELECT DISTINCT group_name FROM feeds WHERE group_name IS NOT NULL ORDER BY group_name`,
    )
    return rows.map((r) => r.group_name!).filter(Boolean)
  }
}
