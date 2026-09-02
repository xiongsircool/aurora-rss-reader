import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('rsshub candidates keep original url first and include mirrors', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-test-'));
  process.env.DATABASE_PATH = join(tempDir, 'test.db');

  const { initDatabase } = await import('../src/db/init.js');
  const { closeDatabase } = await import('../src/db/session.js');
  const { resolveFeedSourceCandidates } = await import('../src/services/feedSourceResolver.js');

  try {
    initDatabase();

    const source = 'https://rsshub.app/nature/research/ng';
    const candidates = resolveFeedSourceCandidates(source);

    assert.equal(candidates[0], source);
    assert.ok(candidates.some(candidate => candidate.includes('www.nature.com/ng/current.rss')));
    assert.ok(candidates.some(candidate => candidate.startsWith('https://rsshub.rssforever.com/')));
  } finally {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
