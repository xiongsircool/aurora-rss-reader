import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';

test('/ai/search supports keyword, semantic, hybrid, and special-character queries', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-search-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.db');

  const { initDatabase } = await import('../src/db/init.js');
  const { closeDatabase } = await import('../src/db/session.js');
  const { FeedRepository, EntryRepository } = await import('../src/db/repositories/index.js');
  const { aiRoutes } = await import('../src/routes/ai.js');

  const app = Fastify({ logger: false });

  try {
    initDatabase();

    const feedRepo = new FeedRepository();
    const entryRepo = new EntryRepository();
    const feed = feedRepo.create({
      url: 'https://example.com/feed.xml',
      title: 'Test Feed',
    });

    entryRepo.create({
      feed_id: feed.id,
      guid: 'keyword-1',
      title: 'QuantumFalcon roadmap',
      summary: 'keyword-first article',
      content: 'general content',
      published_at: '2026-01-01T00:00:00.000Z',
      url: 'https://example.com/1',
    });

    entryRepo.create({
      feed_id: feed.id,
      guid: 'keyword-2',
      title: 'General update',
      summary: 'contains DeepOceanNeedle in summary',
      content: 'secondary content',
      published_at: '2026-01-02T00:00:00.000Z',
      url: 'https://example.com/2',
    });

    await app.register(aiRoutes, { prefix: '/api' });

    const keywordRes = await app.inject({
      method: 'POST',
      url: '/api/ai/search',
      payload: { query: 'QuantumFalcon', type: 'keyword', limit: 10 },
    });
    assert.equal(keywordRes.statusCode, 200);
    const keywordBody = keywordRes.json() as {
      total: number;
      results: Array<{ title: string; match_type: string }>;
    };
    assert.ok(keywordBody.total >= 1);
    assert.equal(keywordBody.results[0]?.match_type, 'keyword');
    assert.match(keywordBody.results[0]?.title || '', /QuantumFalcon/i);

    const hybridRes = await app.inject({
      method: 'POST',
      url: '/api/ai/search',
      payload: { query: 'DeepOceanNeedle', type: 'hybrid', limit: 10 },
    });
    assert.equal(hybridRes.statusCode, 200);
    const hybridBody = hybridRes.json() as {
      total: number;
      results: Array<{ match_type: string; title: string }>;
    };
    assert.ok(hybridBody.total >= 1);
    assert.ok(hybridBody.results.some((item) => item.match_type === 'keyword'));

    const semanticRes = await app.inject({
      method: 'POST',
      url: '/api/ai/search',
      payload: { query: 'latest research summary', type: 'semantic', limit: 10 },
    });
    assert.equal(semanticRes.statusCode, 200);
    const semanticBody = semanticRes.json() as { results: unknown[] };
    assert.ok(Array.isArray(semanticBody.results));

    const specialRes = await app.inject({
      method: 'POST',
      url: '/api/ai/search',
      payload: { query: 'C++ "vector" (test) OR ???', type: 'keyword', limit: 10 },
    });
    assert.equal(specialRes.statusCode, 200);
    const specialBody = specialRes.json() as { results: unknown[] };
    assert.ok(Array.isArray(specialBody.results));
  } finally {
    await app.close();
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
