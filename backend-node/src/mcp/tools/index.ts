import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../../db/session.js";
import {
  EntryRepository,
  FeedRepository,
} from "../../db/repositories/index.js";
import { refreshFeed, refreshAllFeeds } from "../../services/fetcher.js";
import { searchVectors } from "../../services/vector.js";
import { normalizeTimeField, parseRelativeTime } from "../../utils/dateRange.js";
import { summaryGenerationService } from "../../services/summaryGenerationService.js";

const db = getDatabase();
const feedRepo = new FeedRepository();
const entryRepo = new EntryRepository();
const sortTimeExpr = "COALESCE(e.published_at, e.inserted_at)";
const SQLITE_IN_CLAUSE_CHUNK_SIZE = 900;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type EntryStatus = "all" | "unread" | "read" | "starred";
type SearchMode = "keyword" | "semantic" | "hybrid";

function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function fail(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function encodeCursor(timeIso: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: timeIso, id }), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): { t: string; id: string } {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8");
  const parsed = JSON.parse(raw) as { t: string; id: string };
  if (!parsed?.t || !parsed?.id) {
    throw new Error("Invalid cursor");
  }
  return parsed;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeEntryRecord(row: any, options: {
  includeContent?: boolean;
  contentMaxLength?: number;
} = {}) {
  const includeContent = options.includeContent === true;
  const contentMaxLength = Math.max(0, options.contentMaxLength ?? 1200);
  const content = includeContent
    ? String(row.readability_content || row.content || row.summary || "").slice(0, contentMaxLength)
    : undefined;

  return {
    id: row.id,
    feed_id: row.feed_id,
    feed_title: row.feed_title ?? null,
    group_name: row.group_name ?? null,
    title: row.title ?? null,
    url: row.url ?? null,
    author: row.author ?? null,
    summary: row.summary ?? null,
    published_at: row.published_at ?? null,
    inserted_at: row.inserted_at ?? null,
    read: row.read === 1,
    starred: row.starred === 1,
    content,
  };
}

function buildSafeFtsQuery(rawQuery: string): string | null {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map((token) => token.replaceAll('"', "").trim())
    .filter(Boolean);

  if (!tokens.length) return null;
  return tokens.map((token) => `"${token}"`).join(" ");
}

function normalizeKeywordScore(rank: number, minRank: number, maxRank: number): number {
  if (!Number.isFinite(rank) || !Number.isFinite(minRank) || !Number.isFinite(maxRank)) {
    return 0.8;
  }

  const range = maxRank - minRank;
  if (Math.abs(range) < 1e-9) return 0.8;

  const normalized = (maxRank - rank) / range;
  return 0.65 + Math.max(0, Math.min(1, normalized)) * 0.25;
}

function buildEntryFilters(options: {
  feed_id?: string;
  group_name?: string;
  status?: EntryStatus;
  keyword?: string;
  date_range?: string;
  time_field?: string;
  cursor?: string;
}) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  const status = options.status ?? "all";

  if (options.feed_id) {
    where.push("e.feed_id = ?");
    params.push(options.feed_id);
  } else if (options.group_name) {
    where.push("f.group_name = ?");
    params.push(options.group_name);
  }

  if (status === "unread") where.push("e.read = 0");
  if (status === "read") where.push("e.read = 1");
  if (status === "starred") where.push("e.starred = 1");

  if (options.keyword?.trim()) {
    where.push("(e.title LIKE ? OR e.summary LIKE ? OR COALESCE(e.readability_content, e.content, '') LIKE ?)");
    const value = `%${options.keyword.trim()}%`;
    params.push(value, value, value);
  }

  const timeField = normalizeTimeField(options.time_field);
  const cutoff = parseRelativeTime(options.date_range);
  if (cutoff) {
    const cutoffIso = cutoff.toISOString();
    if (timeField === "published_at") {
      const nowIso = new Date().toISOString();
      where.push(
        "((e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?) OR (e.published_at IS NULL AND e.inserted_at >= ?))"
      );
      params.push(nowIso, cutoffIso, cutoffIso);
    } else {
      where.push("e.inserted_at >= ?");
      params.push(cutoffIso);
    }
  }

  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    where.push(`(${sortTimeExpr} < ? OR (${sortTimeExpr} = ? AND e.id < ?))`);
    params.push(decoded.t, decoded.t, decoded.id);
  }

  return { where, params, timeField };
}

