import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../../db/session.js";
import {
  AIAutomationRuleRepository,
  AnalysisStatusRepository,
  EntryRepository,
  EntryTagRepository,
  FeedRepository,
  SummaryRepository,
  TagRepository,
  TranslationRepository,
} from "../../db/repositories/index.js";
import { refreshFeed, refreshAllFeeds } from "../../services/fetcher.js";
import { searchVectors } from "../../services/vector.js";
import { normalizeTimeField, parseRelativeTime } from "../../utils/dateRange.js";
import { summaryGenerationService } from "../../services/summaryGenerationService.js";
import { AIClient, type ServiceKey } from "../../services/ai.js";
import { getConfig } from "../../config/index.js";
import { userSettingsService } from "../../services/userSettings.js";
import {
  AUTOMATION_SCOPE_TYPES,
  AUTOMATION_TASK_KEYS,
  aiAutomationResolver,
} from "../../services/aiAutomationResolver.js";
import {
  normalizeScopeSummaryWindowType,
  scopeSummaryService,
} from "../../services/scopeSummary.js";
import { analyzeEntryTags, getTaggingConfig } from "../../services/tagging.js";
import type { AIAutomationMode, AIScopeType, AITaskKey } from "../../db/models.js";
import {
  aggregateDigestService,
  buildDigestSourceHash,
  buildDigestTimeWindow,
  type DigestSourceItem,
} from "../../services/aggregateDigest.js";

const db = getDatabase();
const feedRepo = new FeedRepository();
const entryRepo = new EntryRepository();
const translationRepo = new TranslationRepository();
const summaryRepo = new SummaryRepository();
const tagRepo = new TagRepository();
const entryTagRepo = new EntryTagRepository();
const analysisRepo = new AnalysisStatusRepository();
const automationRuleRepo = new AIAutomationRuleRepository();
const sortTimeExpr = "COALESCE(e.published_at, e.inserted_at)";
const SQLITE_IN_CLAUSE_CHUNK_SIZE = 900;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type EntryStatus = "all" | "unread" | "read" | "starred";
type SearchMode = "keyword" | "semantic" | "hybrid";

export const MCP_RECOMMENDED_TOOLS = [
  "list_feeds",
  "get_feed",
  "create_feed",
  "update_feed",
  "delete_feed",
  "refresh_feed",
  "list_entries",
  "get_entry",
  "update_entry",
  "batch_update_entries",
  "search_entries",
  "get_reader_overview",
  "get_summary_queue_status",
  "summarize_entry",
  "translate_entry_title",
  "translate_text",
  "get_scope_summary",
  "generate_scope_summary",
  "get_ai_automation_rules",
  "update_ai_automation_rules",
  "list_tags",
  "list_pending_tag_analysis",
  "list_untagged_entries",
  "analyze_entry_tags",
  "reanalyze_entry_tags",
  "skip_entry_tag_analysis",
  "get_digest",
  "regenerate_digest",
] as const;

export const MCP_LEGACY_ALIAS_TOOLS = [
  "query_entries",
  "search",
  "manage_feeds",
  "batch_update",
  "get_overview",
] as const;

export const MCP_TOOL_GROUPS = [
  {
    id: "feeds",
    tools: ["list_feeds", "get_feed", "create_feed", "update_feed", "delete_feed", "refresh_feed"],
  },
  {
    id: "entries",
    tools: ["list_entries", "get_entry", "update_entry", "batch_update_entries", "search_entries"],
  },
  {
    id: "overview",
    tools: ["get_reader_overview", "get_summary_queue_status"],
  },
  {
    id: "ai",
    tools: [
      "summarize_entry",
      "translate_entry_title",
      "translate_text",
      "get_scope_summary",
      "generate_scope_summary",
      "get_ai_automation_rules",
      "update_ai_automation_rules",
    ],
  },
  {
    id: "tags",
    tools: [
      "list_tags",
      "list_pending_tag_analysis",
      "list_untagged_entries",
      "analyze_entry_tags",
      "reanalyze_entry_tags",
      "skip_entry_tag_analysis",
    ],
  },
  {
    id: "digest",
    tools: ["get_digest", "regenerate_digest"],
  },
] as const;

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

