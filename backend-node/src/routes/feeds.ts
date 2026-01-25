/**
 * Feeds API Routes
 */

import { FastifyInstance } from 'fastify';
import { FeedRepository, EntryRepository } from '../db/repositories/index.js';
import { getDatabase } from '../db/session.js';
import { refreshFeed } from '../services/fetcher.js';
import { normalizeTimeField, parseRelativeTime } from '../utils/dateRange.js';

export async function feedsRoutes(app: FastifyInstance) {
  const feedRepo = new FeedRepository();
  const entryRepo = new EntryRepository();

  // GET /feeds - List all feeds with unread counts
  app.get('/feeds', async (request) => {
    const query = request.query as { date_range?: string; time_field?: string };
    const feeds = feedRepo.findAll();

    if (feeds.length === 0) {
      return [];
    }

    const timeField = normalizeTimeField(query?.time_field);
    const cutoff = parseRelativeTime(query?.date_range);
    const db = getDatabase();

    let unreadRows: Array<{ feed_id: string; count: number }> = [];

    if (!cutoff) {
      unreadRows = db.prepare(
        'SELECT feed_id, COUNT(*) as count FROM entries WHERE read = 0 GROUP BY feed_id'
      ).all() as Array<{ feed_id: string; count: number }>;
    } else if (timeField === 'published_at') {
      const nowIso = new Date().toISOString();
      const cutoffIso = cutoff.toISOString();
      unreadRows = db.prepare(
        `SELECT feed_id, COUNT(*) as count
         FROM entries
         WHERE read = 0
           AND (
             (published_at IS NOT NULL AND published_at <= ? AND published_at >= ?)
             OR (published_at IS NULL AND inserted_at >= ?)
           )
         GROUP BY feed_id`
      ).all(nowIso, cutoffIso, cutoffIso) as Array<{ feed_id: string; count: number }>;
    } else {
      const cutoffIso = cutoff.toISOString();
      unreadRows = db.prepare(
        'SELECT feed_id, COUNT(*) as count FROM entries WHERE read = 0 AND inserted_at >= ? GROUP BY feed_id'
      ).all(cutoffIso) as Array<{ feed_id: string; count: number }>;
    }

    const unreadMap = new Map<string, number>();
    for (const row of unreadRows) {
      unreadMap.set(row.feed_id, row.count);
    }

    return feeds.map(feed => ({
      id: feed.id,
      url: feed.url,
      title: feed.title,
      group_name: feed.group_name,
      favicon_url: feed.favicon_url,
      unread_count: unreadMap.get(feed.id) ?? 0,
      last_checked_at: feed.last_checked_at,
      last_error: feed.last_error,
    }));
  });

  // POST /feeds - Create a new feed
  app.post('/feeds', async (request, reply) => {
    const { url, title, group_name } = request.body as any;
    const trimmedUrl = typeof url === 'string' ? url.trim() : '';

    if (!trimmedUrl) {
      return reply.code(400).send({ error: 'Feed URL is required' });
    }

    const existing = feedRepo.findByUrl(trimmedUrl);
    if (existing) {
      return reply.code(400).send({ error: 'Feed already exists' });
    }

    const feed = feedRepo.create({
      url: trimmedUrl,
      title: title || null,
      group_name: group_name || 'default',
    });

    refreshFeed(feed.id).catch((error) => {
      console.error('Failed to refresh new feed:', error);
    });

    return {
      id: feed.id,
      url: feed.url,
      title: feed.title,
      group_name: feed.group_name,
      favicon_url: feed.favicon_url,
      unread_count: 0,
      last_checked_at: feed.last_checked_at,
      last_error: feed.last_error,
    };
  });

  // GET /feeds/:id - Get a single feed
  app.get('/feeds/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const feed = feedRepo.findById(id);

    if (!feed) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    return feed;
  });

  // PUT /feeds/:id - Update a feed
  app.put('/feeds/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const feed = feedRepo.update(id, updates);

    if (!feed) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    return feed;
  });

  // DELETE /feeds/:id - Delete a feed
  app.delete('/feeds/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Delete all entries for this feed first
    const entries = entryRepo.findByFeedId(id);
    for (const entry of entries) {
      entryRepo.delete(entry.id);
    }

    const success = feedRepo.delete(id);

    if (!success) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    return { success: true };
  });

  // POST /feeds/:id/refresh - Refresh a feed
  app.post('/feeds/:id/refresh', async (request, reply) => {
    const { id } = request.params as { id: string };
    const feed = feedRepo.findById(id);

    if (!feed) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    refreshFeed(id).catch((error) => {
      console.error('Failed to refresh feed:', error);
    });

    return reply.code(202).send({ status: 'scheduled' });
  });

  // PATCH /feeds/:id - Update a feed (frontend uses PATCH)
  app.patch('/feeds/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const feed = feedRepo.update(id, updates);

    if (!feed) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    const db = getDatabase();
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM entries WHERE feed_id = ? AND read = 0'
    ).get(id) as { count: number };

    return {
      id: feed.id,
      url: feed.url,
      title: feed.title,
      group_name: feed.group_name,
      favicon_url: feed.favicon_url,
      unread_count: row?.count ?? 0,
      last_checked_at: feed.last_checked_at,
      last_error: feed.last_error,
    };
  });
}
