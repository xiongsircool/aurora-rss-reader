/**
 * Tags API Routes
 * Handles tag management, entry-tag associations, and AI analysis
 */

import { FastifyPluginAsync } from 'fastify';
import { createHash } from 'crypto';
import {
    TagRepository,
    EntryTagRepository,
    AnalysisStatusRepository,
    EntryRepository,
} from '../db/repositories/index.js';
import {
    analyzeEntryTags,
    getTaggingConfig,
    updateTaggingConfig,
    incrementTagsVersion,
    initTaggingClient,
} from '../services/tagging.js';
import { runRuleMatchingForEntry } from '../services/ruleMatching.js';
import { TagMatchRule } from '../db/models.js';
import { getDatabase } from '../db/session.js';
import { AIClient } from '../services/ai.js';
import { userSettingsService } from '../services/userSettings.js';
import { getConfig } from '../config/index.js';

type DigestEntryRow = {
    id: string;
    title: string | null;
    url: string | null;
    published_at: string | null;
    inserted_at: string;
    summary: string | null;
    feed_title: string | null;
};

type DigestSummaryRecord = {
    id: string;
    tag_id: string;
    period: string;
    time_range_key: string;
    language: string;
    source_count: number;
    source_hash: string;
    summary: string;
    keywords_json: string | null;
    model_name: string;
    trigger_type: string;
    created_at: string;
};

const DIGEST_AUTO_REGEN_NEW_ENTRIES_THRESHOLD = 3;
const DIGEST_AUTO_REGEN_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function normalizeDigestLanguage(language?: string | null): 'zh' | 'en' | 'ja' | 'ko' {
    const value = (language || '').toLowerCase();
    if (value.startsWith('en')) return 'en';
    if (value.startsWith('ja')) return 'ja';
    if (value.startsWith('ko')) return 'ko';
    return 'zh';
}

function getLanguageDisplayName(language: 'zh' | 'en' | 'ja' | 'ko') {
    switch (language) {
        case 'en': return 'English';
        case 'ja': return '日本語';
        case 'ko': return '한국어';
        default: return '简体中文';
    }
}

function resolveSummaryClient() {
    const settings = userSettingsService.getSettings();
    const config = getConfig();

    const useCustom = settings.summary_use_custom === 1;
    const baseUrl = (useCustom ? settings.summary_base_url : settings.default_ai_base_url) || config.glmBaseUrl || '';
    const apiKey = (useCustom ? settings.summary_api_key : settings.default_ai_api_key) || config.glmApiKey || '';
    const modelName = (useCustom ? settings.summary_model_name : settings.default_ai_model) || config.glmModel || '';
    return {
        client: new AIClient({ baseUrl, apiKey, model: modelName }),
        modelName,
    };
}

function buildDigestTimeWindow(period?: string) {
    const now = new Date();
    if (period === 'week') {
        const weekStart = new Date(now);
        const day = weekStart.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday as first day
        weekStart.setDate(weekStart.getDate() + diff);
        weekStart.setHours(0, 0, 0, 0);

        // ISO week key
        const isoDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const isoDay = isoDate.getUTCDay() || 7;
        isoDate.setUTCDate(isoDate.getUTCDate() + 4 - isoDay);
        const isoYear = isoDate.getUTCFullYear();
        const yearStart = new Date(Date.UTC(isoYear, 0, 1));
        const weekNo = Math.ceil((((isoDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const weekKey = `${isoYear}-W${String(weekNo).padStart(2, '0')}`;

        return { startDate: weekStart.toISOString(), periodKey: weekKey, normalizedPeriod: 'week' as const };
    }
    // latest mode: no hard time filter, always use newest entries for each tag
    return { startDate: null, periodKey: 'latest', normalizedPeriod: 'latest' as const };
}

function buildSourceHash(entries: DigestEntryRow[]) {
    const titlePayload = entries.map((e) => (e.title || '').trim()).join('\n');
    return createHash('sha256').update(titlePayload).digest('hex');
}

function parseKeywordsJson(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
    } catch {
        return [];
    }
}

function parseDigestSummaryPayload(raw: string): { summary?: string; keywords?: string[] } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const tryParse = (candidate: string) => {
        try {
            return JSON.parse(candidate) as { summary?: string; keywords?: string[] };
        } catch {
            return null;
        }
    };

    const direct = tryParse(trimmed);
    if (direct) return direct;

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
        const fencedParsed = tryParse(fencedMatch[1].trim());
        if (fencedParsed) return fencedParsed;
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
        const objectChunk = trimmed.slice(start, end + 1);
        const chunkParsed = tryParse(objectChunk);
        if (chunkParsed) return chunkParsed;
    }

    return null;
}

async function generateDigestSummary(input: {
    tagName: string;
    period: 'latest' | 'week';
    timeRangeKey: string;
    entries: DigestEntryRow[];
    language: string;
}): Promise<{ summary: string; keywords: string[] }> {
    const { client } = resolveSummaryClient();
    const titleLines = input.entries
        .map((e, idx) => {
            const feed = e.feed_title || 'Unknown Source';
            const publishedAt = e.published_at || e.inserted_at || '';
            const snippet = (e.summary || '').replace(/\s+/g, ' ').trim().slice(0, 180);
            return `${idx + 1}. 标题: ${e.title || 'Untitled'}\n来源: ${feed}\n时间: ${publishedAt}\n线索: ${snippet || '无'}\n`;
        })
        .join('\n');
    const periodText = input.period === 'week' ? '本周' : '最新';
    const languageDisplay = getLanguageDisplayName(normalizeDigestLanguage(input.language));
    const systemPrompt = `你是信息分析助手。基于给定标题生成“标签简报摘要”，只能依据输入，不得编造。
输出必须是 JSON 对象，格式：
{"summary":"320-700字","keywords":["关键词1","关键词2"]}`;
    const userPrompt = `标签：${input.tagName}
时间范围：${periodText}
时间标识：${input.timeRangeKey}
信息源（最多20条）：
${titleLines}

要求：
1) summary 必须使用 ${languageDisplay} 输出，不能混用其他语言。
2) summary 只写“新知识/新结果/新结论”，优先保留可验证事实：研究对象、方法、数据范围、结果方向、边界条件。
3) 表达必须去评价化，禁止使用以下低信息短语：具有重要意义、值得关注、进展活跃、有望、突破性、显著提升（若无量化证据）。
4) summary 按单段组织：时间范围一句 + 3-6个高信息点 + 结论句；每个信息点尽量包含“谁/做了什么/得到什么”。
5) 结论句为必填，必须使用“结论：...”开头，明确给出本时间窗内最可靠的新结果与限制条件。
6) 若输入中没有明确结果或结论，不要补写推断，只说明“标题未提供明确结果”。
7) keywords 4-8个，短词，尽量覆盖核心主题与方法名。
8) 输出必须是严格 JSON，不要 Markdown，不要代码块。`;

    const raw = await client.chat(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        { maxTokens: 2000, temperature: 0.2 },
    );

    const parsed = parseDigestSummaryPayload(raw);
    if (parsed) {
        return {
            summary: (parsed.summary || '').trim(),
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean).slice(0, 8) : [],
        };
    }

    return { summary: raw.trim(), keywords: [] };
}