function resolveMcpDateRange(dateRange?: string): string {
  if (dateRange && dateRange.trim()) {
    return dateRange.trim();
  }
  const settings = userSettingsService.getSettings();
  return settings.default_date_range || "30d";
}

function resolveMcpTimeField(timeField?: string): "published_at" | "inserted_at" {
  if (timeField) {
    return normalizeTimeField(timeField);
  }
  const settings = userSettingsService.getSettings();
  return normalizeTimeField(settings.time_field);
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

function encodeSearchCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf-8").toString("base64url");
}

function decodeSearchCursor(cursor: string): number {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8");
  const parsed = JSON.parse(raw) as { o?: number };
  if (!Number.isInteger(parsed?.o) || (parsed.o ?? 0) < 0) {
    throw new Error("Invalid search cursor");
  }
  return parsed.o ?? 0;
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

function resolveServiceConfig(service: ServiceKey) {
  const settings = userSettingsService.getSettings();
  const config = getConfig();

  const globalApiKey = settings.default_ai_api_key || config.glmApiKey || "";
  const globalBaseUrl = settings.default_ai_base_url || config.glmBaseUrl || "";
  const globalModel = settings.default_ai_model || config.glmModel || "";

  const serviceFields: Record<ServiceKey, { useCustom: string; apiKey: string; baseUrl: string; model: string }> = {
    summary: {
      useCustom: "summary_use_custom",
      apiKey: "summary_api_key",
      baseUrl: "summary_base_url",
      model: "summary_model_name",
    },
    translation: {
      useCustom: "translation_use_custom",
      apiKey: "translation_api_key",
      baseUrl: "translation_base_url",
      model: "translation_model_name",
    },
    tagging: {
      useCustom: "tagging_use_custom",
      apiKey: "tagging_api_key",
      baseUrl: "tagging_base_url",
      model: "tagging_model_name",
    },
    embedding: {
      useCustom: "embedding_use_custom",
      apiKey: "embedding_api_key",
      baseUrl: "embedding_base_url",
      model: "embedding_model",
    },
  };

  const fields = serviceFields[service];
  const useCustom = service === "embedding" || (settings as any)[fields.useCustom] === 1;
  if (useCustom) {
    return {
      apiKey: (settings as any)[fields.apiKey] || "",
      baseUrl: (settings as any)[fields.baseUrl] || "",
      modelName: (settings as any)[fields.model] || "",
    };
  }

  return {
    apiKey: globalApiKey,
    baseUrl: globalBaseUrl,
    modelName: globalModel,
  };
}

function createClient(service: ServiceKey) {
  const resolved = resolveServiceConfig(service);
  return new AIClient({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.modelName,
  });
}

function buildSummaryContent(entry: {
  title?: string | null;
  author?: string | null;
  published_at?: string | null;
  readability_content?: string | null;
  content?: string | null;
  summary?: string | null;
}): string | null {
  const content = entry.readability_content || entry.content || entry.summary;
  if (!content) return null;

  const metaLines: string[] = [];
  if (entry.title) metaLines.push(`Title: ${entry.title}`);
  if (entry.author) metaLines.push(`Author: ${entry.author}`);
  if (entry.published_at) metaLines.push(`Published: ${entry.published_at}`);

  if (!metaLines.length) return content;
  return `Metadata:\n${metaLines.join("\n")}\n\nContent:\n${content}`;
}

function getLegacyAutomationDefaults() {
  return AUTOMATION_TASK_KEYS.map((task_key) => ({
    task_key,
    scope_type: "global" as const,
    scope_id: null,
    enabled: aiAutomationResolver.resolve({ taskKey: task_key, scopeType: "global" }),
    source: "legacy_fallback" as const,
  }));
}

function normalizeDigestLanguage(language?: string | null): "zh" | "en" | "ja" | "ko" {
  const value = (language || "").toLowerCase();
  if (value.startsWith("en")) return "en";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("ko")) return "ko";
  return "zh";
}