function listEntries(args: {
  feed_id?: string;
  group_name?: string;
  status?: EntryStatus;
  keyword?: string;
  include_content?: boolean;
  content_max_length?: number;
  limit?: number;
  cursor?: string;
  date_range?: string;
  time_field?: string;
}): ToolResult {
  try {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const fetchLimit = limit + 1;
    const { where, params } = buildEntryFilters(args);
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT e.*, f.title AS feed_title, f.group_name AS group_name
      FROM entries e
      LEFT JOIN feeds f ON f.id = e.feed_id
      ${whereClause}
      ORDER BY ${sortTimeExpr} DESC, e.id DESC
      LIMIT ?
    `).all(...params, fetchLimit) as any[];

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) =>
      normalizeEntryRecord(row, {
        includeContent: args.include_content,
        contentMaxLength: args.content_max_length,
      })
    );

    let nextCursor: string | null = null;
    if (hasMore && rows[limit - 1]) {
      const last = rows[limit - 1];
      const cursorTime = last.published_at || last.inserted_at;
      if (cursorTime) {
        nextCursor = encodeCursor(cursorTime, last.id);
      }
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM entries e
      LEFT JOIN feeds f ON f.id = e.feed_id
      ${whereClause}
    `).get(...params) as { total: number };

    return ok({
      total: countRow.total,
      returned: items.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      items,
    });
  } catch (error) {
    return fail(`list_entries failed: ${error}`);
  }
}

async function searchEntries(args: {
  query: string;
  mode?: SearchMode;
  feed_id?: string;
  group_name?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    const query = args.query.trim();
    if (!query) return fail("search_entries requires query");

    const mode = args.mode ?? "hybrid";
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
    const results: Array<{
      id: string;
      title: string | null;
      content?: string | null;
      feed_id: string;
      feed_title?: string | null;
      group_name?: string | null;
      published_at: string | null;
      inserted_at?: string | null;
      url: string | null;
      score: number;
      match_type: "semantic" | "keyword";
    }> = [];

    if (mode === "keyword" || mode === "hybrid") {
      const ftsQuery = buildSafeFtsQuery(query);
      try {
        if (!ftsQuery) throw new Error("Invalid FTS query");

        let sql = `
          SELECT
            e.id,
            e.title,
            COALESCE(e.readability_content, e.content, e.summary) AS content,
            e.feed_id,
            f.title as feed_title,
            f.group_name as group_name,
            e.published_at,
            e.inserted_at,
            e.url,
            bm25(entries_fts, 12.0, 4.0, 1.0, 2.0) AS rank
          FROM entries_fts
          JOIN entries e ON e.rowid = entries_fts.rowid
          LEFT JOIN feeds f ON e.feed_id = f.id
          WHERE entries_fts MATCH ?
        `;
        const sqlParams: Array<string | number> = [ftsQuery];
        if (args.feed_id) {
          sql += " AND e.feed_id = ?";
          sqlParams.push(args.feed_id);
        }
        if (args.group_name) {
          sql += " AND f.group_name = ?";
          sqlParams.push(args.group_name);
        }
        sql += " ORDER BY rank ASC, e.published_at DESC LIMIT ?";
        sqlParams.push(limit);

        const keywordRows = db.prepare(sql).all(...sqlParams) as Array<any>;
        const ranks = keywordRows.map((item) => item.rank).filter((item) => Number.isFinite(item));
        const minRank = ranks.length ? Math.min(...ranks) : 0;
        const maxRank = ranks.length ? Math.max(...ranks) : 0;

        for (const row of keywordRows) {
          results.push({
            id: row.id,
            title: row.title,
            content: row.content,
            feed_id: row.feed_id,
            feed_title: row.feed_title,
            group_name: row.group_name,
            published_at: row.published_at,
            inserted_at: row.inserted_at,
            url: row.url,
            score: normalizeKeywordScore(row.rank, minRank, maxRank),
            match_type: "keyword",
          });
        }
      } catch {
        let sql = `
          SELECT
            e.id,
            e.title,
            COALESCE(e.readability_content, e.content, e.summary) AS content,
            e.feed_id,
            f.title as feed_title,
            f.group_name as group_name,
            e.published_at,
            e.inserted_at,
            e.url
          FROM entries e
          LEFT JOIN feeds f ON e.feed_id = f.id
          WHERE (e.title LIKE ? OR COALESCE(e.readability_content, e.content, e.summary) LIKE ?)
        `;
        const sqlParams: Array<string | number> = [`%${query}%`, `%${query}%`];
        if (args.feed_id) {
          sql += " AND e.feed_id = ?";
          sqlParams.push(args.feed_id);
        }
        if (args.group_name) {
          sql += " AND f.group_name = ?";
          sqlParams.push(args.group_name);
        }
        sql += " ORDER BY e.published_at DESC, e.inserted_at DESC LIMIT ?";
        sqlParams.push(limit);

        const keywordRows = db.prepare(sql).all(...sqlParams) as Array<any>;
        for (const row of keywordRows) {
          results.push({
            id: row.id,
            title: row.title,
            content: row.content,
            feed_id: row.feed_id,
            feed_title: row.feed_title,
            group_name: row.group_name,
            published_at: row.published_at,
            inserted_at: row.inserted_at,
            url: row.url,
            score: 0.8,
            match_type: "keyword",
          });
        }
      }
    }

    if (mode === "semantic" || mode === "hybrid") {
      try {
        const vectorResults = await searchVectors(query, limit);
        for (const item of vectorResults) {
          if (results.some((row) => row.id === item.id)) continue;

          const row = db.prepare(`
            SELECT
              e.id,
              e.title,
              COALESCE(e.readability_content, e.content, e.summary) AS content,
              e.feed_id,
              f.title as feed_title,
              f.group_name as group_name,
              e.published_at,
              e.inserted_at,
              e.url
            FROM entries e
            LEFT JOIN feeds f ON e.feed_id = f.id
            WHERE e.id = ?
          `).get(item.id) as any;

          if (!row) continue;
          if (args.feed_id && row.feed_id !== args.feed_id) continue;
          if (args.group_name && row.group_name !== args.group_name) continue;

          results.push({
            id: row.id,
            title: row.title,
            content: row.content,
            feed_id: row.feed_id,
            feed_title: row.feed_title,
            group_name: row.group_name,
            published_at: row.published_at,
            inserted_at: row.inserted_at,
            url: row.url,
            score: 1 - (item.distance || 0),
            match_type: "semantic",
          });
        }
      } catch {
        // Keep keyword-only results when vector search is unavailable.
      }
    }

    const uniqueResults = results.sort((a, b) => b.score - a.score).slice(0, limit);
    return ok({
      query,
      mode,
      total: uniqueResults.length,
      results: uniqueResults.map((item) => ({
        ...item,
        content: item.content ? item.content.slice(0, 300) : "",
      })),
    });
  } catch (error) {
    return fail(`search_entries failed: ${error}`);
  }
}

