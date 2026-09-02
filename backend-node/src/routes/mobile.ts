import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/session.js';
import { EntryRepository, FeedRepository, SummaryRepository } from '../db/repositories/index.js';
import { refreshAllFeeds, refreshFeed } from '../services/fetcher.js';
import { buildEntryPresentation } from '../services/entryPresentation.js';
import { userSettingsService } from '../services/userSettings.js';
import { getObjectBody } from '../utils/http.js';

type CursorPayload = { t: string; id: string };
type EntryRow = Record<string, unknown> & {
  id: string;
  feed_id: string;
  feed_title: string | null;
  feed_custom_title: string | null;
  feed_url: string | null;
  feed_site_url: string | null;
  feed_group_name: string | null;
  feed_view_type: string | null;
  feed_favicon_url: string | null;
  title: string | null;
  url: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  readability_content: string | null;
  published_at: string | null;
  inserted_at: string | null;
  read: number;
  starred: number;
  enclosure_url: string | null;
  enclosure_type: string | null;
  enclosure_length: number | null;
  duration: string | null;
  image_url: string | null;
  content_extraction_status: string | null;
  content_source_url: string | null;
};

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

function normalizeEntryRow(row: EntryRow) {
  return {
    id: row.id,
    feed_id: row.feed_id,
    feed_title: row.feed_custom_title || row.feed_title,
    feed_url: row.feed_url,
    feed_site_url: row.feed_site_url,
    feed_group_name: row.feed_group_name,
    feed_view_type: row.feed_view_type,
    feed_favicon_url: row.feed_favicon_url,
    title: row.title,
    url: row.url,
    author: row.author,
    summary: row.summary,
    content: row.content,
    readability_content: row.readability_content,
    published_at: row.published_at,
    inserted_at: row.inserted_at,
    read: Boolean(row.read),
    starred: Boolean(row.starred),
    enclosure_url: row.enclosure_url,
    enclosure_type: row.enclosure_type,
    enclosure_length: row.enclosure_length,
    duration: row.duration,
    image_url: row.image_url,
    content_extraction_status: row.content_extraction_status,
    content_source_url: row.content_source_url,
  };
}

function buildPresentationInput(row: EntryRow) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    content: row.content,
    readability_content: row.readability_content,
    enclosure_url: row.enclosure_url,
    enclosure_type: row.enclosure_type,
    duration: row.duration,
    image_url: row.image_url,
    content_extraction_status: row.content_extraction_status,
    content_source_url: row.content_source_url,
    feed_url: row.feed_url,
    feed_site_url: row.feed_site_url,
    feed_view_type: row.feed_view_type,
  };
}

function toInboxItem(row: EntryRow) {
  const entry = normalizeEntryRow(row);
  const presentation = buildEntryPresentation(buildPresentationInput(row));

  return {
    id: entry.id,
    feed_id: entry.feed_id,
    feed_title: entry.feed_title,
    feed_group_name: entry.feed_group_name,
    feed_favicon_url: entry.feed_favicon_url,
    title: entry.title,
    url: entry.url,
    author: entry.author,
    preview_text: presentation.preview_text,
    published_at: entry.published_at,
    inserted_at: entry.inserted_at,
    read: entry.read,
    starred: entry.starred,
    content_type: presentation.content_type,
    lead_image_url: presentation.lead_image_url,
    image_count: presentation.images.length,
    video: presentation.video ? {
      thumbnail_url: presentation.video.thumbnail_url,
      duration: presentation.video.duration,
      platform: presentation.video.platform,
    } : null,
    reading_time_minutes: presentation.reading_time_minutes,
    extraction_status: presentation.extraction_status,
  };
}

function toReaderItem(row: EntryRow, aiSummary: string | null) {
  const entry = normalizeEntryRow(row);
  const presentation = buildEntryPresentation(buildPresentationInput(row));

  return {
    ...entry,
    ai_summary: aiSummary,
    presentation,
  };
}

function entrySelectSql(): string {
  return `
    SELECT
      entries.*,
      feeds.title AS feed_title,
      feeds.custom_title AS feed_custom_title,
      feeds.url AS feed_url,
      feeds.site_url AS feed_site_url,
      feeds.group_name AS feed_group_name,
      feeds.view_type AS feed_view_type,
      feeds.favicon_url AS feed_favicon_url
    FROM entries
    JOIN feeds ON feeds.id = entries.feed_id
  `;
}

