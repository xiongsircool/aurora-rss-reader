/**
 * Entries API Routes
 */

import { FastifyInstance } from 'fastify';
import { EntryRepository, FeedRepository, TranslationRepository } from '../db/repositories/index.js';
import { getDatabase } from '../db/session.js';
import { cleanHtmlText } from '../utils/text.js';
import { normalizeTimeField, parseRelativeTime } from '../utils/dateRange.js';
import { userSettingsService } from '../services/userSettings.js';

type CursorPayload = { t: string; id: string };

function entryPreviewSummary(entry: { summary?: string | null; content?: string | null }): string | null {
  return cleanHtmlText(entry.summary) || cleanHtmlText(entry.content);
}

function normalizeEntry(row: any, translationRepo: TranslationRepository, targetLanguage: string) {
  const entry = {
    id: row.id,
    feed_id: row.feed_id,
    feed_title: row.feed_title ?? null,
    title: row.title ?? null,
    url: row.url ?? null,
    author: row.author ?? null,
    summary: entryPreviewSummary(row),
    content: row.content ?? null,
    readability_content: row.readability_content ?? null,
    published_at: row.published_at ?? null,
    inserted_at: row.inserted_at ?? null,
    read: !!row.read,
    starred: !!row.starred,
    translated_title: null as string | null,
    translated_summary: null as string | null,
    // Enclosure fields for audio/video
    enclosure_url: row.enclosure_url ?? null,
    enclosure_type: row.enclosure_type ?? null,
    enclosure_length: row.enclosure_length ?? null,
    duration: row.duration ?? null,
    image_url: row.image_url ?? null,
    // Academic article identifiers
    doi: row.doi ?? null,
    pmid: row.pmid ?? null,
  };

  // Fetch translation if available
  const translation = translationRepo.findByEntryIdAndLanguage(row.id, targetLanguage);
  if (translation) {
    entry.translated_title = translation.title;
    entry.translated_summary = translation.summary ? cleanHtmlText(translation.summary) : null;
  }

  return entry;
}

