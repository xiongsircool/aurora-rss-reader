
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../../db/session.js";
import { FeedRepository } from "../../db/repositories/feed.js";
import { refreshFeed, refreshAllFeeds } from "../../services/fetcher.js";
import { searchVectors } from "../../services/vector.js";

const feedRepo = new FeedRepository();

/**
 * Register all MCP tools with proper descriptions for AI understanding
 */
export function registerAllTools(server: McpServer) {

    // ============================================
    // Tool 1: query_entries - 文章查询
    // ============================================
    server.registerTool(
        "query_entries",
        {
            title: "查询文章",
            description: "查询 RSS 文章列表。支持按状态（未读/已读/收藏）、时间范围（今天/本周/本月）、订阅源、分组、关键词过滤。可选择是否返回文章内容。",
            inputSchema: {
                feedId: z.string().optional().describe("按订阅源 ID 过滤"),
                groupName: z.string().optional().describe("按分组名称过滤（如：AI媒体、bio）"),
                status: z.enum(["all", "unread", "read", "starred"]).default("all")
                    .describe("文章状态过滤"),
                dateRange: z.enum(["all", "today", "week", "month"]).default("all")
                    .describe("时间范围快捷过滤"),
                dateFrom: z.string().optional().describe("自定义开始日期 (ISO格式: 2024-01-01)"),
                dateTo: z.string().optional().describe("自定义结束日期"),
                keyword: z.string().optional().describe("按标题/摘要关键词过滤"),
                includeContent: z.boolean().default(false)
                    .describe("是否返回文章内容（用于 AI 阅读/总结）"),
                contentMaxLength: z.number().int().default(500)
                    .describe("返回内容的最大字符数"),
                limit: z.number().int().min(1).max(100).default(20).describe("返回数量"),
                offset: z.number().int().min(0).default(0).describe("分页偏移"),
                sortBy: z.enum(["date", "title"]).default("date").describe("排序方式"),
                sortOrder: z.enum(["desc", "asc"]).default("desc").describe("排序顺序"),
            }
        },
        async (args) => {
            try {
                const db = getDatabase();
                const conditions: string[] = [];
                const params: any[] = [];

                if (args.status === "unread") conditions.push("e.read = 0");
                else if (args.status === "read") conditions.push("e.read = 1");
                else if (args.status === "starred") conditions.push("e.starred = 1");

                if (args.feedId) {
                    conditions.push("e.feed_id = ?");
                    params.push(args.feedId);
                }
                if (args.groupName) {
                    conditions.push("f.group_name = ?");
                    params.push(args.groupName);
                }

                const now = new Date();
                if (args.dateRange === "today") {
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                    conditions.push("e.published_at >= ?");
                    params.push(today);
                } else if (args.dateRange === "week") {
                    conditions.push("e.published_at >= ?");
                    params.push(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
                } else if (args.dateRange === "month") {
                    conditions.push("e.published_at >= ?");
                    params.push(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
                }
                if (args.dateFrom) {
                    conditions.push("e.published_at >= ?");
                    params.push(args.dateFrom);
                }
                if (args.dateTo) {
                    conditions.push("e.published_at <= ?");
                    params.push(args.dateTo);
                }

                if (args.keyword) {
                    conditions.push("(e.title LIKE ? OR e.summary LIKE ?)");
                    params.push(`%${args.keyword}%`, `%${args.keyword}%`);
                }

                const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
                const orderCol = args.sortBy === "title" ? "e.title" : "e.published_at";
                const orderDir = args.sortOrder.toUpperCase();

                const contentField = args.includeContent ? ", e.content, e.readability_content" : "";
                const sql = `
          SELECT e.id, e.title, e.url, e.author, e.summary, e.published_at, 
                 e.read, e.starred, e.feed_id, f.title as feed_title ${contentField}
          FROM entries e
          LEFT JOIN feeds f ON e.feed_id = f.id
          ${whereClause}
          ORDER BY ${orderCol} ${orderDir}
          LIMIT ? OFFSET ?
        `;
                params.push(args.limit, args.offset);

                const entries = db.prepare(sql).all(...params) as any[];

                const countSql = `SELECT COUNT(*) as total FROM entries e LEFT JOIN feeds f ON e.feed_id = f.id ${whereClause}`;
                const { total } = db.prepare(countSql).get(...params.slice(0, -2)) as { total: number };

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            total,
                            returned: entries.length,
                            hasMore: args.offset + entries.length < total,
                            entries: entries.map(e => ({
                                id: e.id,
                                title: e.title,
                                url: e.url,
                                author: e.author,
                                summary: e.summary?.substring(0, 200),
                                published_at: e.published_at,
                                read: e.read === 1,
                                starred: e.starred === 1,
                                feed_id: e.feed_id,
                                feed_title: e.feed_title,
                                content: args.includeContent
                                    ? (e.readability_content || e.content || "")?.substring(0, args.contentMaxLength)
                                    : undefined
                            }))
                        }, null, 2)
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text", text: `查询失败: ${error}` }], isError: true };
            }
        }
    );

    // ============================================
    // Tool 2: search - 智能搜索
    // ============================================
    server.registerTool(
        "search",
        {
            title: "搜索文章",
            description: "在所有文章中搜索。支持两种模式：keyword（关键词匹配）和 semantic（语义相似性搜索，需要配置 embedding API）。",
            inputSchema: {
                query: z.string().min(1).describe("搜索关键词或问题"),
                type: z.enum(["keyword", "semantic"]).default("keyword")
                    .describe("搜索类型"),
                feedId: z.string().optional().describe("限制在特定订阅源搜索"),
                limit: z.number().int().min(1).max(50).default(10).describe("返回数量"),
            }
        },
        async ({ query, type, feedId, limit }) => {
            try {
                if (type === "semantic") {
                    try {
                        const results = await searchVectors(query, limit);
                        let filtered = feedId ? results.filter(r => r.feed_id === feedId) : results;

                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify({
                                    searchType: "semantic",
                                    resultCount: filtered.length,
                                    results: filtered.map(r => ({
                                        id: r.id,
                                        title: r.title,
                                        url: r.url,
                                        feed_id: r.feed_id,
                                        published_at: r.published_at,
                                        similarity: (1 - r.distance).toFixed(3),
                                        snippet: r.content?.substring(0, 200)
                                    }))
                                }, null, 2)
                            }]
                        };
                    } catch (error: any) {
                        return {
                            content: [{ type: "text", text: `语义搜索失败: ${error.message}。请使用 keyword 搜索。` }],
                            isError: true
                        };
                    }
                }

                const db = getDatabase();
                let sql = `
          SELECT e.id, e.title, e.url, e.feed_id, e.published_at, e.summary, f.title as feed_title
          FROM entries e LEFT JOIN feeds f ON e.feed_id = f.id
          WHERE (e.title LIKE ? OR e.content LIKE ? OR e.summary LIKE ?)
        `;
                const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];

                if (feedId) {
                    sql += " AND e.feed_id = ?";
                    params.push(feedId);
                }
                sql += " ORDER BY e.published_at DESC LIMIT ?";
                params.push(limit);

                const results = db.prepare(sql).all(...params) as any[];

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            searchType: "keyword",
                            resultCount: results.length,
                            results: results.map(r => ({
                                id: r.id,
                                title: r.title,
                                url: r.url,
                                feed_id: r.feed_id,
                                feed_title: r.feed_title,
                                published_at: r.published_at,
                                snippet: r.summary?.substring(0, 200)
                            }))
                        }, null, 2)
                    }]
                };
            } catch (error) {
                return { content: [{ type: "text", text: `搜索失败: ${error}` }], isError: true };
            }
        }
    );

    // ============================================
    // Tool 3: manage_feeds - 订阅管理
    // ============================================
    server.registerTool(
        "manage_feeds",
        {
            title: "管理订阅",
            description: "管理 RSS 订阅源。支持：list（列出所有订阅）、get（获取详情）、add（添加新订阅）、update（更新）、remove（删除）、refresh（刷新获取新文章）。",
            inputSchema: {
                action: z.enum(["list", "get", "add", "update", "remove", "refresh"])
                    .describe("操作类型"),
                groupName: z.string().optional().describe("[list] 按分组名称过滤"),
                includeStats: z.boolean().optional().describe("[list/get] 是否包含未读数等统计"),
                feedId: z.string().optional().describe("[get/update/remove/refresh] 订阅 ID"),
                url: z.string().optional().describe("[add] RSS 订阅 URL"),
                title: z.string().optional().describe("[add/update] 自定义标题"),
                group: z.string().optional().describe("[add/update] 分组名称"),
            }
        },
        async (args) => {
            try {
                const db = getDatabase();

                switch (args.action) {
                    case "list": {
                        let feeds = args.groupName
                            ? feedRepo.findByGroupName(args.groupName)
                            : feedRepo.findAll();

                        if (args.includeStats) {
                            feeds = feeds.map(feed => {
                                const stats = db.prepare(`
                  SELECT COUNT(*) as total, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
                  FROM entries WHERE feed_id = ?
                `).get(feed.id) as any;
                                return { ...feed, stats: { total: stats?.total || 0, unread: stats?.unread || 0 } };
                            });
                        }

                        const groups: Record<string, any[]> = {};
                        for (const feed of feeds) {
                            const g = feed.group_name || "default";
                            if (!groups[g]) groups[g] = [];
                            groups[g].push({ id: feed.id, title: feed.title, url: feed.url, ...(args.includeStats ? { stats: (feed as any).stats } : {}) });
                        }

                        return { content: [{ type: "text", text: JSON.stringify({ totalFeeds: feeds.length, groups }, null, 2) }] };
                    }

                    case "get": {
                        if (!args.feedId) return { content: [{ type: "text", text: "错误: 需要 feedId" }], isError: true };
                        const feed = feedRepo.findById(args.feedId);
                        if (!feed) return { content: [{ type: "text", text: "未找到该订阅" }], isError: true };

                        let result: any = { ...feed };
                        if (args.includeStats) {
                            result.stats = db.prepare(`
                SELECT COUNT(*) as total, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
                FROM entries WHERE feed_id = ?
              `).get(args.feedId);
                        }
                        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                    }

                    case "add": {
                        if (!args.url) return { content: [{ type: "text", text: "错误: 需要 url" }], isError: true };
                        const existing = feedRepo.findByUrl(args.url);
                        if (existing) return { content: [{ type: "text", text: `订阅已存在: ${existing.title}` }], isError: true };

                        const feed = feedRepo.create({ url: args.url, title: args.title || null, group_name: args.group || "default" });
                        await refreshFeed(feed.id);
                        return { content: [{ type: "text", text: JSON.stringify({ message: "添加成功", feed: feedRepo.findById(feed.id) }, null, 2) }] };
                    }

                    case "update": {
                        if (!args.feedId) return { content: [{ type: "text", text: "错误: 需要 feedId" }], isError: true };
                        const updates: any = {};
                        if (args.title) updates.title = args.title;
                        if (args.group) updates.group_name = args.group;
                        const updated = feedRepo.update(args.feedId, updates);
                        if (!updated) return { content: [{ type: "text", text: "未找到该订阅" }], isError: true };
                        return { content: [{ type: "text", text: JSON.stringify({ message: "更新成功", feed: updated }, null, 2) }] };
                    }

                    case "remove": {
                        if (!args.feedId) return { content: [{ type: "text", text: "错误: 需要 feedId" }], isError: true };
                        const feed = feedRepo.findById(args.feedId);
                        if (!feed) return { content: [{ type: "text", text: "未找到该订阅" }], isError: true };
                        db.prepare("DELETE FROM entries WHERE feed_id = ?").run(args.feedId);
                        feedRepo.delete(args.feedId);
                        return { content: [{ type: "text", text: `已删除订阅: ${feed.title || feed.url}` }] };
                    }

                    case "refresh": {
                        if (args.feedId) {
                            const result = await refreshFeed(args.feedId);
                            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                        } else {
                            await refreshAllFeeds();
                            return { content: [{ type: "text", text: "已刷新所有订阅" }] };
                        }
                    }

                    default:
                        return { content: [{ type: "text", text: "未知操作" }], isError: true };
                }
            } catch (error) {
                return { content: [{ type: "text", text: `操作失败: ${error}` }], isError: true };
            }
        }
    );

    // ============================================
    // Tool 4: batch_update - 批量操作
    // ============================================
    server.registerTool(
        "batch_update",
        {
            title: "批量更新文章",
            description: "批量操作文章状态：mark_read（标记已读）、mark_unread（标记未读）、star（收藏）、unstar（取消收藏）。可以指定文章 ID 列表，或按条件过滤。",
            inputSchema: {
                action: z.enum(["mark_read", "mark_unread", "star", "unstar"])
                    .describe("操作类型"),
                entryIds: z.array(z.string()).optional().describe("指定文章 ID 列表"),
                feedId: z.string().optional().describe("按订阅源过滤"),
                status: z.enum(["unread", "read", "starred"]).optional().describe("按当前状态过滤"),
                beforeDate: z.string().optional().describe("操作此日期之前的文章 (ISO格式)"),
            }
        },
        async (args) => {
            try {
                const db = getDatabase();
                let affectedCount = 0;

                if (args.entryIds && args.entryIds.length > 0) {
                    const placeholders = args.entryIds.map(() => "?").join(",");
                    const actions: Record<string, string> = {
                        mark_read: `UPDATE entries SET read = 1 WHERE id IN (${placeholders})`,
                        mark_unread: `UPDATE entries SET read = 0 WHERE id IN (${placeholders})`,
                        star: `UPDATE entries SET starred = 1 WHERE id IN (${placeholders})`,
                        unstar: `UPDATE entries SET starred = 0 WHERE id IN (${placeholders})`
                    };
                    affectedCount = db.prepare(actions[args.action]).run(...args.entryIds).changes;
                } else {
                    const conditions: string[] = [];
                    const params: any[] = [];

                    if (args.feedId) { conditions.push("feed_id = ?"); params.push(args.feedId); }
                    if (args.status === "unread") conditions.push("read = 0");
                    else if (args.status === "read") conditions.push("read = 1");
                    else if (args.status === "starred") conditions.push("starred = 1");
                    if (args.beforeDate) { conditions.push("published_at < ?"); params.push(args.beforeDate); }

                    if (conditions.length === 0) {
                        return { content: [{ type: "text", text: "错误: 需要指定 entryIds 或过滤条件" }], isError: true };
                    }

                    const where = conditions.join(" AND ");
                    const actions: Record<string, string> = {
                        mark_read: `UPDATE entries SET read = 1 WHERE ${where}`,
                        mark_unread: `UPDATE entries SET read = 0 WHERE ${where}`,
                        star: `UPDATE entries SET starred = 1 WHERE ${where}`,
                        unstar: `UPDATE entries SET starred = 0 WHERE ${where}`
                    };
                    affectedCount = db.prepare(actions[args.action]).run(...params).changes;
                }

                const names: Record<string, string> = {
                    mark_read: "标记为已读", mark_unread: "标记为未读",
                    star: "添加收藏", unstar: "取消收藏"
                };
                return { content: [{ type: "text", text: `成功${names[args.action]} ${affectedCount} 篇文章` }] };
            } catch (error) {
                return { content: [{ type: "text", text: `操作失败: ${error}` }], isError: true };
            }
        }
    );

    // ============================================
    // Tool 5: get_overview - 获取概览
    // ============================================
    server.registerTool(
        "get_overview",
        {
            title: "获取概览统计",
            description: "获取 RSS 阅读器的统计概览。支持：global（全局统计，包含订阅数、文章数、未读数）、feed（单个订阅统计）、group（分组统计）。",
            inputSchema: {
                type: z.enum(["global", "feed", "group"]).default("global")
                    .describe("概览类型"),
                id: z.string().optional().describe("[feed] 订阅 ID，[group] 分组名称"),
            }
        },
        async ({ type, id }) => {
            try {
                const db = getDatabase();

                if (type === "global") {
                    const stats = db.prepare(`
            SELECT 
              (SELECT COUNT(*) FROM feeds) as totalFeeds,
              (SELECT COUNT(*) FROM entries) as totalEntries,
              (SELECT COUNT(*) FROM entries WHERE read = 0) as unreadEntries,
              (SELECT COUNT(*) FROM entries WHERE starred = 1) as starredEntries
          `).get() as any;

                    const groups = db.prepare(`SELECT group_name, COUNT(*) as feedCount FROM feeds GROUP BY group_name`).all();

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                message: `共 ${stats.totalFeeds} 个订阅, ${stats.unreadEntries} 篇未读, ${stats.starredEntries} 篇收藏`,
                                stats,
                                groups
                            }, null, 2)
                        }]
                    };
                }

                if (type === "feed") {
                    if (!id) return { content: [{ type: "text", text: "错误: 需要 id (feedId)" }], isError: true };
                    const feed = feedRepo.findById(id);
                    if (!feed) return { content: [{ type: "text", text: "未找到该订阅" }], isError: true };

                    const stats = db.prepare(`
            SELECT COUNT(*) as total, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread,
                   MAX(published_at) as latestEntry
            FROM entries WHERE feed_id = ?
          `).get(id);

                    return { content: [{ type: "text", text: JSON.stringify({ feed: { id: feed.id, title: feed.title, url: feed.url }, stats }, null, 2) }] };
                }

                if (type === "group") {
                    if (!id) return { content: [{ type: "text", text: "错误: 需要 id (groupName)" }], isError: true };
                    const feeds = feedRepo.findByGroupName(id);
                    if (feeds.length === 0) return { content: [{ type: "text", text: `分组 "${id}" 没有订阅` }] };

                    const feedIds = feeds.map(f => f.id);
                    const stats = db.prepare(`
            SELECT COUNT(*) as total, SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
            FROM entries WHERE feed_id IN (${feedIds.map(() => "?").join(",")})
          `).get(...feedIds);

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                groupName: id,
                                feedCount: feeds.length,
                                feeds: feeds.map(f => ({ id: f.id, title: f.title })),
                                stats
                            }, null, 2)
                        }]
                    };
                }

                return { content: [{ type: "text", text: "未知类型" }], isError: true };
            } catch (error) {
                return { content: [{ type: "text", text: `获取失败: ${error}` }], isError: true };
            }
        }
    );
}
