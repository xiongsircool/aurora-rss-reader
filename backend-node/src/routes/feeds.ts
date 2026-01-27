/**
 * Feeds API Routes
 */

import { FastifyInstance } from 'fastify';
import { FeedRepository, EntryRepository } from '../db/repositories/index.js';
import { getDatabase } from '../db/session.js';
import { refreshFeed } from '../services/fetcher.js';
import { normalizeTimeField, parseRelativeTime } from '../utils/dateRange.js';

// Leave headroom under SQLite's default 999-parameter limit.
const SQLITE_IN_CLAUSE_CHUNK_SIZE = 900;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
    const db = getDatabase();

    // Check if feed exists first
    const feed = feedRepo.findById(id);
    if (!feed) {
      return reply.code(404).send({ error: 'Feed not found' });
    }

    // Get all entry IDs for this feed
    const entries = entryRepo.findByFeedId(id);
    const entryIds = entries.map(e => e.id);

    const entryIdChunks = chunkArray(entryIds, SQLITE_IN_CLAUSE_CHUNK_SIZE);

    // Delete related data in correct order to respect foreign key constraints
    // 1. Delete translations for entries
    if (entryIdChunks.length > 0) {
      const hasRssVectors = Boolean(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = 'rss_vectors'").get()
      );
      const hasVssVectors = Boolean(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = 'vss_rss_vectors'").get()
      );

      for (const chunk of entryIdChunks) {
        const placeholders = chunk.map(() => '?').join(',');
        db.prepare(`DELETE FROM translations WHERE entry_id IN (${placeholders})`).run(...chunk);

        // 2. Delete summaries for entries
        db.prepare(`DELETE FROM summaries WHERE entry_id IN (${placeholders})`).run(...chunk);

        // 3. Delete vector data for entries
        if (hasRssVectors) {
          if (hasVssVectors) {
            try {
              // First get rowids before deleting (vss_rss_vectors uses same rowid as rss_vectors)
              const vectorRows = db.prepare(
                `SELECT rowid FROM rss_vectors WHERE entry_id IN (${placeholders})`
              ).all(...chunk) as Array<{ rowid: number }>;

              // Delete from virtual VSS table first
              for (const row of vectorRows) {
                db.prepare('DELETE FROM vss_rss_vectors WHERE rowid = ?').run(row.rowid);
              }
            } catch (error) {
              // VSS table might be unavailable even if it was created earlier
              console.warn('Could not delete VSS vector data:', error);
            }
          }

          // Then delete from rss_vectors
          db.prepare(`DELETE FROM rss_vectors WHERE entry_id IN (${placeholders})`).run(...chunk);
        }
      }
    }

    // 4. Delete fetch logs for this feed
    db.prepare('DELETE FROM fetch_logs WHERE feed_id = ?').run(id);

    // 5. Delete all entries for this feed
    db.prepare('DELETE FROM entries WHERE feed_id = ?').run(id);

    // 6. Finally delete the feed
    const success = feedRepo.delete(id);

    if (!success) {
      // This shouldn't happen since we checked existence above
      return reply.code(500).send({ error: 'Failed to delete feed' });
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