function parseJsonRecord<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseKeywordsJson(raw: string | null | undefined): string[] {
  const parsed = parseJsonRecord<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
}

function toDigestSourceItems(rows: Array<{
  id: string;
  title: string | null;
  summary: string | null;
  feed_title?: string | null;
  group_name?: string | null;
  published_at?: string | null;
  inserted_at: string;
}>): DigestSourceItem[] {
  return rows.map((entry, index) => ({
    ref: index + 1,
    entry_id: entry.id,
    title: entry.title || "Untitled",
    summary: entry.summary,
    feed_title: entry.feed_title || null,
    group_name: entry.group_name || null,
    published_at: entry.published_at || entry.inserted_at,
  }));
}

function buildTagDigestEntries(tagId: string, period?: string) {
  const { startDate, normalizedPeriod, periodKey } = buildDigestTimeWindow(period);
  const rows = startDate
    ? db.prepare(`
        SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title, f.group_name as group_name
        FROM entries e
        INNER JOIN entry_tags et ON e.id = et.entry_id
        LEFT JOIN feeds f ON e.feed_id = f.id
        WHERE et.tag_id = ?
          AND e.inserted_at >= ?
        ORDER BY e.inserted_at DESC
        LIMIT 20
      `).all(tagId, startDate) as Array<any>
    : db.prepare(`
        SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title, f.group_name as group_name
        FROM entries e
        INNER JOIN entry_tags et ON e.id = et.entry_id
        LEFT JOIN feeds f ON e.feed_id = f.id
        WHERE et.tag_id = ?
        ORDER BY e.inserted_at DESC
        LIMIT 20
      `).all(tagId) as Array<any>;

  return {
    rows,
    startDate,
    normalizedPeriod,
    periodKey,
    sourceHash: buildDigestSourceHash(toDigestSourceItems(rows)),
  };
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
  const timeField = resolveMcpTimeField(options.time_field);
  const dateRange = resolveMcpDateRange(options.date_range);

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

  const cutoff = parseRelativeTime(dateRange);
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

  return { where, params, timeField, dateRange };
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
    const { where, params, timeField, dateRange } = buildEntryFilters(args);
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
      date_range: dateRange,
      time_field: timeField,
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
  date_range?: string;
  time_field?: string;
  limit?: number;
  cursor?: string;
}): Promise<ToolResult> {
  try {
    const query = args.query.trim();
    if (!query) return fail("search_entries requires query");

    const mode = args.mode ?? "hybrid";
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
    const offset = args.cursor ? decodeSearchCursor(args.cursor) : 0;
    const fetchTarget = Math.max(limit + offset + 5, (limit + offset) * 2);
    const timeField = resolveMcpTimeField(args.time_field);
    const dateRange = resolveMcpDateRange(args.date_range);
    const cutoff = parseRelativeTime(dateRange);
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
        if (cutoff) {
          const cutoffIso = cutoff.toISOString();
          if (timeField === "published_at") {
            const nowIso = new Date().toISOString();
            sql += " AND ((e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?) OR (e.published_at IS NULL AND e.inserted_at >= ?))";
            sqlParams.push(nowIso, cutoffIso, cutoffIso);
          } else {
            sql += " AND e.inserted_at >= ?";
            sqlParams.push(cutoffIso);
          }
        }
        sql += " ORDER BY rank ASC, e.published_at DESC LIMIT ?";
        sqlParams.push(fetchTarget);

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
        if (cutoff) {
          const cutoffIso = cutoff.toISOString();
          if (timeField === "published_at") {
            const nowIso = new Date().toISOString();
            sql += " AND ((e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?) OR (e.published_at IS NULL AND e.inserted_at >= ?))";
            sqlParams.push(nowIso, cutoffIso, cutoffIso);
          } else {
            sql += " AND e.inserted_at >= ?";
            sqlParams.push(cutoffIso);
          }
        }
        sql += " ORDER BY e.published_at DESC, e.inserted_at DESC LIMIT ?";
        sqlParams.push(fetchTarget);

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
        const vectorResults = await searchVectors(query, fetchTarget);
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
          if (cutoff) {
            const cutoffIso = cutoff.toISOString();
            if (timeField === "published_at") {
              const publishedAt = row.published_at as string | null | undefined;
              const insertedAt = row.inserted_at as string | null | undefined;
              const matchesPublished = publishedAt && publishedAt <= new Date().toISOString() && publishedAt >= cutoffIso;
              const matchesFallback = !publishedAt && insertedAt && insertedAt >= cutoffIso;
              if (!matchesPublished && !matchesFallback) continue;
            } else {
              const insertedAt = row.inserted_at as string | null | undefined;
              if (!insertedAt || insertedAt < cutoffIso) continue;
            }
          }

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

    const uniqueResults = results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.published_at || a.inserted_at || "";
      const bTime = b.published_at || b.inserted_at || "";
      if (aTime !== bTime) return bTime.localeCompare(aTime);
      return b.id.localeCompare(a.id);
    });
    const pageResults = uniqueResults.slice(offset, offset + limit);
    const hasMore = uniqueResults.length > offset + limit;
    const nextCursor = hasMore ? encodeSearchCursor(offset + limit) : null;

    return ok({
      query,
      mode,
      date_range: dateRange,
      time_field: timeField,
      total: uniqueResults.length,
      returned: pageResults.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      results: pageResults.map((item) => ({
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
        "date_range": z.string().optional().describe("Relative time range such as 24h, 3d, 7d, 30d, all. Defaults to app settings."),
        "time_field": z.enum(["published_at", "inserted_at"]).optional().describe("Time field base. Defaults to app settings."),
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
      description: "Search entries using keyword, semantic, or hybrid retrieval. Supports opaque cursor pagination for candidate discovery.",
      inputSchema: {
        query: z.string().min(1).describe("Search query"),
        mode: z.enum(["keyword", "semantic", "hybrid"]).default("hybrid").describe("Search mode"),
        "feed_id": z.string().optional().describe("Restrict to a feed"),
        "group_name": z.string().optional().describe("Restrict to a group"),
        "date_range": z.string().optional().describe("Relative time range such as 24h, 3d, 7d, 30d, all. Defaults to app settings."),
        "time_field": z.enum(["published_at", "inserted_at"]).optional().describe("Time field base. Defaults to app settings."),
        limit: z.number().int().min(1).max(50).default(10).describe("Result count"),
        cursor: z.string().optional().describe("Opaque pagination cursor from previous search result"),
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

function registerAITools(server: McpServer) {
  server.registerTool(
    "summarize_entry",
    {
      title: "Summarize Entry",
      description: "Generate or reuse a saved summary for an entry.",
      inputSchema: {
        "entry_id": z.string().describe("Entry ID"),
        language: z.string().optional().describe("Target summary language"),
        force: z.boolean().default(false).describe("Regenerate even if a saved summary exists"),
      },
    },
    async (args) => {
      const entry = entryRepo.findById(args.entry_id);
      if (!entry) return fail("Entry not found");

      const settings = userSettingsService.getSettings();
      const language = args.language || settings.ai_translation_language || "zh";
      const existing = summaryRepo.findByEntryIdAndLanguage(args.entry_id, language);
      if (!args.force && existing?.summary) {
        return ok({
          entry_id: args.entry_id,
          language,
          summary: existing.summary,
          from_cache: true,
        });
      }

      const content = buildSummaryContent(entry);
      if (!content) return fail("Entry has no content to summarize");

      try {
        const client = createClient("summary");
        const summary = await client.summarize(content, {
          language,
          userPreference: settings.summary_prompt_preference || "",
          maxTokens: settings.ai_summary_max_tokens || 0,
        });
        summaryRepo.upsert({ entry_id: args.entry_id, language, summary });
        return ok({
          entry_id: args.entry_id,
          language,
          summary,
          from_cache: false,
        });
      } catch (error) {
        return fail(`summarize_entry failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "translate_entry_title",
    {
      title: "Translate Entry Title",
      description: "Translate and save an entry title.",
      inputSchema: {
        "entry_id": z.string().describe("Entry ID"),
        language: z.string().optional().describe("Target language"),
        force: z.boolean().default(false).describe("Regenerate even if a saved translation exists"),
      },
    },
    async (args) => {
      const entry = entryRepo.findById(args.entry_id);
      if (!entry) return fail("Entry not found");
      if (!entry.title) {
        return ok({ entry_id: args.entry_id, title: "", language: args.language || "zh" });
      }

      const settings = userSettingsService.getSettings();
      const language = args.language || settings.ai_translation_language || "zh";
      const existing = translationRepo.findByEntryIdAndLanguage(args.entry_id, language);
      if (!args.force && existing?.title) {
        return ok({
          entry_id: args.entry_id,
          language,
          title: existing.title,
          from_cache: true,
        });
      }

      try {
        const client = createClient("translation");
        const title = await client.translate(entry.title, {
          targetLanguage: language,
          userPreference: settings.translation_prompt_preference || "",
        });
        translationRepo.upsert({ entry_id: args.entry_id, language, title });
        return ok({
          entry_id: args.entry_id,
          language,
          title,
          from_cache: false,
        });
      } catch (error) {
        return fail(`translate_entry_title failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "translate_text",
    {
      title: "Translate Text",
      description: "Translate freeform text using the configured translation model.",
      inputSchema: {
        text: z.string().min(1).describe("Text to translate"),
        language: z.string().optional().describe("Target language"),
      },
    },
    async (args) => {
      const settings = userSettingsService.getSettings();
      const language = args.language || settings.ai_translation_language || "zh";
      try {
        const client = createClient("translation");
        const translation = await client.translate(args.text, {
          targetLanguage: language,
          userPreference: settings.translation_prompt_preference || "",
        });
        return ok({
          language,
          translation,
        });
      } catch (error) {
        return fail(`translate_text failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "get_scope_summary",
    {
      title: "Get Scope Summary",
      description: "Get feed or group scope summary state for a time window.",
      inputSchema: {
        "scope_type": z.enum(["feed", "group"]).describe("Scope type"),
        "scope_id": z.string().describe("Feed ID or group name"),
        "window_type": z.enum(["24h", "3d", "7d", "30d"]).optional().describe("Time window"),
        language: z.string().optional().describe("Summary language"),
      },
    },
    async (args) => {
      const state = scopeSummaryService.buildScopeState({
        scope_type: args.scope_type,
        scope_id: args.scope_id,
        window_type: args.window_type,
        language: args.language || "zh",
      });
      if (!state) return fail("Scope summary scope not found");

      const latest = scopeSummaryService.parseRun(state.latestRun);
      const entryIndexMap: Record<number, string> = {};
      state.items.forEach((item) => {
        entryIndexMap[item.ref - 1] = item.entry_id;
      });

      return ok({
        scope_label: state.scopeLabel,
        scope_type: args.scope_type,
        scope_id: args.scope_id,
        window_type: state.windowType,
        window_start_at: state.windowStartAt,
        window_end_at: state.windowEndAt,
        status: state.status,
        recent_count: state.items.length,
        entries: state.rows,
        entry_index_map: entryIndexMap,
        item: latest ? {
          ...latest,
          summary: latest.summary_md,
          summary_updated_at: latest.updated_at,
        } : null,
        settings: state.settings,
      });
    }
  );

  server.registerTool(
    "generate_scope_summary",
    {
      title: "Generate Scope Summary",
      description: "Generate a scope summary for a feed or group. Agent guidance: if you have enough capability, first discover the relevant article list for the requested scope and time window yourself; when the result set is large, page through it in batches, record the important candidates, read and compare the source material, and then produce a higher-quality summary focused on the user's chosen theme. When needed, follow original links for deeper reading before writing the final summary.",
      inputSchema: {
        "scope_type": z.enum(["feed", "group"]).describe("Scope type"),
        "scope_id": z.string().describe("Feed ID or group name"),
        "window_type": z.enum(["24h", "3d", "7d", "30d"]).optional().describe("Time window"),
        language: z.string().optional().describe("Summary language"),
        "trigger_type": z.enum(["auto", "manual"]).default("manual").describe("Trigger type"),
      },
    },
    async (args) => {
      try {
        const generated = await scopeSummaryService.generate({
          scope_type: args.scope_type,
          scope_id: args.scope_id,
          window_type: normalizeScopeSummaryWindowType(args.window_type),
          language: args.language || "zh",
          trigger_type: args.trigger_type,
        });
        const parsed = scopeSummaryService.parseRun(generated.run);
        return ok({
          scope_label: generated.state.scopeLabel,
          scope_type: args.scope_type,
          scope_id: args.scope_id,
          window_type: generated.state.windowType,
          status: "ready",
          recent_count: generated.state.items.length,
          item: parsed ? {
            ...parsed,
            summary: parsed.summary_md,
            summary_updated_at: parsed.updated_at,
          } : null,
          entries: generated.entries,
        });
      } catch (error) {
        return fail(`generate_scope_summary failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "get_ai_automation_rules",
    {
      title: "Get AI Automation Rules",
      description: "Get explicit automation rules and current global fallback defaults.",
      inputSchema: {},
    },
    async () => ok({
      items: automationRuleRepo.findAll(),
      defaults: getLegacyAutomationDefaults(),
    })
  );

  server.registerTool(
    "update_ai_automation_rules",
    {
      title: "Update AI Automation Rules",
      description: "Upsert or remove automation rules for global, feed, group, or tag scope.",
      inputSchema: {
        upserts: z.array(z.object({
          task_key: z.enum(AUTOMATION_TASK_KEYS as [AITaskKey, ...AITaskKey[]]),
          scope_type: z.enum(AUTOMATION_SCOPE_TYPES as [AIScopeType, ...AIScopeType[]]),
          scope_id: z.string().nullable().optional(),
          mode: z.enum(["inherit", "enabled", "disabled"] as [AIAutomationMode, ...AIAutomationMode[]]),
        })).default([]),
        removals: z.array(z.object({
          task_key: z.enum(AUTOMATION_TASK_KEYS as [AITaskKey, ...AITaskKey[]]),
          scope_type: z.enum(AUTOMATION_SCOPE_TYPES as [AIScopeType, ...AIScopeType[]]),
          scope_id: z.string().nullable().optional(),
        })).default([]),
      },
    },
    async (args) => {
      for (const item of args.upserts) {
        const scopeId = item.scope_id && item.scope_id.trim() ? item.scope_id.trim() : null;
        if (item.scope_type !== "global" && !scopeId) {
          return fail("scope_id is required for non-global automation rules");
        }
        automationRuleRepo.upsert({
          task_key: item.task_key,
          scope_type: item.scope_type,
          scope_id: scopeId,
          mode: item.mode,
        });
      }

      for (const item of args.removals) {
        const scopeId = item.scope_id && item.scope_id.trim() ? item.scope_id.trim() : null;
        if (item.scope_type !== "global" && !scopeId) {
          return fail("scope_id is required for non-global automation removals");
        }
        automationRuleRepo.deleteByTaskAndScope(item.task_key, item.scope_type, scopeId);
      }

      return ok({
        success: true,
        items: automationRuleRepo.findAll(),
        defaults: getLegacyAutomationDefaults(),
      });
    }
  );
}

function registerTagTools(server: McpServer) {
  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List user tags with entry counts.",
      inputSchema: {
        enabled_only: z.boolean().default(false).describe("Only enabled tags"),
      },
    },
    async (args) => {
      const tags = args.enabled_only ? tagRepo.findAllEnabled() : tagRepo.getAllWithEntryCounts();
      const items = tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        color: tag.color,
        enabled: tag.enabled === 1,
        match_mode: tag.match_mode,
        entry_count: typeof tag.entry_count === "number" ? tag.entry_count : tagRepo.getTagCountWithEntries(tag.id),
      }));
      return ok({ total: items.length, items });
    }
  );

  server.registerTool(
    "list_pending_tag_analysis",
    {
      title: "List Pending Tag Analysis",
      description: "List entries that are pending AI tag analysis.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        date_range: z.string().optional(),
        time_field: z.enum(["published_at", "inserted_at"]).default("inserted_at"),
      },
    },
    async (args) => {
      const config = getTaggingConfig();
      const result = analysisRepo.getPendingEntries({
        limit: args.limit,
        cursor: args.cursor,
        startAt: config.autoTaggingStartAt || undefined,
        date_range: args.date_range,
        time_field: args.time_field,
      });
      return ok(result);
    }
  );

  server.registerTool(
    "list_untagged_entries",
    {
      title: "List Untagged Entries",
      description: "List analyzed entries that still have no tags.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        date_range: z.string().optional(),
        time_field: z.enum(["published_at", "inserted_at"]).default("inserted_at"),
      },
    },
    async (args) => {
      const config = getTaggingConfig();
      const result = analysisRepo.getEntriesWithoutTags({
        limit: args.limit,
        cursor: args.cursor,
        startAt: config.autoTaggingStartAt || undefined,
        date_range: args.date_range,
        time_field: args.time_field,
      });
      return ok(result);
    }
  );

  server.registerTool(
    "analyze_entry_tags",
    {
      title: "Analyze Entry Tags",
      description: "Run tag analysis for a single entry and persist the result.",
      inputSchema: {
        entry_id: z.string().describe("Entry ID"),
      },
    },
    async (args) => {
      const entry = entryRepo.findById(args.entry_id);
      if (!entry) return fail("Entry not found");

      const tags = tagRepo.findAllEnabled();
      if (tags.length === 0) return fail("No enabled tags configured");

      const config = getTaggingConfig();
      if (!config.apiKey || !config.baseUrl || !config.modelName) {
        return fail("Tagging AI config is incomplete");
      }

      try {
        const result = await analyzeEntryTags(
          {
            title: entry.title || "",
            summary: entry.summary,
            content: entry.content,
          },
          tags
        );

        if (result.success) {
          entryTagRepo.removeAllTags(args.entry_id);
          if (result.tagIds.length > 0) {
            entryTagRepo.addTags(args.entry_id, result.tagIds, false);
          }
          analysisRepo.updateStatus(args.entry_id, "analyzed", config.tagsVersion);
        }

        const tagNames = result.tagIds
          .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
          .filter((name): name is string => Boolean(name));

        return ok({
          success: result.success,
          entry_id: args.entry_id,
          tag_ids: result.tagIds,
          tag_names: tagNames,
          error: result.error,
        });
      } catch (error) {
        return fail(`analyze_entry_tags failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "reanalyze_entry_tags",
    {
      title: "Reanalyze Entry Tags",
      description: "Alias of analyze_entry_tags for explicit retry semantics.",
      inputSchema: {
        entry_id: z.string().describe("Entry ID"),
      },
    },
    async (args) => {
      const entry = entryRepo.findById(args.entry_id);
      if (!entry) return fail("Entry not found");

      const tags = tagRepo.findAllEnabled();
      if (tags.length === 0) return fail("No enabled tags configured");

      const config = getTaggingConfig();
      if (!config.apiKey || !config.baseUrl || !config.modelName) {
        return fail("Tagging AI config is incomplete");
      }

      try {
        const result = await analyzeEntryTags(
          {
            title: entry.title || "",
            summary: entry.summary,
            content: entry.content,
          },
          tags
        );

        if (result.success) {
          entryTagRepo.removeAllTags(args.entry_id);
          if (result.tagIds.length > 0) {
            entryTagRepo.addTags(args.entry_id, result.tagIds, false);
          }
          analysisRepo.updateStatus(args.entry_id, "analyzed", config.tagsVersion);
        }

        const tagNames = result.tagIds
          .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
          .filter((name): name is string => Boolean(name));

        return ok({
          success: result.success,
          entry_id: args.entry_id,
          tag_ids: result.tagIds,
          tag_names: tagNames,
          error: result.error,
        });
      } catch (error) {
        return fail(`reanalyze_entry_tags failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  server.registerTool(
    "skip_entry_tag_analysis",
    {
      title: "Skip Entry Tag Analysis",
      description: "Mark an entry as skipped so auto-tagging will ignore it.",
      inputSchema: {
        entry_id: z.string().describe("Entry ID"),
      },
    },
    async (args) => {
      const entry = entryRepo.findById(args.entry_id);
      if (!entry) return fail("Entry not found");
      analysisRepo.updateStatus(args.entry_id, "skipped");
      return ok({
        success: true,
        entry_id: args.entry_id,
        status: "skipped",
      });
    }
  );
}

function registerDigestTools(server: McpServer) {
  server.registerTool(
    "get_digest",
    {
      title: "Get Digest",
      description: "Get the latest aggregate digest for a tag, including current source items and saved summary if available.",
      inputSchema: {
        tag_id: z.string().describe("Tag ID"),
        period: z.enum(["latest", "week"]).default("latest").describe("Digest period"),
        language: z.string().optional().describe("Digest language"),
      },
    },
    async (args) => {
      const tag = tagRepo.findById(args.tag_id);
      if (!tag) return fail("Tag not found");

      const language = normalizeDigestLanguage(args.language || userSettingsService.getSettings().language || "zh");
      const digestState = buildTagDigestEntries(args.tag_id, args.period);
      const latest = aggregateDigestService.getLatest({
        scope_type: "tag",
        scope_id: args.tag_id,
        period: digestState.normalizedPeriod,
        time_range_key: digestState.periodKey,
        language,
      });

      return ok({
        tag: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
        },
        period: digestState.normalizedPeriod,
        time_range_key: digestState.periodKey,
        source_count: digestState.rows.length,
        entries: digestState.rows.slice(0, 5),
        item: latest ? {
          ...latest,
          summary: latest.summary_md,
          citations: parseJsonRecord(latest.citations_json, []),
          keywords: parseKeywordsJson(latest.keywords_json),
        } : null,
      });
    }
  );

  server.registerTool(
    "regenerate_digest",
    {
      title: "Regenerate Digest",
      description: "Force regenerate a digest for a tag and save it.",
      inputSchema: {
        tag_id: z.string().describe("Tag ID"),
        period: z.enum(["latest", "week"]).default("latest").describe("Digest period"),
        language: z.string().optional().describe("Digest language"),
      },
    },
    async (args) => {
      const tag = tagRepo.findById(args.tag_id);
      if (!tag) return fail("Tag not found");

      const language = normalizeDigestLanguage(args.language || userSettingsService.getSettings().language || "zh");
      const digestState = buildTagDigestEntries(args.tag_id, args.period);
      if (!digestState.rows.length) {
        return fail("No entries available for digest generation in the selected period");
      }

      try {
        const generated = await aggregateDigestService.generate({
          scope_type: "tag",
          scope_id: tag.id,
          scope_label: tag.name,
          period: digestState.normalizedPeriod,
          time_range_key: digestState.periodKey,
          language,
          items: toDigestSourceItems(digestState.rows),
          trigger_type: "manual",
        });

        aggregateDigestService.mirrorLegacyTagDigest({
          tag_id: tag.id,
          period: digestState.normalizedPeriod,
          time_range_key: digestState.periodKey,
          language: generated.language,
          source_count: digestState.rows.length,
          source_hash: generated.sourceHash,
          summary: generated.payload.summary_md,
          keywords: generated.payload.keywords || [],
          model_name: generated.modelName,
          trigger_type: "manual",
        });

        return ok({
          tag: {
            id: tag.id,
            name: tag.name,
          },
          period: digestState.normalizedPeriod,
          time_range_key: digestState.periodKey,
          source_count: digestState.rows.length,
          item: {
            summary: generated.payload.summary_md,
            citations: generated.payload.citations,
            keywords: generated.payload.keywords || [],
            summary_updated_at: generated.record.created_at,
          },
        });
      } catch (error) {
        return fail(`regenerate_digest failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
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
  registerAITools(server);
  registerTagTools(server);
  registerDigestTools(server);
  registerLegacyAliases(server);
}