function encodeCursor(timeIso: string, id: string): string {
  const payload: CursorPayload = { t: timeIso, id };
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
  const payload = JSON.parse(raw) as CursorPayload;
  if (!payload?.t || !payload?.id) {
    throw new Error('Invalid cursor');
  }
  return payload;
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export async function entriesRoutes(app: FastifyInstance) {
  const entryRepo = new EntryRepository();
  const feedRepo = new FeedRepository();
  const translationRepo = new TranslationRepository();
  const db = getDatabase();
  const sortTimeExpr = 'COALESCE(entries.published_at, entries.inserted_at)';

  // GET /entries - List entries with filters
  app.get('/entries', async (request, reply) => {
    const query = request.query as {
      feed_id?: string;
      group_name?: string;
      view_type?: string;
      unread_only?: string | boolean;
      limit?: string;
      offset?: string;
      cursor?: string;
      date_range?: string;
      time_field?: string;
    };

    const feedId = query.feed_id ?? null;
    const groupName = feedId ? null : query.group_name ?? null;
    const viewType = feedId || groupName ? null : query.view_type ?? null;
    const unreadOnly = parseBoolean(query.unread_only);

    const settings = userSettingsService.getSettings();
    const parsedLimit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const fallbackLimit = parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : settings.items_per_page;
    const limit = Math.max(1, Math.min(fallbackLimit, 200));

    const parsedOffset = query.offset ? Number.parseInt(query.offset, 10) : 0;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const timeField = normalizeTimeField(query.time_field);
    const cutoff = parseRelativeTime(query.date_range);

    let cursorPayload: CursorPayload | null = null;
    if (query.cursor) {
      try {
        cursorPayload = decodeCursor(query.cursor);
      } catch (error) {
        return reply.code(400).send({ error: 'Invalid cursor' });
      }
    }

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (feedId) {
      where.push('entries.feed_id = ?');
      params.push(feedId);
    } else if (groupName) {
      where.push('feeds.group_name = ?');
      params.push(groupName);
    } else if (viewType) {
      where.push('feeds.view_type = ?');
      params.push(viewType);
    }

    if (unreadOnly) {
      where.push('entries.read = 0');
    }

    if (cutoff) {
      const cutoffIso = cutoff.toISOString();
      if (timeField === 'published_at') {
        const nowIso = new Date().toISOString();
        where.push(
          '((entries.published_at IS NOT NULL AND entries.published_at <= ? AND entries.published_at >= ?) OR (entries.published_at IS NULL AND entries.inserted_at >= ?))'
        );
        params.push(nowIso, cutoffIso, cutoffIso);
      } else {
        where.push('entries.inserted_at >= ?');
        params.push(cutoffIso);
      }
    }

    if (cursorPayload) {
      where.push(`(${sortTimeExpr} < ? OR (${sortTimeExpr} = ? AND entries.id < ?))`);
      params.push(cursorPayload.t, cursorPayload.t, cursorPayload.id);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const fetchLimit = limit + 1;

    let sql = `
      SELECT entries.*, feeds.title AS feed_title
      FROM entries
      JOIN feeds ON feeds.id = entries.feed_id
      ${whereClause}
      ORDER BY ${sortTimeExpr} DESC, entries.id DESC
      LIMIT ?
    `;

    params.push(fetchLimit);

    if (!cursorPayload) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    const rows = db.prepare(sql).all(...params) as any[];
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);

    // Get user's translation language preference (settings already declared above)
    const targetLanguage = settings.ai_translation_language || 'zh';

    const items = pageRows.map(row => normalizeEntry(row, translationRepo, targetLanguage));

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      const cursorTime = last.published_at || last.inserted_at;
      if (cursorTime) {
        nextCursor = encodeCursor(cursorTime, last.id);
      }
    }

    return {
      items,
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  });

  // GET /entries/:id - Get a single entry
  app.get('/entries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare(
      `SELECT entries.*, feeds.title AS feed_title
       FROM entries
       JOIN feeds ON feeds.id = entries.feed_id
       WHERE entries.id = ?`
    ).get(id) as any;

    if (!row) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    const settings = userSettingsService.getSettings();
    const targetLanguage = settings.ai_translation_language || 'zh';

    return normalizeEntry(row, translationRepo, targetLanguage);
  });

  // PATCH /entries/:id - Update entry state
  app.patch('/entries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as { read?: boolean; starred?: boolean };

    const entry = entryRepo.update(id, {
      read: updates.read,
      starred: updates.starred,
    });

    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    const feed = feedRepo.findById(entry.feed_id);
    const settings = userSettingsService.getSettings();
    const targetLanguage = settings.ai_translation_language || 'zh';

    return normalizeEntry({ ...entry, feed_title: feed?.title ?? null }, translationRepo, targetLanguage);
  });

  // POST /entries/:id/read - Mark entry as read
  app.post('/entries/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = entryRepo.markAsRead(id);

    if (!success) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true };
  });

  // POST /entries/:id/unread - Mark entry as unread
  app.post('/entries/:id/unread', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = entryRepo.markAsUnread(id);

    if (!success) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true };
  });

  // POST /entries/:id/star - Mark entry as starred
  app.post('/entries/:id/star', async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = entryRepo.update(id, { starred: true });

    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true, message: 'Entry starred' };
  });

  // DELETE /entries/:id/star - Unstar entry
  app.delete('/entries/:id/star', async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = entryRepo.update(id, { starred: false });

    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true, message: 'Entry unstarred' };
  });

  // GET /entries/starred - List starred entries
  app.get('/entries/starred', async (request) => {
    const query = request.query as {
      feed_id?: string;
      limit?: string;
      offset?: string;
      date_range?: string;
      time_field?: string;
    };

    const feedId = query.feed_id ?? null;
    const parsedLimit = query.limit ? Number.parseInt(query.limit, 10) : 50;
    const limit = Math.max(1, Math.min(parsedLimit, 200));
    const parsedOffset = query.offset ? Number.parseInt(query.offset, 10) : 0;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const timeField = normalizeTimeField(query.time_field);
    const cutoff = parseRelativeTime(query.date_range);

    const where: string[] = ['entries.starred = 1'];
    const params: Array<string | number> = [];

    if (feedId) {
      where.push('entries.feed_id = ?');
      params.push(feedId);
    }

    if (cutoff) {
      const cutoffIso = cutoff.toISOString();
      if (timeField === 'published_at') {
        const nowIso = new Date().toISOString();
        where.push(
          '((entries.published_at IS NOT NULL AND entries.published_at <= ? AND entries.published_at >= ?) OR (entries.published_at IS NULL AND entries.inserted_at >= ?))'
        );
        params.push(nowIso, cutoffIso, cutoffIso);
      } else {
        where.push('entries.inserted_at >= ?');
        params.push(cutoffIso);
      }
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const sql = `
      SELECT entries.*, feeds.title AS feed_title
      FROM entries
      JOIN feeds ON feeds.id = entries.feed_id
      ${whereClause}
      ORDER BY entries.inserted_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const rows = db.prepare(sql).all(...params) as any[];

    const settings = userSettingsService.getSettings();
    const targetLanguage = settings.ai_translation_language || 'zh';

    return rows.map(row => normalizeEntry(row, translationRepo, targetLanguage));
  });

  // GET /entries/starred/stats - Starred stats
  app.get('/entries/starred/stats', async () => {
    const totalRow = db.prepare(
      'SELECT COUNT(*) as count FROM entries WHERE starred = 1'
    ).get() as { count: number };

    const feedRows = db.prepare(
      `SELECT feeds.id AS feed_id, feeds.title AS feed_title, feeds.group_name AS group_name, COUNT(entries.id) AS count
       FROM feeds
       JOIN entries ON feeds.id = entries.feed_id
       WHERE entries.starred = 1
       GROUP BY feeds.id, feeds.title, feeds.group_name`
    ).all() as Array<{ feed_id: string; feed_title: string | null; group_name: string | null; count: number }>;

    const groupRows = db.prepare(
      `SELECT feeds.group_name AS group_name, COUNT(entries.id) AS count
       FROM feeds
       JOIN entries ON feeds.id = entries.feed_id
       WHERE entries.starred = 1
       GROUP BY feeds.group_name`
    ).all() as Array<{ group_name: string | null; count: number }>;

    const byFeed: Record<string, { title: string | null; group_name?: string | null; starred_count: number }> = {};
    for (const row of feedRows) {
      byFeed[row.feed_id] = {
        title: row.feed_title,
        group_name: row.group_name ?? undefined,
        starred_count: row.count,
      };
    }

    const byGroup: Record<string, number> = {};
    for (const row of groupRows) {
      if (row.group_name) {
        byGroup[row.group_name] = row.count;
      }
    }

    return {
      total_starred: totalRow?.count ?? 0,
      by_feed: byFeed,
      by_group: byGroup,
    };
  });

  // POST /entries/bulk-star - Bulk star entries
  app.post('/entries/bulk-star', async (request, reply) => {
    const entryIds = request.body as string[] | undefined;
    const ids = Array.isArray(entryIds) ? entryIds.filter(Boolean) : [];

    if (ids.length === 0) {
      return reply.code(400).send({ error: 'Entry IDs are required' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const sql = `UPDATE entries SET starred = 1 WHERE id IN (${placeholders})`;
    const result = db.prepare(sql).run(...ids);

    return { success: true, message: `Starred ${result.changes} entries`, starred_count: result.changes };
  });

  // POST /entries/bulk-unstar - Bulk unstar entries
  app.post('/entries/bulk-unstar', async (request, reply) => {
    const entryIds = request.body as string[] | undefined;
    const ids = Array.isArray(entryIds) ? entryIds.filter(Boolean) : [];

    if (ids.length === 0) {
      return reply.code(400).send({ error: 'Entry IDs are required' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const sql = `UPDATE entries SET starred = 0 WHERE id IN (${placeholders})`;
    const result = db.prepare(sql).run(...ids);

    return { success: true, message: `Unstarred ${result.changes} entries`, unstarred_count: result.changes };
  });

  // POST /entries/mark-read - Bulk mark as read
  app.post('/entries/mark-read', async (request, reply) => {
    const body = request.body as {
      feed_id?: string | null;
      group_name?: string | null;
      older_than?: string | null;
      time_field?: string | null;
    };

    const timeField = normalizeTimeField(body?.time_field);
    const cutoff = parseRelativeTime(body?.older_than);

    const where: string[] = ['entries.read = 0'];
    const params: Array<string | number> = [];

    if (body?.feed_id) {
      where.push('entries.feed_id = ?');
      params.push(body.feed_id);
    } else if (body?.group_name) {
      where.push('feeds.group_name = ?');
      params.push(body.group_name);
    }

    if (cutoff) {
      const cutoffIso = cutoff.toISOString();
      if (timeField === 'published_at') {
        where.push(
          '(entries.published_at <= ? OR (entries.published_at IS NULL AND entries.inserted_at <= ?))'
        );
        params.push(cutoffIso, cutoffIso);
      } else {
        where.push('entries.inserted_at <= ?');
        params.push(cutoffIso);
      }
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const selectSql = `
      SELECT entries.id, entries.feed_id
      FROM entries
      JOIN feeds ON feeds.id = entries.feed_id
      ${whereClause}
    `;

    const rows = db.prepare(selectSql).all(...params) as Array<{ id: string; feed_id: string }>;

    if (rows.length === 0) {
      return {
        success: true,
        message: 'No entries to mark as read',
        marked_count: 0,
        feed_counts: {},
      };
    }

    const feedCounts: Record<string, number> = {};
    for (const row of rows) {
      feedCounts[row.feed_id] = (feedCounts[row.feed_id] || 0) + 1;
    }

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    db.prepare(`UPDATE entries SET read = 1 WHERE id IN (${placeholders})`).run(...ids);

    return {
      success: true,
      message: `Marked ${rows.length} entries as read`,
      marked_count: rows.length,
      feed_counts: feedCounts,
    };
  });
}
