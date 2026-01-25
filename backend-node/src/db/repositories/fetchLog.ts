import { getDatabase } from '../session.js';
import { FetchLog, generateId } from '../models.js';

export interface FetchLogCreateInput {
  feed_id?: string | null;
  status?: string;
  message?: string | null;
}

export interface FetchLogUpdateInput {
  status?: string;
  message?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  item_count?: number;
}

export class FetchLogRepository {
  private db = getDatabase();

  create(input: FetchLogCreateInput): FetchLog {
    const now = new Date().toISOString();
    const fetchLog: FetchLog = {
      id: generateId(),
      feed_id: input.feed_id ?? null,
      status: input.status ?? 'pending',
      message: input.message ?? null,
      started_at: now,
      finished_at: null,
      duration_ms: null,
      item_count: 0,
    };

    const stmt = this.db.prepare(`
      INSERT INTO fetch_logs (
        id, feed_id, status, message, started_at, finished_at, duration_ms, item_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fetchLog.id,
      fetchLog.feed_id,
      fetchLog.status,
      fetchLog.message,
      fetchLog.started_at,
      fetchLog.finished_at,
      fetchLog.duration_ms,
      fetchLog.item_count
    );

    return fetchLog;
  }

  findById(id: string): FetchLog | null {
    const stmt = this.db.prepare('SELECT * FROM fetch_logs WHERE id = ?');
    const row = stmt.get(id) as FetchLog | undefined;
    return row ?? null;
  }

  findByFeedId(feedId: string, limit?: number): FetchLog[] {
    let query = 'SELECT * FROM fetch_logs WHERE feed_id = ? ORDER BY started_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const stmt = this.db.prepare(query);
    return stmt.all(feedId) as FetchLog[];
  }

  findAll(limit?: number): FetchLog[] {
    let query = 'SELECT * FROM fetch_logs ORDER BY started_at DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const stmt = this.db.prepare(query);
    return stmt.all() as FetchLog[];
  }

  update(id: string, input: FetchLogUpdateInput): FetchLog | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: FetchLog = {
      ...existing,
      status: input.status !== undefined ? input.status : existing.status,
      message: input.message !== undefined ? input.message : existing.message,
      finished_at: input.finished_at !== undefined ? input.finished_at : existing.finished_at,
      duration_ms: input.duration_ms !== undefined ? input.duration_ms : existing.duration_ms,
      item_count: input.item_count !== undefined ? input.item_count : existing.item_count,
    };

    const stmt = this.db.prepare(`
      UPDATE fetch_logs SET
        status = ?, message = ?, finished_at = ?, duration_ms = ?, item_count = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.status,
      updated.message,
      updated.finished_at,
      updated.duration_ms,
      updated.item_count,
      id
    );

    return updated;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM fetch_logs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
