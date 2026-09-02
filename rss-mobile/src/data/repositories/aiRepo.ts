import type { Database } from '../../platform/db'
import { generateId, nowIso } from '../../utils/id'

export interface SummaryRow {
  id: string
  entry_id: string
  language: string
  content: string
  model: string | null
  created_at: string
}

export interface TranslationRow {
  id: string
  entry_id: string
  language: string
  title: string | null
  content: string | null
  model: string | null
  created_at: string
}

/** Cache of AI summaries, keyed by (entry_id, language). */
export class SummaryRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async get(entryId: string, language: string): Promise<SummaryRow | null> {
    const rows = await this.db.query<SummaryRow>(
      `SELECT * FROM summaries WHERE entry_id = ? AND language = ?`,
      [entryId, language],
    )
    return rows[0] ?? null
  }

  /** Insert or replace the cached summary for an entry+language. */
  async upsert(entryId: string, language: string, content: string, model: string | null): Promise<void> {
    await this.db.run(
      `INSERT INTO summaries (id, entry_id, language, content, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(entry_id, language) DO UPDATE SET content = excluded.content, model = excluded.model, created_at = excluded.created_at`,
      [generateId(), entryId, language, content, model, nowIso()],
    )
  }
}

/** Cache of AI translations, keyed by (entry_id, language). */
export class TranslationRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async get(entryId: string, language: string): Promise<TranslationRow | null> {
    const rows = await this.db.query<TranslationRow>(
      `SELECT * FROM translations WHERE entry_id = ? AND language = ?`,
      [entryId, language],
    )
    return rows[0] ?? null
  }

  async upsert(
    entryId: string,
    language: string,
    fields: { title?: string | null; content?: string | null },
    model: string | null,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO translations (id, entry_id, language, title, content, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entry_id, language) DO UPDATE SET title = excluded.title, content = excluded.content, model = excluded.model, created_at = excluded.created_at`,
      [generateId(), entryId, language, fields.title ?? null, fields.content ?? null, model, nowIso()],
    )
  }
}
