/**
 * Reading Statistics API Routes
 */

import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/session.js';

interface DailyCount {
  date: string;
  count: number;
}

function buildDailySeries(rows: Array<{ date: string | null; count: number }>, days: number): DailyCount[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.date) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.count);
    }
  }

  const series: DailyCount[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return series;
}

export async function statsRoutes(app: FastifyInstance) {
  const db = getDatabase();

  // GET /stats - Reading statistics aggregates
  app.get('/stats', async () => {
    const totals = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM entries) AS entries,
        (SELECT COUNT(*) FROM entries WHERE read = 1) AS read,
        (SELECT COUNT(*) FROM entries WHERE read = 0) AS unread,
        (SELECT COUNT(*) FROM entries WHERE starred = 1) AS starred,
        (SELECT COUNT(*) FROM feeds) AS feeds
    `).get() as {
      entries: number;
      read: number;
      unread: number;
      starred: number;
      feeds: number;
    };

    const topFeeds = db.prepare(`
      SELECT
        f.id AS feed_id,
        COALESCE(f.custom_title, f.title) AS title,
        COUNT(e.id) AS total,
        SUM(CASE WHEN e.read = 1 THEN 1 ELSE 0 END) AS read_count
      FROM feeds f
      LEFT JOIN entries e ON e.feed_id = f.id
      GROUP BY f.id
      HAVING COUNT(e.id) > 0
      ORDER BY total DESC
      LIMIT 10
    `).all() as Array<{ feed_id: string; title: string | null; total: number; read_count: number }>;

    // Last 30 days: new articles ingested (by inserted_at)
    const ingestRows = db.prepare(`
      SELECT substr(inserted_at, 1, 10) AS date, COUNT(*) AS count
      FROM entries
      WHERE datetime(inserted_at) >= datetime('now', '-30 days')
      GROUP BY substr(inserted_at, 1, 10)
    `).all() as Array<{ date: string | null; count: number }>;

    // Last 30 days: articles actually read (by read_at; accumulates from v0.2 onward)
    const readRows = db.prepare(`
      SELECT substr(read_at, 1, 10) AS date, COUNT(*) AS count
      FROM entries
      WHERE read_at IS NOT NULL AND datetime(read_at) >= datetime('now', '-30 days')
      GROUP BY substr(read_at, 1, 10)
    `).all() as Array<{ date: string | null; count: number }>;

    const topTags = db.prepare(`
      SELECT t.id AS tag_id, t.name, COUNT(et.entry_id) AS count
      FROM user_tags t
      JOIN entry_tags et ON et.tag_id = t.id
      GROUP BY t.id
      ORDER BY count DESC
      LIMIT 8
    `).all() as Array<{ tag_id: string; name: string; count: number }>;

    const readRate = totals.entries > 0 ? totals.read / totals.entries : 0;

    return {
      totals: {
        ...totals,
        read_rate: Math.round(readRate * 1000) / 1000,
      },
      top_feeds: topFeeds.map((f) => ({
        feed_id: f.feed_id,
        title: f.title ?? f.feed_id,
        total: f.total,
        read: f.read_count ?? 0,
        read_rate: f.total > 0 ? Math.round((f.read_count / f.total) * 1000) / 1000 : 0,
      })),
      ingest_daily: buildDailySeries(ingestRows, 30),
      read_daily: buildDailySeries(readRows, 30),
      top_tags: topTags,
      generated_at: new Date().toISOString(),
    };
  });
}
