import { getDatabase } from '../session.js';
import { Feed, generateId, ViewType } from '../models.js';

export interface FeedCreateInput {
  url: string;
  title?: string | null;
  site_url?: string | null;
  description?: string | null;
  favicon_url?: string | null;
  group_name?: string;
  view_type?: ViewType;
  update_interval_minutes?: number;
}

export interface FeedUpdateInput {
  url?: string;
  title?: string | null;
  site_url?: string | null;
  description?: string | null;
  favicon_url?: string | null;
  group_name?: string;
  view_type?: ViewType;
  last_checked_at?: string | null;
  last_error?: string | null;
  update_interval_minutes?: number;
}

export class FeedRepository {
  private db = getDatabase();

  create(input: FeedCreateInput): Feed {
    const now = new Date().toISOString();
    const feed: Feed = {
      id: generateId(),
      url: input.url,
      title: input.title ?? null,
      site_url: input.site_url ?? null,
      description: input.description ?? null,
      favicon_url: input.favicon_url ?? null,
      group_name: input.group_name ?? 'default',
      view_type: input.view_type ?? 'articles',
      last_checked_at: null,
      last_error: null,
      update_interval_minutes: input.update_interval_minutes ?? 60,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO feeds (
        id, url, title, site_url, description, favicon_url,
        group_name, view_type, last_checked_at, last_error, update_interval_minutes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      feed.id,
      feed.url,
      feed.title,
      feed.site_url,
      feed.description,
      feed.favicon_url,
      feed.group_name,
      feed.view_type,
      feed.last_checked_at,
      feed.last_error,
      feed.update_interval_minutes,
      feed.created_at,
      feed.updated_at
    );

    return feed;
  }

  findById(id: string): Feed | null {
    const stmt = this.db.prepare('SELECT * FROM feeds WHERE id = ?');
    const row = stmt.get(id) as Feed | undefined;
    return row ?? null;
  }

  findByUrl(url: string): Feed | null {
    const stmt = this.db.prepare('SELECT * FROM feeds WHERE url = ?');
    const row = stmt.get(url) as Feed | undefined;
    return row ?? null;
  }

  findAll(): Feed[] {
    const stmt = this.db.prepare('SELECT * FROM feeds ORDER BY created_at DESC');
    return stmt.all() as Feed[];
  }

  findByGroupName(groupName: string): Feed[] {
    const stmt = this.db.prepare('SELECT * FROM feeds WHERE group_name = ? ORDER BY created_at DESC');
    return stmt.all(groupName) as Feed[];
  }

  update(id: string, input: FeedUpdateInput): Feed | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Feed = {
      ...existing,
      ...input,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE feeds SET
        url = ?,
        title = ?,
        site_url = ?,
        description = ?,
        favicon_url = ?,
        group_name = ?,
        view_type = ?,
        last_checked_at = ?,
        last_error = ?,
        update_interval_minutes = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.url,
      updated.title,
      updated.site_url,
      updated.description,
      updated.favicon_url,
      updated.group_name,
      updated.view_type,
      updated.last_checked_at,
      updated.last_error,
      updated.update_interval_minutes,
      updated.updated_at,
      id
    );

    return updated;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM feeds WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM feeds');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  countByGroupName(groupName: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM feeds WHERE group_name = ?');
    const row = stmt.get(groupName) as { count: number };
    return row.count;
  }

  findByViewType(viewType: ViewType): Feed[] {
    const stmt = this.db.prepare('SELECT * FROM feeds WHERE view_type = ? ORDER BY created_at DESC');
    return stmt.all(viewType) as Feed[];
  }

  countByViewType(viewType: ViewType): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM feeds WHERE view_type = ?');
    const row = stmt.get(viewType) as { count: number };
    return row.count;
  }
}