function getFeedStats(feedId: string) {
  return db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
    FROM entries
    WHERE feed_id = ?
  `).get(feedId) as { total: number; unread: number | null };
}

function normalizeFeedRecord(feed: any, includeStats = false) {
  const base = {
    id: feed.id,
    url: feed.url,
    title: feed.title,
    custom_title: feed.custom_title,
    group_name: feed.group_name,
    view_type: feed.view_type,
    ai_tagging_enabled: feed.ai_tagging_enabled === 1,
    last_checked_at: feed.last_checked_at,
    last_error: feed.last_error,
    favicon_url: feed.favicon_url,
  };

  if (!includeStats) return base;
  const stats = getFeedStats(feed.id);
  return {
    ...base,
    stats: {
      total: stats.total ?? 0,
      unread: stats.unread ?? 0,
    },
  };
}

function deleteFeedWithRelations(feedId: string) {
  const feed = feedRepo.findById(feedId);
  if (!feed) return { success: false, error: "Feed not found" };

  const entries = entryRepo.findByFeedId(feedId);
  const entryIds = entries.map((entry) => entry.id);
  const entryIdChunks = chunkArray(entryIds, SQLITE_IN_CLAUSE_CHUNK_SIZE);

  if (entryIdChunks.length > 0) {
    const hasRssVectors = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = 'rss_vectors'").get()
    );
    const hasVssVectors = Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = 'vss_rss_vectors'").get()
    );

    for (const chunk of entryIdChunks) {
      const placeholders = chunk.map(() => "?").join(",");
      db.prepare(`DELETE FROM translations WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM summaries WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM summary_generation_jobs WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM article_extraction_jobs WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM entry_tags WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM analysis_status WHERE entry_id IN (${placeholders})`).run(...chunk);
      db.prepare(`DELETE FROM collection_entries WHERE entry_id IN (${placeholders})`).run(...chunk);

      if (hasRssVectors) {
        if (hasVssVectors) {
          try {
            const vectorRows = db.prepare(
              `SELECT rowid FROM rss_vectors WHERE entry_id IN (${placeholders})`
            ).all(...chunk) as Array<{ rowid: number }>;

            for (const row of vectorRows) {
              db.prepare("DELETE FROM vss_rss_vectors WHERE rowid = ?").run(row.rowid);
            }
          } catch {
            // Keep delete flow resilient when sqlite-vss is unavailable.
          }
        }

        db.prepare(`DELETE FROM rss_vectors WHERE entry_id IN (${placeholders})`).run(...chunk);
      }
    }
  }

  db.prepare("DELETE FROM fetch_logs WHERE feed_id = ?").run(feedId);
  db.prepare("DELETE FROM entries WHERE feed_id = ?").run(feedId);
  feedRepo.delete(feedId);
  return { success: true, feed };
}

function buildBatchWhere(options: {
  entry_ids?: string[];
  feed_id?: string;
  group_name?: string;
  status?: EntryStatus;
  date_range?: string;
  time_field?: string;
}) {
  if (options.entry_ids?.length) {
    return {
      where: `id IN (${options.entry_ids.map(() => "?").join(",")})`,
      params: [...options.entry_ids],
    };
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options.feed_id) {
    conditions.push("feed_id = ?");
    params.push(options.feed_id);
  }

  if (options.group_name) {
    const feedIds = feedRepo.findByGroupName(options.group_name).map((item) => item.id);
    if (feedIds.length === 0) {
      return { where: "1 = 0", params };
    }
    conditions.push(`feed_id IN (${feedIds.map(() => "?").join(",")})`);
    params.push(...feedIds);
  }

  const status = options.status ?? "all";
  if (status === "unread") conditions.push("read = 0");
  if (status === "read") conditions.push("read = 1");
  if (status === "starred") conditions.push("starred = 1");

  const cutoff = parseRelativeTime(options.date_range);
  const timeField = normalizeTimeField(options.time_field);
  if (cutoff) {
    const cutoffIso = cutoff.toISOString();
    if (timeField === "published_at") {
      const nowIso = new Date().toISOString();
      conditions.push(
        "((published_at IS NOT NULL AND published_at <= ? AND published_at >= ?) OR (published_at IS NULL AND inserted_at >= ?))"
      );
      params.push(nowIso, cutoffIso, cutoffIso);
    } else {
      conditions.push("inserted_at >= ?");
      params.push(cutoffIso);
    }
  }

  return {
    where: conditions.length ? conditions.join(" AND ") : "",
    params,
  };
}

function registerFeedTools(server: McpServer) {
  server.registerTool(
    "list_feeds",
    {
      title: "List Feeds",
      description: "List feeds, optionally filtered by group, with optional unread statistics.",
      inputSchema: {
        "group_name": z.string().optional().describe("Filter by feed group name"),
        "include_stats": z.boolean().default(false).describe("Include total and unread counts"),
      },
    },
    async (args) => {
      const feeds = args.group_name ? feedRepo.findByGroupName(args.group_name) : feedRepo.findAll();
      return ok({
        total: feeds.length,
        items: feeds.map((feed) => normalizeFeedRecord(feed, args.include_stats)),
      });
    }
  );

  server.registerTool(
    "get_feed",
    {
      title: "Get Feed",
      description: "Get a single feed by ID.",
      inputSchema: {
        "feed_id": z.string().describe("Feed ID"),
        "include_stats": z.boolean().default(true).describe("Include unread and total counts"),
      },
    },
    async (args) => {
      const feed = feedRepo.findById(args.feed_id);
      if (!feed) return fail("Feed not found");
      return ok(normalizeFeedRecord(feed, args.include_stats));
    }
  );

  server.registerTool(
    "create_feed",
    {
      title: "Create Feed",
      description: "Create a feed subscription and schedule an initial refresh.",
      inputSchema: {
        url: z.string().describe("Feed URL"),
        title: z.string().optional().describe("Optional custom title"),
        "group_name": z.string().optional().describe("Target group name"),
      },
    },
    async (args) => {
      const existing = feedRepo.findByUrl(args.url.trim());
      if (existing) return fail(`Feed already exists: ${existing.title || existing.url}`);
      const feed = feedRepo.create({
        url: args.url.trim(),
        title: args.title || null,
        group_name: args.group_name || "default",
      });
      await refreshFeed(feed.id);
      return ok({
        message: "Feed created",
        item: normalizeFeedRecord(feedRepo.findById(feed.id), true),
      });
    }
  );

  server.registerTool(
    "update_feed",
    {
      title: "Update Feed",
      description: "Update a feed title or group.",
      inputSchema: {
        "feed_id": z.string().describe("Feed ID"),
        title: z.string().optional().describe("Updated title"),
        "group_name": z.string().optional().describe("Updated group name"),
      },
    },
    async (args) => {
      const updates: Record<string, unknown> = {};
      if (args.title !== undefined) updates.title = args.title;
      if (args.group_name !== undefined) updates.group_name = args.group_name;
      const updated = feedRepo.update(args.feed_id, updates);
      if (!updated) return fail("Feed not found");
      return ok({
        message: "Feed updated",
        item: normalizeFeedRecord(updated, true),
      });
    }
  );

  server.registerTool(
    "delete_feed",
    {
      title: "Delete Feed",
      description: "Delete a feed and its related entries, summaries, vectors, logs, and analysis data.",
      inputSchema: {
        "feed_id": z.string().describe("Feed ID"),
      },
    },
    async (args) => {
      const result = deleteFeedWithRelations(args.feed_id);
      if (!result.success) return fail(result.error || "Delete failed");
      return ok({
        message: "Feed deleted",
        item: normalizeFeedRecord(result.feed, false),
      });
    }
  );

  server.registerTool(
    "refresh_feed",
    {
      title: "Refresh Feed",
      description: "Refresh one feed or all feeds.",
      inputSchema: {
        "feed_id": z.string().optional().describe("Feed ID. Omit to refresh all feeds."),
      },
    },
    async (args) => {
      if (args.feed_id) {
        const feed = feedRepo.findById(args.feed_id);
        if (!feed) return fail("Feed not found");
        const result = await refreshFeed(args.feed_id);
        return ok({ scope: "feed", feed_id: args.feed_id, result });
      }
      await refreshAllFeeds();
      return ok({ scope: "all", message: "Refresh scheduled for all feeds" });
    }
  );
}

function registerEntryTools(server: McpServer) {
  server.registerTool(
    "list_entries",
    {
      title: "List Entries",
      description: "List entries using the same time range and cursor model as the main API.",
      inputSchema: {
        "feed_id": z.string().optional().describe("Filter by feed ID"),
        "group_name": z.string().optional().describe("Filter by group name"),
        status: z.enum(["all", "unread", "read", "starred"]).default("all").describe("Entry status"),
        keyword: z.string().optional().describe("Keyword filter on title, summary, or content"),
        "date_range": z.string().optional().describe("Relative time range such as 24h, 3d, 7d, 30d, all"),
        "time_field": z.enum(["published_at", "inserted_at"]).default("inserted_at").describe("Time field base"),
        cursor: z.string().optional().describe("Opaque pagination cursor from previous response"),
        limit: z.number().int().min(1).max(100).default(20).describe("Page size"),
        "include_content": z.boolean().default(false).describe("Include content excerpt"),
        "content_max_length": z.number().int().min(0).max(10000).default(1200).describe("Excerpt length"),
      },
    },
    async (args) => listEntries(args)
  );

  server.registerTool(
    "get_entry",
    {
      title: "Get Entry",
      description: "Get a single entry by ID with optional content excerpt.",
      inputSchema: {
        "entry_id": z.string().describe("Entry ID"),
        "include_content": z.boolean().default(true).describe("Include content excerpt"),
        "content_max_length": z.number().int().min(0).max(20000).default(5000).describe("Excerpt length"),
      },
    },
    async (args) => {
      const row = db.prepare(`
        SELECT e.*, f.title AS feed_title, f.group_name AS group_name
        FROM entries e
        LEFT JOIN feeds f ON f.id = e.feed_id
        WHERE e.id = ?
      `).get(args.entry_id) as any;
      if (!row) return fail("Entry not found");
      return ok(normalizeEntryRecord(row, {
        includeContent: args.include_content,
        contentMaxLength: args.content_max_length,
      }));
    }
  );

  server.registerTool(
    "update_entry",
    {
      title: "Update Entry",
      description: "Update read/starred state for a single entry.",
      inputSchema: {
        "entry_id": z.string().describe("Entry ID"),
        read: z.boolean().optional().describe("Read state"),
        starred: z.boolean().optional().describe("Starred state"),
      },
    },
    async (args) => {
      const updated = entryRepo.update(args.entry_id, {
        read: args.read,
        starred: args.starred,
      });
      if (!updated) return fail("Entry not found");
      return ok({
        message: "Entry updated",
        item: normalizeEntryRecord(updated),
      });
    }
  );

  server.registerTool(
    "batch_update_entries",
    {
      title: "Batch Update Entries",
      description: "Batch update entry read/starred state. Supports dry-run preview before writing.",
      inputSchema: {
        action: z.enum(["mark_read", "mark_unread", "star", "unstar"]).describe("Update action"),
        "entry_ids": z.array(z.string()).optional().describe("Specific entry IDs"),
        "feed_id": z.string().optional().describe("Filter by feed ID"),
        "group_name": z.string().optional().describe("Filter by group name"),
        status: z.enum(["all", "unread", "read", "starred"]).default("all").describe("Current status filter"),
        "date_range": z.string().optional().describe("Relative time range such as 24h, 3d, 7d, 30d"),
        "time_field": z.enum(["published_at", "inserted_at"]).default("inserted_at").describe("Time field base"),
        "dry_run": z.boolean().default(true).describe("Preview affected rows without mutating data"),
      },
    },
    async (args) => {
      const { where, params } = buildBatchWhere(args);
      if (!where) return fail("batch_update_entries requires entry_ids or at least one filter");

      const countSql = `SELECT COUNT(*) as count FROM entries WHERE ${where}`;
      const preview = db.prepare(countSql).get(...params) as { count: number };
      if (args.dry_run) {
        return ok({
          dry_run: true,
          action: args.action,
          affected: preview.count,
        });
      }

      const sqlByAction: Record<string, string> = {
        mark_read: `UPDATE entries SET read = 1 WHERE ${where}`,
        mark_unread: `UPDATE entries SET read = 0 WHERE ${where}`,
        star: `UPDATE entries SET starred = 1 WHERE ${where}`,
        unstar: `UPDATE entries SET starred = 0 WHERE ${where}`,
      };
      const result = db.prepare(sqlByAction[args.action]).run(...params);
      return ok({
        dry_run: false,
        action: args.action,
        affected: result.changes,
      });
    }
  );

  server.registerTool(
    "search_entries",
    {
      title: "Search Entries",
      description: "Search entries using keyword, semantic, or hybrid retrieval.",
      inputSchema: {
        query: z.string().min(1).describe("Search query"),
        mode: z.enum(["keyword", "semantic", "hybrid"]).default("hybrid").describe("Search mode"),
        "feed_id": z.string().optional().describe("Restrict to a feed"),
        "group_name": z.string().optional().describe("Restrict to a group"),
        limit: z.number().int().min(1).max(50).default(10).describe("Result count"),
      },
    },
    async (args) => searchEntries(args)
  );
}

function registerOverviewTools(server: McpServer) {
  server.registerTool(
    "get_reader_overview",
    {
      title: "Get Reader Overview",
      description: "Get reader overview globally, for a feed, or for a group.",
      inputSchema: {
        type: z.enum(["global", "feed", "group"]).default("global").describe("Overview scope"),
        id: z.string().optional().describe("Feed ID for feed scope, group name for group scope"),
      },
    },
    async (args) => {
      try {
        if (args.type === "global") {
          const stats = db.prepare(`
            SELECT
              (SELECT COUNT(*) FROM feeds) as total_feeds,
              (SELECT COUNT(*) FROM entries) as total_entries,
              (SELECT COUNT(*) FROM entries WHERE read = 0) as unread_entries,
              (SELECT COUNT(*) FROM entries WHERE starred = 1) as starred_entries
          `).get() as any;
          const groups = db.prepare(`
            SELECT group_name, COUNT(*) as feed_count
            FROM feeds
            GROUP BY group_name
            ORDER BY group_name ASC
          `).all();
          return ok({ scope: "global", stats, groups });
        }

        if (!args.id) return fail("Overview scope requires id");

        if (args.type === "feed") {
          const feed = feedRepo.findById(args.id);
          if (!feed) return fail("Feed not found");
          const stats = db.prepare(`
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread,
              MAX(COALESCE(published_at, inserted_at)) as latest_entry_at
            FROM entries
            WHERE feed_id = ?
          `).get(args.id);
          return ok({ scope: "feed", feed: normalizeFeedRecord(feed), stats });
        }

        const feeds = feedRepo.findByGroupName(args.id);
        if (feeds.length === 0) return fail(`Group "${args.id}" has no feeds`);
        const feedIds = feeds.map((feed) => feed.id);
        const stats = db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
          FROM entries
          WHERE feed_id IN (${feedIds.map(() => "?").join(",")})
        `).get(...feedIds);
        return ok({
          scope: "group",
          group_name: args.id,
          feed_count: feeds.length,
          feeds: feeds.map((feed) => normalizeFeedRecord(feed)),
          stats,
        });
      } catch (error) {
        return fail(`get_reader_overview failed: ${error}`);
      }
    }
  );

  server.registerTool(
    "get_summary_queue_status",
    {
      title: "Get Summary Queue Status",
      description: "Inspect background summary queue runtime status, saved summary counts, and scan range.",
      inputSchema: {},
    },
    async () => ok(summaryGenerationService.getBackgroundStatus())
  );
}

