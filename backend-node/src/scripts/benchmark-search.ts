import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { initDatabase } from '../db/init.js';
import { closeDatabase, getDatabase } from '../db/session.js';
import { EntryRepository, FeedRepository } from '../db/repositories/index.js';

type ParsedArgs = {
  entries: number;
  rounds: number;
  limit: number;
};

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const getNumeric = (flag: string, fallback: number) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return fallback;
    const value = Number(args[idx + 1]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };

  return {
    entries: getNumeric('--entries', 15000),
    rounds: getNumeric('--rounds', 30),
    limit: getNumeric('--limit', 20),
  };
}

function buildSafeFtsQuery(rawQuery: string): string | null {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map((token) => token.replaceAll('"', '').trim())
    .filter(Boolean);

  if (!tokens.length) return null;
  return tokens.map((token) => `"${token}"`).join(' ');
}

function runTimed(name: string, rounds: number, fn: () => void) {
  const started = performance.now();
  for (let i = 0; i < rounds; i += 1) {
    fn();
  }
  const totalMs = performance.now() - started;
  return {
    name,
    rounds,
    totalMs,
    avgMs: totalMs / rounds,
  };
}

function createData(entries: number): void {
  const feedRepo = new FeedRepository();
  const entryRepo = new EntryRepository();
  const feed = feedRepo.create({
    url: 'https://benchmark.example.com/feed.xml',
    title: 'Benchmark Feed',
  });

  const hotspotTerms = [
    'quantum',
    'database',
    'vector',
    'rust',
    'nodejs',
    'sqlite',
    'ai',
    'security',
  ];

  for (let i = 0; i < entries; i += 1) {
    const term = hotspotTerms[i % hotspotTerms.length];
    const noise = `lorem-${i % 17} ipsum-${i % 29} delta-${i % 31}`;
    entryRepo.create({
      feed_id: feed.id,
      guid: `benchmark-${i}`,
      title: `Article ${i} ${term} insights ${noise}`,
      summary: `summary ${term} benchmark item ${i}`,
      content: `content block ${i} about ${term} and retrieval systems with ${noise}`,
      readability_content: i % 3 === 0 ? `fulltext ${term} expanded narrative ${noise}` : null,
      published_at: new Date(Date.now() - i * 60_000).toISOString(),
      url: `https://benchmark.example.com/${i}`,
    });
  }
}

async function main() {
  const options = parseArgs();
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-search-benchmark-'));
  process.env.DATABASE_PATH = join(tempDir, 'benchmark.db');

  try {
    initDatabase();
    createData(options.entries);

    const db = getDatabase();
    const queries = ['quantum', 'nodejs retrieval', 'sqlite vector', 'security ai'];

    const likeStmt = db.prepare(`
      SELECT e.id
      FROM entries e
      WHERE e.title LIKE ? OR e.content LIKE ?
      ORDER BY e.published_at DESC
      LIMIT ?
    `);

    const ftsStmt = db.prepare(`
      SELECT e.id
      FROM entries_fts
      JOIN entries e ON e.rowid = entries_fts.rowid
      WHERE entries_fts MATCH ?
      ORDER BY bm25(entries_fts, 12.0, 4.0, 1.0, 2.0) ASC, e.published_at DESC
      LIMIT ?
    `);

    // Warm up query caches and execution plans.
    for (let i = 0; i < 3; i += 1) {
      for (const q of queries) {
        likeStmt.all(`%${q}%`, `%${q}%`, options.limit);
        const safe = buildSafeFtsQuery(q);
        if (safe) ftsStmt.all(safe, options.limit);
      }
    }

    const likeResult = runTimed('LIKE', options.rounds, () => {
      for (const q of queries) {
        likeStmt.all(`%${q}%`, `%${q}%`, options.limit);
      }
    });

    const ftsResult = runTimed('FTS5', options.rounds, () => {
      for (const q of queries) {
        const safe = buildSafeFtsQuery(q);
        if (!safe) continue;
        ftsStmt.all(safe, options.limit);
      }
    });

    const speedup = likeResult.avgMs > 0 ? likeResult.avgMs / ftsResult.avgMs : 0;

    console.log('Search benchmark completed');
    console.log(`Dataset entries: ${options.entries}`);
    console.log(`Rounds: ${options.rounds}, Queries per round: ${queries.length}`);
    console.log('');
    console.log(`LIKE avg: ${likeResult.avgMs.toFixed(3)} ms/round`);
    console.log(`FTS5 avg: ${ftsResult.avgMs.toFixed(3)} ms/round`);
    console.log(`Speedup (LIKE/FTS5): ${speedup.toFixed(2)}x`);
  } finally {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
}

void main();
