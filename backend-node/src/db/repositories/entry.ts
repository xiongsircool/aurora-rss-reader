import { getDatabase } from '../session.js';
import { Entry, generateId } from '../models.js';

export interface EntryCreateInput {
  feed_id: string;
  guid: string;
  title?: string | null;
  url?: string | null;
  title_translations?: Record<string, string> | null;
  author?: string | null;
  summary?: string | null;
  content?: string | null;
  readability_content?: string | null;
  categories_json?: string | null;
  published_at?: string | null;
  // Enclosure fields for audio/video
  enclosure_url?: string | null;
  enclosure_type?: string | null;
  enclosure_length?: number | null;
  duration?: string | null;
  image_url?: string | null;
  // Academic article identifiers
  doi?: string | null;
  pmid?: string | null;
}

export interface EntryUpdateInput {
  title?: string | null;
  url?: string | null;
  title_translations?: Record<string, string> | null;
  author?: string | null;
  summary?: string | null;
  content?: string | null;
  readability_content?: string | null;
  categories_json?: string | null;
  published_at?: string | null;
  read?: boolean;
  starred?: boolean;
}

export class EntryRepository {
  private db = getDatabase();

  create(input: EntryCreateInput): Entry {
    const now = new Date().toISOString();
    const entry: Entry = {
      id: generateId(),
      feed_id: input.feed_id,
      guid: input.guid,
      title: input.title ?? null,
      url: input.url ?? null,
      title_translations: input.title_translations ? JSON.stringify(input.title_translations) : null,
      author: input.author ?? null,
      summary: input.summary ?? null,
      content: input.content ?? null,
      readability_content: input.readability_content ?? null,
      categories_json: input.categories_json ?? null,
      published_at: input.published_at ?? null,
      inserted_at: now,
      read: 0,
      starred: 0,
      enclosure_url: input.enclosure_url ?? null,
      enclosure_type: input.enclosure_type ?? null,
      enclosure_length: input.enclosure_length ?? null,
      duration: input.duration ?? null,
      image_url: input.image_url ?? null,
      doi: input.doi ?? null,
      pmid: input.pmid ?? null,
    };

    const stmt = this.db.prepare(`
      INSERT INTO entries (
        id, feed_id, guid, title, url, title_translations, author,
        summary, content, readability_content, categories_json,
        published_at, inserted_at, read, starred,
        enclosure_url, enclosure_type, enclosure_length, duration, image_url,
        doi, pmid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.feed_id,
      entry.guid,
      entry.title,
      entry.url,
      entry.title_translations,
      entry.author,
      entry.summary,
      entry.content,
      entry.readability_content,
      entry.categories_json,
      entry.published_at,
      entry.inserted_at,
      entry.read,
      entry.starred,
      entry.enclosure_url,
      entry.enclosure_type,
      entry.enclosure_length,
      entry.duration,
      entry.image_url,
      entry.doi,
      entry.pmid
    );

    return entry;
  }

  findById(id: string): Entry | null {
    const stmt = this.db.prepare('SELECT * FROM entries WHERE id = ?');
    const row = stmt.get(id) as Entry | undefined;
    return row ?? null;
  }

  findByFeedIdAndGuid(feedId: string, guid: string): Entry | null {
    const stmt = this.db.prepare('SELECT * FROM entries WHERE feed_id = ? AND guid = ?');
    const row = stmt.get(feedId, guid) as Entry | undefined;
    return row ?? null;
  }

  findByFeedId(feedId: string, limit?: number, offset?: number): Entry[] {
    let query = 'SELECT * FROM entries WHERE feed_id = ? ORDER BY published_at DESC, inserted_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }
    const stmt = this.db.prepare(query);
    return stmt.all(feedId) as Entry[];
  }

  findAll(limit?: number, offset?: number): Entry[] {
    let query = 'SELECT * FROM entries ORDER BY published_at DESC, inserted_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }
    const stmt = this.db.prepare(query);
    return stmt.all() as Entry[];
  }

  findUnread(limit?: number, offset?: number): Entry[] {
    let query = 'SELECT * FROM entries WHERE read = 0 ORDER BY published_at DESC, inserted_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }
    const stmt = this.db.prepare(query);
    return stmt.all() as Entry[];
  }

  findStarred(limit?: number, offset?: number): Entry[] {
    let query = 'SELECT * FROM entries WHERE starred = 1 ORDER BY published_at DESC, inserted_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
      if (offset) {
        query += ` OFFSET ${offset}`;
      }
    }
    const stmt = this.db.prepare(query);
    return stmt.all() as Entry[];
  }

  update(id: string, input: EntryUpdateInput): Entry | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Entry = {
      ...existing,
      title: input.title !== undefined ? input.title : existing.title,
      url: input.url !== undefined ? input.url : existing.url,
      title_translations: input.title_translations !== undefined
        ? (input.title_translations ? JSON.stringify(input.title_translations) : null)
        : existing.title_translations,
      author: input.author !== undefined ? input.author : existing.author,
      summary: input.summary !== undefined ? input.summary : existing.summary,
      content: input.content !== undefined ? input.content : existing.content,
      readability_content: input.readability_content !== undefined ? input.readability_content : existing.readability_content,
      categories_json: input.categories_json !== undefined ? input.categories_json : existing.categories_json,
      published_at: input.published_at !== undefined ? input.published_at : existing.published_at,
      read: input.read !== undefined ? (input.read ? 1 : 0) : existing.read,
      starred: input.starred !== undefined ? (input.starred ? 1 : 0) : existing.starred,
    };

    const stmt = this.db.prepare(`
      UPDATE entries SET
        title = ?, url = ?, title_translations = ?, author = ?,
        summary = ?, content = ?, readability_content = ?,
        categories_json = ?, published_at = ?, read = ?, starred = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.title,
      updated.url,
      updated.title_translations,
      updated.author,
      updated.summary,
      updated.content,
      updated.readability_content,
      updated.categories_json,
      updated.published_at,
      updated.read,
      updated.starred,
      id
    );

    return updated;
  }

  markAsRead(id: string): boolean {
    const stmt = this.db.prepare('UPDATE entries SET read = 1 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  markAsUnread(id: string): boolean {
    const stmt = this.db.prepare('UPDATE entries SET read = 0 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  toggleStar(id: string): boolean {
    const stmt = this.db.prepare('UPDATE entries SET starred = NOT starred WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM entries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM entries');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countUnread(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM entries WHERE read = 0');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countStarred(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM entries WHERE starred = 1');
    const row = stmt.get() as { count: number };
    return row.count;
  }
}
