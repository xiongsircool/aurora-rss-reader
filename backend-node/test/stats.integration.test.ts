import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';

test('/stats aggregates reading activity and read timestamps', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-stats-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.db');

  const { initDatabase } = await import('../src/db/init.js');
  const { closeDatabase } = await import('../src/db/session.js');
  const { FeedRepository, EntryRepository } = await import('../src/db/repositories/index.js');
  const { statsRoutes } = await import('../src/routes/stats.js');

  const app = Fastify({ logger: false });

  try {
    initDatabase();

    const feedRepo = new FeedRepository();
    const entryRepo = new EntryRepository();
    const feed = feedRepo.create({
      url: 'https://example.com/feed.xml',
      title: 'Test Feed',
    });

    const readEntry = entryRepo.create({
      feed_id: feed.id,
      guid: 'read-entry',
      title: 'Read article',
      url: 'https://example.com/read',
    });
    entryRepo.create({
      feed_id: feed.id,
      guid: 'unread-entry',
      title: 'Unread article',
      url: 'https://example.com/unread',
    });

    assert.equal(entryRepo.markAsRead(readEntry.id), true);
    const marked = entryRepo.findById(readEntry.id);
    assert.equal(marked?.read, 1);
    assert.ok(marked?.read_at);

    await app.register(statsRoutes, { prefix: '/api' });
    const response = await app.inject({ method: 'GET', url: '/api/stats' });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      totals: { entries: number; read: number; unread: number; starred: number; feeds: number; read_rate: number };
      top_feeds: Array<{ feed_id: string; title: string; total: number; read: number; read_rate: number }>;
      read_daily: Array<{ count: number }>;
    };

    assert.deepEqual(body.totals, {
      entries: 2,
      read: 1,
      unread: 1,
      starred: 0,
      feeds: 1,
      read_rate: 0.5,
    });
    assert.deepEqual(body.top_feeds[0], {
      feed_id: feed.id,
      title: 'Test Feed',
      total: 2,
      read: 1,
      read_rate: 0.5,
    });
    assert.equal(body.read_daily.reduce((sum, day) => sum + day.count, 0), 1);

    assert.equal(entryRepo.markAsUnread(readEntry.id), true);
    const unmarked = entryRepo.findById(readEntry.id);
    assert.equal(unmarked?.read, 0);
    assert.equal(unmarked?.read_at, null);
  } finally {
    await app.close();
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
