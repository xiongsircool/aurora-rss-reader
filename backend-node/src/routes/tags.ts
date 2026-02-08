/**
 * Tags API Routes
 * Handles tag management, entry-tag associations, and AI analysis
 */

import { FastifyPluginAsync } from 'fastify';
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
import { getDatabase } from '../db/session.js';

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
        Body: { name: string; description?: string; color?: string };
    }>('/tags', async (request, reply) => {
        const { name, description, color } = request.body;

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
        Body: { name?: string; description?: string; color?: string; enabled?: boolean };
    }>('/tags/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, description, color, enabled } = request.body;

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
        });

        const enabledChanged =
            enabled !== undefined && (enabled ? 1 : 0) !== existing.enabled;
        const shouldBumpVersion =
            (nextName !== undefined && nextName !== existing.name) ||
            (nextDescription !== undefined && nextDescription !== existing.description) ||
            enabledChanged;

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
        Querystring: { limit?: string; cursor?: string };
    }>('/tags/:id/entries', async (request, reply) => {
        const { id } = request.params;
        const { limit, cursor } = request.query;

        const tag = tagRepo.findById(id);
        if (!tag) {
            return reply.status(404).send({ error: '标签不存在' });
        }

        const result = entryTagRepo.getEntriesByTagId(id, {
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
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
        Querystring: { limit?: string; cursor?: string };
    }>('/ai/tags/pending', async (request) => {
        const { limit, cursor } = request.query;
        const config = getTaggingConfig();
        const result = analysisRepo.getPendingEntries({
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
            startAt: config.autoTaggingStartAt || undefined,
        });
        return result;
    });

    /**
     * GET /ai/tags/untagged - Get analyzed entries without tags
     */
    app.get<{
        Querystring: { limit?: string; cursor?: string };
    }>('/ai/tags/untagged', async (request) => {
        const { limit, cursor } = request.query;
        const config = getTaggingConfig();
        const result = analysisRepo.getEntriesWithoutTags({
            limit: limit ? parseInt(limit, 10) : 50,
            cursor,
            startAt: config.autoTaggingStartAt || undefined,
        });
        return result;
    });

    /**
     * POST /ai/tags/analyze - Analyze entries
     */
    app.post<{
        Body: { entryIds: string[] };
    }>('/ai/tags/analyze', async (request, reply) => {
        const { entryIds } = request.body;

        if (!entryIds || entryIds.length === 0) {
            return reply.status(400).send({ error: '请提供要分析的文章ID' });
        }

        // Get enabled tags
        const tags = tagRepo.findAllEnabled();
        if (tags.length === 0) {
            return reply.status(400).send({ error: '请先创建至少一个标签' });
        }

        // Get current tags version and validate config
        const config = getTaggingConfig();
        if (!config.apiKey || !config.baseUrl || !config.modelName) {
            return reply.status(400).send({ error: 'AI 配置不完整' });
        }
        const tagsVersion = config.tagsVersion;

	        const results: Array<{
	            entryId: string;
	            success: boolean;
	            tagIds: string[];
	            tagNames: string[];
	            error?: string;
	        }> = [];

        for (const entryId of entryIds) {
	            const entry = entryRepo.findById(entryId);
	            if (!entry) {
	                results.push({ entryId, success: false, tagIds: [], tagNames: [], error: '文章不存在' });
	                continue;
	            }

            // Analyze entry
            const analysisResult = await analyzeEntryTags(
                {
                    title: entry.title || '',
                    summary: entry.summary,
                    content: entry.content,
                },
                tags
            );

	            if (analysisResult.success) {
	                // Clear existing AI-assigned tags (keep manual ones)
	                // Actually, we'll replace all tags since re-analysis is explicit
	                entryTagRepo.removeAllTags(entryId);

	                // Add matched tags
	                if (analysisResult.tagIds.length > 0) {
	                    entryTagRepo.addTags(entryId, analysisResult.tagIds, false); // is_manual = false
	                }

	                // Update analysis status
	                analysisRepo.updateStatus(entryId, 'analyzed', tagsVersion);
	            }

	            const tagNames = analysisResult.tagIds
	                .map((tagId) => tags.find((t) => t.id === tagId)?.name)
	                .filter((name): name is string => !!name);

	            results.push({
	                entryId,
	                success: analysisResult.success,
	                tagIds: analysisResult.tagIds,
	                tagNames,
	                error: analysisResult.error,
	            });
	        }

	        // Calculate summary
	        const successCount = results.filter((r) => r.success).length;
	        const taggedCount = results.filter((r) => r.success && r.tagIds.length > 0).length;

        return {
            results,
            summary: {
                total: entryIds.length,
                success: successCount,
                tagged: taggedCount,
                untagged: successCount - taggedCount,
            },
        };
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
                [{ id: 'test', name: '测试标签', description: '测试描述', color: '#3b82f6', sort_order: 0, enabled: 1, created_at: '', updated_at: '' }]
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
};

export default tagsRoutes;