const tagsRoutes: FastifyPluginAsync = async (app) => {
    const tagRepo = new TagRepository();
    const entryTagRepo = new EntryTagRepository();
    const analysisRepo = new AnalysisStatusRepository();
    const entryRepo = new EntryRepository();
    initTaggingClient();

    // ==================== Tag CRUD ====================

    /**
     * GET /tags - Get all tags with entry counts
     */
    app.get('/tags', async () => {
        const tags = tagRepo.getAllWithEntryCounts();
        return { items: tags };
    });

    /**
     * POST /tags - Create a new tag
     */
    app.post<{
        Body: {
            name: string;
            description?: string;
            color?: string;
            match_mode?: 'ai' | 'rule' | 'both';
            match_rules?: TagMatchRule[];
        };
    }>('/tags', async (request, reply) => {
        const { name, description, color, match_mode, match_rules } = request.body;

        if (!name || !name.trim()) {
            return reply.status(400).send({ error: '标签名称不能为空' });
        }

        // Check for duplicate name
        const existing = tagRepo.findByName(name.trim());
        if (existing) {
            return reply.status(409).send({ error: '同名标签已存在' });
        }

        const tag = tagRepo.create({
            name: name.trim(),
            description: description?.trim() || null,
            color: color || '#3b82f6',
            match_mode: match_mode || 'ai',
            match_rules: match_rules ? JSON.stringify(match_rules) : null,
        });

        // Increment version for new tag
        incrementTagsVersion();

        return { item: tag };
    });

    /**
     * PATCH /tags/:id - Update a tag
     */
    app.patch<{
        Params: { id: string };
        Body: {
            name?: string;
            description?: string;
            color?: string;
            enabled?: boolean;
            match_mode?: 'ai' | 'rule' | 'both';
            match_rules?: TagMatchRule[];
        };
    }>('/tags/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, description, color, enabled, match_mode, match_rules } = request.body;

        const existing = tagRepo.findById(id);
        if (!existing) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        // Check for duplicate name if changing name
        if (name && name.trim() !== existing.name) {
            const duplicate = tagRepo.findByName(name.trim());
            if (duplicate) {
                return reply.status(409).send({ error: '同名标签已存在' });
            }
        }

        const nextName = name?.trim();
        const nextDescription = description !== undefined ? description?.trim() || null : undefined;
        const updated = tagRepo.update(id, {
            name: nextName,
            description: nextDescription,
            color,
            enabled,
            match_mode,
            match_rules: match_rules !== undefined ? JSON.stringify(match_rules) : undefined,
        });

        const enabledChanged =
            enabled !== undefined && (enabled ? 1 : 0) !== existing.enabled;
        const shouldBumpVersion =
            (nextName !== undefined && nextName !== existing.name) ||
            (nextDescription !== undefined && nextDescription !== existing.description) ||
            enabledChanged ||
            (match_mode !== undefined && match_mode !== existing.match_mode) ||
            (match_rules !== undefined);

        if (shouldBumpVersion) {
            incrementTagsVersion();
        }

        return { item: updated };
    });

    /**
     * DELETE /tags/:id - Delete a tag
     */
    app.delete<{
        Params: { id: string };
    }>('/tags/:id', async (request, reply) => {
        const { id } = request.params;

        const existing = tagRepo.findById(id);
        if (!existing) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const deleted = tagRepo.delete(id);
        if (deleted) {
            incrementTagsVersion();
        }
        return { success: deleted };
    });

    // ==================== Entry Tags ====================

    /**
     * GET /entries/:id/tags - Get tags for an entry
     */
    app.get<{
        Params: { id: string };
    }>('/entries/:id/tags', async (request) => {
        const { id } = request.params;
        const tags = entryTagRepo.getTagsForEntry(id);
        return { items: tags };
    });

    /**
     * POST /entries/:id/tags/:tagId - Add tag to entry (manual)
     */
    app.post<{
        Params: { id: string; tagId: string };
    }>('/entries/:id/tags/:tagId', async (request, reply) => {
        const { id, tagId } = request.params;

        // Verify entry exists
        const entry = entryRepo.findById(id);
        if (!entry) {
            return reply.status(404).send({ error: '文章不存在' });
        }

        // Verify tag exists
        const tag = tagRepo.findById(tagId);
        if (!tag) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const entryTag = entryTagRepo.addTag(id, tagId, true); // is_manual = true
        const config = getTaggingConfig();
        analysisRepo.updateStatus(id, 'analyzed', config.tagsVersion);
        return { item: entryTag };
    });

    /**
     * DELETE /entries/:id/tags/:tagId - Remove tag from entry
     */
    app.delete<{
        Params: { id: string; tagId: string };
    }>('/entries/:id/tags/:tagId', async (request) => {
        const { id, tagId } = request.params;
        const removed = entryTagRepo.removeTag(id, tagId);
        return { success: removed };
    });

    /**
     * GET /tags/:id/entries - Get entries by tag
     */
    app.get<{
        Params: { id: string };
        Querystring: { limit?: string; cursor?: string; date_range?: string; time_field?: string };
    }>('/tags/:id/entries', async (request, reply) => {
        const { id } = request.params;
        const { limit, cursor, date_range, time_field } = request.query;

        const tag = tagRepo.findById(id);
        if (!tag) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const result = entryTagRepo.getEntriesByTagId(id, {
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
            date_range,
            time_field,
        });

        return result;
    });

    // ==================== AI Analysis ====================

    /**
     * GET /ai/tags/stats - Get analysis statistics
     */
    app.get('/ai/tags/stats', async () => {
        const config = getTaggingConfig();
        const stats = analysisRepo.getStats({
            startAt: config.autoTaggingStartAt || undefined,
        });
        return stats;
    });

    /**
     * GET /ai/tags/pending - Get pending entries
     */
    app.get<{
        Querystring: { limit?: string; cursor?: string; date_range?: string; time_field?: string };
    }>('/ai/tags/pending', async (request) => {
        const { limit, cursor, date_range, time_field } = request.query;
        const config = getTaggingConfig();
        const result = analysisRepo.getPendingEntries({
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
            startAt: config.autoTaggingStartAt || undefined,
            date_range,
            time_field,
        });
        return result;
    });

    /**
     * GET /ai/tags/untagged - Get analyzed entries without tags
     */
    app.get<{
        Querystring: { limit?: string; cursor?: string; date_range?: string; time_field?: string };
    }>('/ai/tags/untagged', async (request) => {
        const { limit, cursor, date_range, time_field } = request.query;
        const config = getTaggingConfig();
        const result = analysisRepo.getEntriesWithoutTags({
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
            startAt: config.autoTaggingStartAt || undefined,
            date_range,
            time_field,
        });
        return result;
    });

    /**
     * POST /ai/tags/analyze - Analyze entries (SSE streaming)
     * Returns Server-Sent Events for real-time progress updates
     */
    app.post<{
        Body: { entryIds: string[] };
    }>('/ai/tags/analyze', async (request, reply) => {
        const { entryIds } = request.body;

        if (!entryIds || entryIds.length === 0) {
            return reply.status(400).send({ error: '请提供要分析的文章ID' });
        }

        // Get enabled tags
        const allTags = tagRepo.findAllEnabled();
        if (allTags.length === 0) {
            return reply.status(400).send({ error: '请先创建至少一个标签' });
        }

        // Separate tags by matching mode
        const ruleTags = allTags.filter(
            (t) => (t.match_mode === 'rule' || t.match_mode === 'both') && t.match_rules
        );
        const aiTags = allTags.filter(
            (t) => t.match_mode === 'ai' || t.match_mode === 'both'
        );

        // Get current tags version and validate config
        const config = getTaggingConfig();
        const aiAvailable = aiTags.length > 0 && config.apiKey && config.baseUrl && config.modelName;

        // If no rule tags and AI not available, return error
        if (ruleTags.length === 0 && !aiAvailable) {
            return reply.status(400).send({ error: 'AI 配置不完整且无规则标签' });
        }

        const tagsVersion = config.tagsVersion;

        // Set up SSE response (take over raw response so Fastify does not send again)
        reply.sent = true;
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        const sendEvent = (event: string, data: unknown) => {
            reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Send initial progress
        sendEvent('start', { total: entryIds.length });

        let successCount = 0;
        let taggedCount = 0;

        for (let i = 0; i < entryIds.length; i++) {
            const entryId = entryIds[i];
            const entry = entryRepo.findById(entryId);

            if (!entry) {
                sendEvent('progress', {
                    current: i + 1,
                    total: entryIds.length,
                    entryId,
                    success: false,
                    tagIds: [],
                    tagNames: [],
                    error: '文章不存在',
                });
                continue;
            }

            const matchedTagIds = new Set<string>();

            // Step 1: Rule matching (instant)
            if (ruleTags.length > 0) {
                const ruleMatched = runRuleMatchingForEntry(
                    { title: entry.title || '', summary: entry.summary },
                    ruleTags
                );
                for (const id of ruleMatched) matchedTagIds.add(id);
            }

            // Step 2: AI matching
            let aiError: string | undefined;
            if (aiAvailable) {
                const analysisResult = await analyzeEntryTags(
                    {
                        title: entry.title || '',
                        summary: entry.summary,
                        content: entry.content,
                    },
                    aiTags
                );

                if (analysisResult.success) {
                    for (const id of analysisResult.tagIds) matchedTagIds.add(id);
                } else {
                    aiError = analysisResult.error;
                }
            }

            // Save merged results
            const allMatchedIds = Array.from(matchedTagIds);
            entryTagRepo.removeAllTags(entryId);
            if (allMatchedIds.length > 0) {
                entryTagRepo.addTags(entryId, allMatchedIds, false);
            }
            analysisRepo.updateStatus(entryId, 'analyzed', tagsVersion);

            const tagNames = allMatchedIds
                .map((tagId) => allTags.find((t) => t.id === tagId)?.name)
                .filter((name): name is string => !!name);

            successCount++;
            if (allMatchedIds.length > 0) taggedCount++;

            // Send progress event for each entry
            sendEvent('progress', {
                current: i + 1,
                total: entryIds.length,
                entryId,
                entryTitle: entry.title,
                success: true,
                tagIds: allMatchedIds,
                tagNames,
                error: aiError,
            });
        }

        // Send completion event
        sendEvent('complete', {
            summary: {
                total: entryIds.length,
                success: successCount,
                tagged: taggedCount,
                untagged: successCount - taggedCount,
            },
        });

        reply.raw.end();
    });

    /**
     * POST /ai/tags/rerun-range - Analyze entries by inserted_at range (manual)
     * Does NOT affect auto-tagging window; intended for "old entries" backfill.
     */
    app.post<{
        Body: {
            from: string;
            to: string;
            cursor?: string;
            limit?: number;
            feedIds?: string[];
            mode?: 'missing' | 'all';
        };
    }>('/ai/tags/rerun-range', async (request, reply) => {
        const { from, to, cursor, limit, feedIds, mode } = request.body;

        if (!from || !to) {
            return reply.status(400).send({ error: '请提供 from/to (ISO 时间字符串)' });
        }
        if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
            return reply.status(400).send({ error: 'from/to 不是合法的 ISO 时间字符串' });
        }
        const fromIso = new Date(from).toISOString();
        const toIso = new Date(to).toISOString();
        if (new Date(fromIso).getTime() > new Date(toIso).getTime()) {
            return reply.status(400).send({ error: 'from 必须小于等于 to' });
        }

        const db = getDatabase();
        const parsedLimit =
            typeof limit === 'number' ? limit : Number.parseInt(String(limit ?? ''), 10);
        const safeLimit = Math.max(1, Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 50, 200));
        const nextMode: 'missing' | 'all' = mode === 'all' ? 'all' : 'missing';

        // Get enabled tags
        const tags = tagRepo.findAllEnabled();
        if (tags.length === 0) {
            return reply.status(400).send({ error: '请先创建至少一个启用的标签' });
        }

        const config = getTaggingConfig();
        if (!config.apiKey || !config.baseUrl || !config.modelName) {
            return reply.status(400).send({ error: 'AI 配置不完整' });
        }

        initTaggingClient();

        const normalizedFeedIds =
            Array.isArray(feedIds) ? Array.from(new Set(feedIds.filter((id) => typeof id === 'string' && id.trim()))) : [];

        const params: Array<string | number> = [fromIso, toIso];
        const placeholders = normalizedFeedIds.map(() => '?').join(',');

        let sql = `
          SELECT
            e.id,
            e.title,
            e.summary,
            COALESCE(e.readability_content, e.content) as content,
            e.inserted_at
          FROM entries e
          INNER JOIN feeds f ON f.id = e.feed_id
          LEFT JOIN entry_analysis_status eas ON e.id = eas.entry_id
          WHERE f.ai_tagging_enabled = 1
            AND e.inserted_at >= ?
            AND e.inserted_at <= ?
        `;

        if (nextMode === 'missing') {
            sql += ` AND (eas.entry_id IS NULL OR eas.status = 'pending')`;
        }

        if (normalizedFeedIds.length > 0) {
            sql += ` AND e.feed_id IN (${placeholders})`;
            params.push(...normalizedFeedIds);
        }

        if (cursor) {
            sql += ` AND e.inserted_at < ?`;
            params.push(cursor);
        }

        sql += ` ORDER BY e.inserted_at DESC LIMIT ?`;
        params.push(safeLimit + 1);

        const rows = db.prepare(sql).all(...params) as Array<{
            id: string;
            title: string | null;
            summary: string | null;
            content: string | null;
            inserted_at: string;
        }>;

        const hasMore = rows.length > safeLimit;
        const items = hasMore ? rows.slice(0, safeLimit) : rows;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].inserted_at : null;

        const results: Array<{
            entryId: string;
            success: boolean;
            tagIds: string[];
            tagNames: string[];
            error?: string;
        }> = [];

        for (const entry of items) {
            const analysisResult = await analyzeEntryTags(
                {
                    title: entry.title || '',
                    summary: entry.summary,
                    content: entry.content,
                },
                tags
            );

            if (analysisResult.success) {
                entryTagRepo.removeAllTags(entry.id);
                if (analysisResult.tagIds.length > 0) {
                    entryTagRepo.addTags(entry.id, analysisResult.tagIds, false);
                }
                analysisRepo.updateStatus(entry.id, 'analyzed', config.tagsVersion);
            } else {
                analysisRepo.updateStatus(entry.id, 'pending', config.tagsVersion);
            }

            const tagNames = analysisResult.tagIds
                .map((tagId) => tags.find((t) => t.id === tagId)?.name)
                .filter((name): name is string => !!name);

            results.push({
                entryId: entry.id,
                success: analysisResult.success,
                tagIds: analysisResult.tagIds,
                tagNames,
                error: analysisResult.error,
            });
        }

        const successCount = results.filter((r) => r.success).length;
        const taggedCount = results.filter((r) => r.success && r.tagIds.length > 0).length;

        return {
            results,
            summary: {
                total: results.length,
                success: successCount,
                tagged: taggedCount,
                untagged: successCount - taggedCount,
            },
            nextCursor,
            hasMore,
        };
    });

    /**
     * POST /entries/:id/tags/reanalyze - Re-analyze a single entry
     */
    app.post<{
        Params: { id: string };
    }>('/entries/:id/tags/reanalyze', async (request, reply) => {
        const { id } = request.params;

        const entry = entryRepo.findById(id);
        if (!entry) {
            return reply.status(404).send({ error: '文章不存在' });
        }

        const tags = tagRepo.findAllEnabled();
        if (tags.length === 0) {
            return reply.status(400).send({ error: '请先创建至少一个标签' });
        }

        const config = getTaggingConfig();
        if (!config.apiKey || !config.baseUrl || !config.modelName) {
            return reply.status(400).send({ error: 'AI 配置不完整' });
        }
        const result = await analyzeEntryTags(
            {
                title: entry.title || '',
                summary: entry.summary,
                content: entry.content,
            },
            tags
        );

	        if (result.success) {
	            entryTagRepo.removeAllTags(id);

	            if (result.tagIds.length > 0) {
	                entryTagRepo.addTags(id, result.tagIds, false);
	            }

	            analysisRepo.updateStatus(id, 'analyzed', config.tagsVersion);
	        }

	        const tagNames = result.tagIds
	            .map((tagId) => tags.find((t) => t.id === tagId)?.name)
	            .filter((name): name is string => !!name);

	        return {
	            success: result.success,
	            tagIds: result.tagIds,
	            tagNames,
	            error: result.error,
	        };
	    });

    /**
     * POST /entries/:id/tags/skip - Mark entry as skipped (no need to analyze)
     */
    app.post<{
        Params: { id: string };
    }>('/entries/:id/tags/skip', async (request) => {
        const { id } = request.params;
        analysisRepo.updateStatus(id, 'skipped');
        return { success: true };
    });

    // ==================== Configuration ====================

    /**
     * GET /ai/tags/config - Get tagging configuration
     */
    app.get('/ai/tags/config', async () => {
        const config = getTaggingConfig();
        return {
            apiKey: config.apiKey ? '********' : '', // Mask API key for security
            baseUrl: config.baseUrl,
            modelName: config.modelName,
            autoTagging: config.autoTagging,
            tagsVersion: config.tagsVersion,
            hasApiKey: !!config.apiKey,
        };
    });

    /**
     * PATCH /ai/tags/config - Update tagging configuration
     */
    app.patch<{
        Body: {
            apiKey?: string;
            baseUrl?: string;
            modelName?: string;
            autoTagging?: boolean;
        };
    }>('/ai/tags/config', async (request) => {
        const { apiKey, baseUrl, modelName, autoTagging } = request.body;

        updateTaggingConfig({
            apiKey,
            baseUrl,
            modelName,
            autoTagging,
        });

        const config = getTaggingConfig();
        return {
            apiKey: config.apiKey ? '********' : '',
            baseUrl: config.baseUrl,
            modelName: config.modelName,
            autoTagging: config.autoTagging,
            tagsVersion: config.tagsVersion,
            hasApiKey: !!config.apiKey,
        };
    });

    /**
     * POST /ai/tags/test - Test tagging configuration
     */
    app.post('/ai/tags/test', async (request, reply) => {
        const config = getTaggingConfig();

        if (!config.apiKey || !config.baseUrl || !config.modelName) {
            return reply.status(400).send({ error: 'AI 配置不完整' });
        }

        try {
            // Simple test with a dummy request
            const result = await analyzeEntryTags(
                { title: '测试文章标题', summary: '这是一个测试摘要。' },
                [{ id: 'test', name: '测试标签', description: '测试描述', color: '#3b82f6', sort_order: 0, enabled: 1, match_mode: 'ai', match_rules: null, created_at: '', updated_at: '' }]
            );

            if (result.success) {
                return { success: true, message: 'AI 服务连接成功' };
            } else {
                return reply.status(500).send({ error: result.error || 'AI 服务连接失败' });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return reply.status(500).send({ error: errorMessage });
        }
    });

    // ==================== Information Aggregation ====================

    /**
     * GET /tags/filter - Multi-tag combo filter (intersection / union)
     */
    app.get<{
        Querystring: { ids: string; mode?: string; limit?: string; cursor?: string };
    }>('/tags/filter', async (request, reply) => {
        const { ids, mode, limit, cursor } = request.query;

        if (!ids) {
            return reply.status(400).send({ error: '请提供标签ID列表' });
        }

        const tagIds = ids.split(',').filter(Boolean);
        if (tagIds.length === 0) {
            return reply.status(400).send({ error: '请提供有效的标签ID' });
        }

        const filterMode = mode === 'and' ? 'and' : 'or';
        const safeLimit = Math.max(1, Math.min(parseInt(limit || '50', 10) || 50, 200));
        const db = getDatabase();

        const placeholders = tagIds.map(() => '?').join(',');
        const params: (string | number)[] = [...tagIds];

        let sql: string;

        if (filterMode === 'and') {
            // Intersection: entries that have ALL specified tags
            sql = `
                SELECT e.*, f.title as feed_title
                FROM entries e
                LEFT JOIN feeds f ON e.feed_id = f.id
                WHERE e.id IN (
                    SELECT entry_id FROM entry_tags
                    WHERE tag_id IN (${placeholders})
                    GROUP BY entry_id
                    HAVING COUNT(DISTINCT tag_id) = ?
                )
            `;
            params.push(tagIds.length);
        } else {
            // Union: entries that have ANY of the specified tags
            sql = `
                SELECT DISTINCT e.*, f.title as feed_title
                FROM entries e
                LEFT JOIN feeds f ON e.feed_id = f.id
                INNER JOIN entry_tags et ON e.id = et.entry_id
                WHERE et.tag_id IN (${placeholders})
            `;
        }

        if (cursor) {
            sql += ` AND e.inserted_at < ?`;
            params.push(cursor);
        }

        sql += ` ORDER BY e.inserted_at DESC LIMIT ?`;
        params.push(safeLimit + 1);

        const rows = db.prepare(sql).all(...params) as any[];
        const hasMore = rows.length > safeLimit;
        const items = hasMore ? rows.slice(0, safeLimit) : rows;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].inserted_at : null;

        return { items, nextCursor, hasMore };
    });

    /**
     * GET /tags/:id/timeline - Topic timeline grouped by period
     */
    app.get<{
        Params: { id: string };
        Querystring: { group_by?: string; limit?: string };
    }>('/tags/:id/timeline', async (request, reply) => {
        const { id } = request.params;
        const { group_by, limit } = request.query;

        const tag = tagRepo.findById(id);
        if (!tag) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const groupBy = group_by === 'month' ? 'month' : 'week';
        const safeLimit = Math.max(1, Math.min(parseInt(limit || '20', 10) || 20, 52));
        const db = getDatabase();

        // Group format based on period type
        const dateFormat = groupBy === 'month'
            ? "strftime('%Y-%m', e.published_at)"
            : "strftime('%Y-W%W', e.published_at)";

        const sql = `
            SELECT
                ${dateFormat} as period,
                COUNT(*) as count,
                MIN(e.published_at) as period_start,
                MAX(e.published_at) as period_end
            FROM entries e
            INNER JOIN entry_tags et ON e.id = et.entry_id
            WHERE et.tag_id = ?
                AND e.published_at IS NOT NULL
            GROUP BY period
            ORDER BY period DESC
            LIMIT ?
        `;

        const periods = db.prepare(sql).all(id, safeLimit) as Array<{
            period: string;
            count: number;
            period_start: string;
            period_end: string;
        }>;

        // For each period, fetch up to 5 representative entries
        const result = periods.map((p) => {
            const entriesSql = `
                SELECT e.id, e.title, e.url, e.published_at, e.summary, f.title as feed_title
                FROM entries e
                INNER JOIN entry_tags et ON e.id = et.entry_id
                LEFT JOIN feeds f ON e.feed_id = f.id
                WHERE et.tag_id = ?
                    AND ${dateFormat} = ?
                ORDER BY e.published_at DESC
                LIMIT 5
            `;
            const entries = db.prepare(entriesSql).all(id, p.period) as any[];
            return {
                period: p.period,
                count: p.count,
                period_start: p.period_start,
                period_end: p.period_end,
                entries,
            };
        });

        return { groupBy, items: result };
    });

    /**
     * GET /digest - Daily/weekly digest grouped by tag, with latest LLM summary
     */
    app.get<{
        Querystring: { period?: string; with_summary?: string | boolean; ui_language?: string };
    }>('/digest', async (request) => {
        const { period, with_summary, ui_language } = request.query;
        const db = getDatabase();
        const settings = userSettingsService.getSettings();
        const language = normalizeDigestLanguage(ui_language || settings.language || settings.ai_translation_language || 'zh');
        const { startDate, normalizedPeriod, periodKey } = buildDigestTimeWindow(period);
        const shouldGenerateSummary = with_summary !== '0' && with_summary !== false;

        const allTags = tagRepo.getAllWithEntryCounts();
        const generateAndStoreSummary = async (args: {
            tagId: string;
            tagName: string;
            normalizedPeriod: 'latest' | 'week';
            periodKey: string;
            language: string;
            sourceHash: string;
            entries: DigestEntryRow[];
            triggerType: 'auto' | 'manual';
        }) => {
            const generated = await generateDigestSummary({
                tagName: args.tagName,
                period: args.normalizedPeriod,
                timeRangeKey: args.periodKey,
                entries: args.entries,
                language: args.language,
            });
            if (!generated.summary) return null;

            const { modelName } = resolveSummaryClient();
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO digest_tag_summaries (
                    id, tag_id, period, time_range_key, language, source_count, source_hash,
                    summary, keywords_json, model_name, trigger_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                `${args.tagId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                args.tagId,
                args.normalizedPeriod,
                args.periodKey,
                args.language,
                args.entries.length,
                args.sourceHash,
                generated.summary,
                JSON.stringify(generated.keywords || []),
                modelName || 'unknown',
                args.triggerType,
                now,
            );
            return { summary: generated.summary, keywords: generated.keywords || [], createdAt: now };
        };

        const result: Array<{
            tag: typeof allTags[number];
            recentCount: number;
            entries: DigestEntryRow[];
            llm_summary: string | null;
            keywords: string[];
            summary_updated_at: string | null;
            time_range_key: string;
            unsummarized_count: number;
        }> = [];

        for (const tag of allTags) {
            const entries = startDate
                ? db.prepare(`
                    SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title
                    FROM entries e
                    INNER JOIN entry_tags et ON e.id = et.entry_id
                    LEFT JOIN feeds f ON e.feed_id = f.id
                    WHERE et.tag_id = ?
                      AND e.inserted_at >= ?
                    ORDER BY e.inserted_at DESC
                    LIMIT 20
                `).all(tag.id, startDate) as DigestEntryRow[]
                : db.prepare(`
                    SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title
                    FROM entries e
                    INNER JOIN entry_tags et ON e.id = et.entry_id
                    LEFT JOIN feeds f ON e.feed_id = f.id
                    WHERE et.tag_id = ?
                    ORDER BY e.inserted_at DESC
                    LIMIT 20
                `).all(tag.id) as DigestEntryRow[];

            if (!entries.length) continue;

            const sourceHash = buildSourceHash(entries);
            const latest = db.prepare(`
                SELECT *
                FROM digest_tag_summaries
                WHERE tag_id = ? AND period = ? AND time_range_key = ? AND language = ?
                ORDER BY created_at DESC
                LIMIT 1
            `).get(tag.id, normalizedPeriod, periodKey, language) as DigestSummaryRecord | undefined;

            let summary = latest?.summary ?? null;
            let keywords: string[] = parseKeywordsJson(latest?.keywords_json);
            let summaryUpdatedAt = latest?.created_at ?? null;

            const latestSummaryText = latest?.summary?.trim() || '';
            const looksLikeRawJsonSummary =
                latestSummaryText.startsWith('{') && latestSummaryText.includes('"summary"');
            const summaryAgeMs = latest?.created_at
                ? (Date.now() - new Date(latest.created_at).getTime())
                : Number.POSITIVE_INFINITY;
            const changedSinceLastSummary = !latest || latest.source_hash !== sourceHash;
            const unsummarizedCount = latest
                ? ((startDate
                    ? db.prepare(`
                        SELECT COUNT(*) as count
                        FROM entries e
                        INNER JOIN entry_tags et ON e.id = et.entry_id
                        WHERE et.tag_id = ?
                          AND e.inserted_at >= ?
                          AND e.inserted_at > ?
                    `).get(tag.id, startDate, latest.created_at)
                    : db.prepare(`
                        SELECT COUNT(*) as count
                        FROM entries e
                        INNER JOIN entry_tags et ON e.id = et.entry_id
                        WHERE et.tag_id = ?
                          AND e.inserted_at > ?
                    `).get(tag.id, latest.created_at)
                ) as { count: number }).count
                : entries.length;
            const passAutoRegenPolicy = !latest
                || unsummarizedCount >= DIGEST_AUTO_REGEN_NEW_ENTRIES_THRESHOLD
                || summaryAgeMs >= DIGEST_AUTO_REGEN_COOLDOWN_MS
                || looksLikeRawJsonSummary;
            const needGenerate = shouldGenerateSummary && changedSinceLastSummary && passAutoRegenPolicy;
            if (needGenerate) {
                try {
                    const generated = await generateAndStoreSummary({
                        tagId: tag.id,
                        tagName: tag.name,
                        normalizedPeriod,
                        periodKey,
                        language,
                        sourceHash,
                        entries,
                        triggerType: 'auto',
                    });
                    if (generated) {
                        summary = generated.summary;
                        keywords = generated.keywords;
                        summaryUpdatedAt = generated.createdAt;
                    }
                } catch (error) {
                    console.warn(`[Digest] Summary generation failed for tag ${tag.name}:`, error);
                }
            }

            result.push({
                tag,
                recentCount: entries.length,
                entries: entries.slice(0, 5),
                llm_summary: summary,
                keywords,
                summary_updated_at: summaryUpdatedAt,
                time_range_key: periodKey,
                unsummarized_count: unsummarizedCount,
            });
        }

        result.sort((a, b) => b.recentCount - a.recentCount);
        return {
            period: normalizedPeriod,
            startDate,
            items: result,
        };
    });

    /**
     * POST /digest/:tagId/regenerate - Force regenerate latest digest summary for a tag/period
     */
    app.post<{
        Params: { tagId: string };
        Body: { period?: 'latest' | 'week'; ui_language?: string };
    }>('/digest/:tagId/regenerate', async (request, reply) => {
        const { tagId } = request.params;
        const period = request.body?.period;
        const db = getDatabase();
        const settings = userSettingsService.getSettings();
        const language = normalizeDigestLanguage(request.body?.ui_language || settings.language || settings.ai_translation_language || 'zh');
        const { startDate, normalizedPeriod, periodKey } = buildDigestTimeWindow(period);

        const tag = tagRepo.findById(tagId);
        if (!tag) return reply.status(404).send({ error: '标签不存在' });

        const entries = startDate
            ? db.prepare(`
                SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title
                FROM entries e
                INNER JOIN entry_tags et ON e.id = et.entry_id
                LEFT JOIN feeds f ON e.feed_id = f.id
                WHERE et.tag_id = ?
                  AND e.inserted_at >= ?
                ORDER BY e.inserted_at DESC
                LIMIT 20
            `).all(tagId, startDate) as DigestEntryRow[]
            : db.prepare(`
                SELECT e.id, e.title, e.url, e.published_at, e.inserted_at, e.summary, f.title as feed_title
                FROM entries e
                INNER JOIN entry_tags et ON e.id = et.entry_id
                LEFT JOIN feeds f ON e.feed_id = f.id
                WHERE et.tag_id = ?
                ORDER BY e.inserted_at DESC
                LIMIT 20
            `).all(tagId) as DigestEntryRow[];

        if (!entries.length) {
            return reply.status(400).send({ error: '当前时间范围内暂无可用于生成摘要的文章' });
        }

        const sourceHash = buildSourceHash(entries);
        try {
            const generated = await generateDigestSummary({
                tagName: tag.name,
                period: normalizedPeriod,
                timeRangeKey: periodKey,
                entries,
                language,
            });
            if (!generated.summary) {
                return reply.status(500).send({ error: '摘要生成失败' });
            }
            const { modelName } = resolveSummaryClient();
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO digest_tag_summaries (
                    id, tag_id, period, time_range_key, language, source_count, source_hash,
                    summary, keywords_json, model_name, trigger_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                `${tag.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                tag.id,
                normalizedPeriod,
                periodKey,
                language,
                entries.length,
                sourceHash,
                generated.summary,
                JSON.stringify(generated.keywords || []),
                modelName || 'unknown',
                'manual',
                now,
            );
            return {
                item: {
                    summary: generated.summary,
                    keywords: generated.keywords || [],
                    summary_updated_at: now,
                    time_range_key: periodKey,
                    source_count: entries.length,
                },
            };
        } catch (error) {
            console.warn(`[Digest] Manual regenerate failed for tag ${tag.name}:`, error);
            return reply.status(500).send({ error: '摘要生成失败' });
        }
    });

    /**
     * GET /digest/:tagId/history - Summary history for a tag
     */
    app.get<{
        Params: { tagId: string };
        Querystring: { period?: string; limit?: string; cursor?: string; ui_language?: string };
    }>('/digest/:tagId/history', async (request, reply) => {
        const { tagId } = request.params;
        const { period, limit, cursor, ui_language } = request.query;
        const db = getDatabase();
        const settings = userSettingsService.getSettings();
        const language = normalizeDigestLanguage(ui_language || settings.language || settings.ai_translation_language || 'zh');
        const safeLimit = Math.max(1, Math.min(parseInt(limit || '10', 10) || 10, 50));
        const normalizedPeriod = period === 'week' ? 'week' : 'latest';

        const tag = tagRepo.findById(tagId);
        if (!tag) return reply.status(404).send({ error: '标签不存在' });

        const params: Array<string | number> = [tagId, normalizedPeriod, language];
        let sql = `
            SELECT id, tag_id, period, time_range_key, language, source_count, source_hash, summary, keywords_json, model_name, trigger_type, created_at
            FROM digest_tag_summaries
            WHERE tag_id = ? AND period = ? AND language = ?
        `;
        if (cursor) {
            sql += ' AND created_at < ?';
            params.push(cursor);
        }
        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(safeLimit + 1);

        const rows = db.prepare(sql).all(...params) as DigestSummaryRecord[];
        const hasMore = rows.length > safeLimit;
        const items = hasMore ? rows.slice(0, safeLimit) : rows;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

        return {
            items: items.map((row) => ({
                id: row.id,
                period: row.period,
                time_range_key: row.time_range_key,
                source_count: row.source_count,
                summary: row.summary,
                keywords: parseKeywordsJson(row.keywords_json),
                model_name: row.model_name,
                trigger_type: row.trigger_type,
                created_at: row.created_at,
            })),
            nextCursor,
            hasMore,
        };
    });

    /**
     * GET /tags/:id/related - Get related tags by co-occurrence
     */
    app.get<{
        Params: { id: string };
        Querystring: { limit?: string };
    }>('/tags/:id/related', async (request, reply) => {
        const { id } = request.params;
        const { limit } = request.query;

        const tag = tagRepo.findById(id);
        if (!tag) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const safeLimit = Math.max(1, Math.min(parseInt(limit || '5', 10) || 5, 20));
        const db = getDatabase();

        // Find tags that frequently co-occur on the same entries
        const sql = `
            SELECT
                t.id, t.name, t.color, t.description,
                COUNT(*) as overlap_count
            FROM entry_tags et1
            INNER JOIN entry_tags et2 ON et1.entry_id = et2.entry_id AND et1.tag_id != et2.tag_id
            INNER JOIN user_tags t ON et2.tag_id = t.id
            WHERE et1.tag_id = ?
                AND t.enabled = 1
            GROUP BY t.id
            ORDER BY overlap_count DESC
            LIMIT ?
        `;

        const related = db.prepare(sql).all(id, safeLimit) as Array<{
            id: string;
            name: string;
            color: string;
            description: string | null;
            overlap_count: number;
        }>;

        return { items: related };
    });
};

export default tagsRoutes;