function registerLegacyAliases(server: McpServer) {
  server.registerTool(
    "query_entries",
    {
      title: "Legacy Query Entries",
      description: "Compatibility alias for list_entries. Prefer list_entries for new agent workflows.",
      inputSchema: {
        feedId: z.string().optional(),
        groupName: z.string().optional(),
        status: z.enum(["all", "unread", "read", "starred"]).default("all"),
        dateRange: z.enum(["all", "today", "week", "month"]).default("all"),
        keyword: z.string().optional(),
        includeContent: z.boolean().default(false),
        contentMaxLength: z.number().int().default(500),
        limit: z.number().int().min(1).max(100).default(20),
        sortBy: z.enum(["date", "title"]).default("date"),
        sortOrder: z.enum(["desc", "asc"]).default("desc"),
      },
    },
    async (args) => {
      const rangeMap: Record<string, string> = {
        all: "all",
        today: "24h",
        week: "7d",
        month: "30d",
      };
      return listEntries({
        feed_id: args.feedId,
        group_name: args.groupName,
        status: args.status,
        keyword: args.keyword,
        include_content: args.includeContent,
        content_max_length: args.contentMaxLength,
        limit: args.limit,
        date_range: rangeMap[args.dateRange] || "all",
        time_field: "published_at",
      });
    }
  );

  server.registerTool(
    "search",
    {
      title: "Legacy Search",
      description: "Compatibility alias for search_entries. Prefer search_entries for new agent workflows.",
      inputSchema: {
        query: z.string().min(1),
        type: z.enum(["keyword", "semantic"]).default("keyword"),
        feedId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async (args) => searchEntries({
      query: args.query,
      mode: args.type,
      feed_id: args.feedId,
      limit: args.limit,
    })
  );

  server.registerTool(
    "manage_feeds",
    {
      title: "Legacy Manage Feeds",
      description: "Compatibility alias. Prefer list/get/create/update/delete/refresh_feed tools.",
      inputSchema: {
        action: z.enum(["list", "get", "add", "update", "remove", "refresh"]),
        groupName: z.string().optional(),
        includeStats: z.boolean().optional(),
        feedId: z.string().optional(),
        url: z.string().optional(),
        title: z.string().optional(),
        group: z.string().optional(),
      },
    },
    async (args) => {
      if (args.action === "list") {
        const feeds = args.groupName ? feedRepo.findByGroupName(args.groupName) : feedRepo.findAll();
        return ok({
          compatibility: true,
          delegated_to: "list_feeds",
          total: feeds.length,
          items: feeds.map((feed) => normalizeFeedRecord(feed, args.includeStats === true)),
        });
      }

      if (args.action === "get") {
        const feed = args.feedId ? feedRepo.findById(args.feedId) : null;
        if (!feed) return fail("Feed not found");
        return ok(normalizeFeedRecord(feed, args.includeStats === true));
      }

      if (args.action === "add") {
        if (!args.url) return fail("manage_feeds add requires url");
        const existing = feedRepo.findByUrl(args.url.trim());
        if (existing) return fail(`Feed already exists: ${existing.title || existing.url}`);
        const feed = feedRepo.create({
          url: args.url.trim(),
          title: args.title || null,
          group_name: args.group || "default",
        });
        await refreshFeed(feed.id);
        return ok({ message: "Feed created", item: normalizeFeedRecord(feedRepo.findById(feed.id), true) });
      }

      if (args.action === "update") {
        if (!args.feedId) return fail("manage_feeds update requires feedId");
        const updated = feedRepo.update(args.feedId, {
          title: args.title,
          group_name: args.group,
        });
        if (!updated) return fail("Feed not found");
        return ok({ message: "Feed updated", item: normalizeFeedRecord(updated, true) });
      }

      if (args.action === "remove") {
        if (!args.feedId) return fail("manage_feeds remove requires feedId");
        const result = deleteFeedWithRelations(args.feedId);
        if (!result.success) return fail(result.error || "Delete failed");
        return ok({ message: "Feed deleted", item: normalizeFeedRecord(result.feed, false) });
      }

      if (args.action === "refresh") {
        if (args.feedId) {
          const result = await refreshFeed(args.feedId);
          return ok({ scope: "feed", feed_id: args.feedId, result });
        }
        await refreshAllFeeds();
        return ok({ scope: "all", message: "Refresh scheduled for all feeds" });
      }

      return fail("Unsupported manage_feeds action");
    }
  );

  server.registerTool(
    "batch_update",
    {
      title: "Legacy Batch Update",
      description: "Compatibility alias for batch_update_entries. Prefer batch_update_entries.",
      inputSchema: {
        action: z.enum(["mark_read", "mark_unread", "star", "unstar"]),
        entryIds: z.array(z.string()).optional(),
        feedId: z.string().optional(),
        status: z.enum(["unread", "read", "starred"]).optional(),
        beforeDate: z.string().optional(),
      },
    },
    async (args) => {
      const params = args.entryIds?.length
        ? { entry_ids: args.entryIds }
        : {
            feed_id: args.feedId,
            status: (args.status as EntryStatus | undefined) ?? "all",
          };

      const { where, params: sqlParams } = buildBatchWhere({
        ...params,
        time_field: "published_at",
      });
      let finalWhere = where;
      const finalParams = [...sqlParams];
      if (args.beforeDate) {
        finalWhere = finalWhere ? `${finalWhere} AND published_at < ?` : "published_at < ?";
        finalParams.push(args.beforeDate);
      }
      if (!finalWhere) return fail("batch_update requires entryIds or a filter");

      const sqlByAction: Record<string, string> = {
        mark_read: `UPDATE entries SET read = 1 WHERE ${finalWhere}`,
        mark_unread: `UPDATE entries SET read = 0 WHERE ${finalWhere}`,
        star: `UPDATE entries SET starred = 1 WHERE ${finalWhere}`,
        unstar: `UPDATE entries SET starred = 0 WHERE ${finalWhere}`,
      };
      const result = db.prepare(sqlByAction[args.action]).run(...finalParams);
      return ok({ affected: result.changes, compatibility: true });
    }
  );

  server.registerTool(
    "get_overview",
    {
      title: "Legacy Overview",
      description: "Compatibility alias for get_reader_overview.",
      inputSchema: {
        type: z.enum(["global", "feed", "group"]).default("global"),
        id: z.string().optional(),
      },
    },
    async (args) => {
      if (args.type === "global") {
        const stats = db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM feeds) as total_feeds,
            (SELECT COUNT(*) FROM entries) as total_entries,
            (SELECT COUNT(*) FROM entries WHERE read = 0) as unread_entries,
            (SELECT COUNT(*) FROM entries WHERE starred = 1) as starred_entries
        `).get();
        return ok({ compatibility: true, scope: "global", stats });
      }

      if (!args.id) return fail("Overview scope requires id");
      if (args.type === "feed") {
        const feed = feedRepo.findById(args.id);
        if (!feed) return fail("Feed not found");
        return ok({ compatibility: true, scope: "feed", feed: normalizeFeedRecord(feed, true) });
      }

      const feeds = feedRepo.findByGroupName(args.id);
      return ok({ compatibility: true, scope: "group", group_name: args.id, feeds: feeds.map((feed) => normalizeFeedRecord(feed)) });
    }
  );
}

export function registerAllTools(server: McpServer) {
  registerFeedTools(server);
  registerEntryTools(server);
  registerOverviewTools(server);
  registerLegacyAliases(server);
}