export async function mobileRoutes(app: FastifyInstance) {
  const db = getDatabase();
  const entryRepo = new EntryRepository();
  const feedRepo = new FeedRepository();
  const summaryRepo = new SummaryRepository();
  const sortTimeExpr = 'COALESCE(entries.published_at, entries.inserted_at)';

  app.get('/mobile/entries', async (request, reply) => {
    const query = request.query as {
      filter?: string;
      group_name?: string;
      feed_id?: string;
      cursor?: string;
      limit?: string;
    };

    const limit = Math.max(1, Math.min(Number.parseInt(query.limit ?? '30', 10) || 30, 100));
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (query.feed_id) {
      where.push('entries.feed_id = ?');
      params.push(query.feed_id);
    } else if (query.group_name) {
      where.push('feeds.group_name = ?');
      params.push(query.group_name);
    }

    if (query.filter === 'unread') {
      where.push('entries.read = 0');
    } else if (query.filter === 'saved' || query.filter === 'starred') {
      where.push('entries.starred = 1');
    }

    if (query.cursor) {
      try {
        const cursorPayload = decodeCursor(query.cursor);
        where.push(`(${sortTimeExpr} < ? OR (${sortTimeExpr} = ? AND entries.id < ?))`);
        params.push(cursorPayload.t, cursorPayload.t, cursorPayload.id);
      } catch (error) {
        return reply.code(400).send({ error: 'Invalid cursor' });
      }
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      ${entrySelectSql()}
      ${whereClause}
      ORDER BY ${sortTimeExpr} DESC, entries.id DESC
      LIMIT ?
    `).all(...params, limit + 1) as EntryRow[];

    const pageRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = pageRows[pageRows.length - 1];
    const cursorTime = last?.published_at || last?.inserted_at;

    return {
      items: pageRows.map(toInboxItem),
      next_cursor: hasMore && cursorTime ? encodeCursor(cursorTime, last.id) : null,
      has_more: hasMore,
    };
  });

  app.get('/mobile/entries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare(`
      ${entrySelectSql()}
      WHERE entries.id = ?
    `).get(id) as EntryRow | undefined;

    if (!row) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    const settings = userSettingsService.getSettings();
    const language = settings.ai_translation_language || settings.language || 'zh';
    const aiSummary = summaryRepo.findByEntryIdAndLanguage(id, language)?.summary
      || summaryRepo.findByEntryId(id)[0]?.summary
      || null;

    return toReaderItem(row, aiSummary);
  });

  app.patch('/mobile/entries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const updated = entryRepo.update(id, {
      read: typeof body.read === 'boolean' ? body.read : undefined,
      starred: typeof body.starred === 'boolean' ? body.starred : undefined,
    });

    if (!updated) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true };
  });

  app.get('/mobile/sources', async () => {
    const feeds = feedRepo.findAll();
    const unreadRows = db.prepare(
      'SELECT feed_id, COUNT(*) as count FROM entries WHERE read = 0 GROUP BY feed_id'
    ).all() as Array<{ feed_id: string; count: number }>;
    const unreadMap = new Map(unreadRows.map((row) => [row.feed_id, row.count]));

    const groupMap = new Map<string, ReturnType<typeof feedRepo.findAll>>();
    for (const feed of feeds) {
      const groupName = feed.group_name || 'default';
      const groupFeeds = groupMap.get(groupName) ?? [];
      groupFeeds.push(feed);
      groupMap.set(groupName, groupFeeds);
    }

    return {
      items: feeds.map((feed) => ({
        id: feed.id,
        url: feed.url,
        title: feed.custom_title || feed.title || feed.url,
        group_name: feed.group_name,
        favicon_url: feed.favicon_url,
        view_type: feed.view_type,
        unread_count: unreadMap.get(feed.id) ?? 0,
        last_checked_at: feed.last_checked_at,
        last_error: feed.last_error,
        enabled: true,
        source_label: feed.url.toLowerCase().includes('rsshub') ? 'RSSHub' : 'Auto-detected',
      })),
      groups: Array.from(groupMap.entries()).map(([name, groupFeeds]) => ({
        name,
        count: groupFeeds.length,
        unread_count: groupFeeds.reduce((total, feed) => total + (unreadMap.get(feed.id) ?? 0), 0),
      })),
    };
  });

  app.post('/mobile/sources', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const groupName = typeof body.group_name === 'string' && body.group_name.trim() ? body.group_name.trim() : 'default';

    if (!url) {
      return reply.code(400).send({ error: 'Feed URL is required' });
    }

    const existing = feedRepo.findByUrl(url);
    if (existing) {
      return reply.code(409).send({ error: 'Feed already exists', id: existing.id });
    }

    const feed = feedRepo.create({
      url,
      group_name: groupName,
      view_type: 'articles',
    });

    refreshFeed(feed.id).catch((error) => {
      console.error('Failed to refresh mobile source:', error);
    });

    return reply.code(201).send({
      id: feed.id,
      url: feed.url,
      title: feed.title || feed.url,
      group_name: feed.group_name,
      favicon_url: feed.favicon_url,
      unread_count: 0,
      source_label: feed.url.toLowerCase().includes('rsshub') ? 'RSSHub' : 'Auto-detected',
    });
  });

  app.post('/mobile/sync', async (request) => {
    const body = getObjectBody(request.body);
    const feedId = typeof body?.feed_id === 'string' ? body.feed_id : null;

    if (feedId) {
      refreshFeed(feedId).catch((error) => {
        console.error('Failed to refresh mobile feed:', error);
      });
    } else {
      refreshAllFeeds().catch((error) => {
        console.error('Failed to refresh mobile feeds:', error);
      });
    }

    return { status: 'scheduled' };
  });

  app.post('/mobile/entries/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = getObjectBody(request.body);
    const read = body?.read === undefined ? true : parseBoolean(body.read);
    const entry = entryRepo.update(id, { read });

    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    return { success: true, read };
  });
}
