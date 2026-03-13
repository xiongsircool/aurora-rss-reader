/**
 * AI API Routes (Translation and Summarization)
 */

import { FastifyInstance } from 'fastify';
import { AIClient, type ServiceKey } from '../services/ai.js';
import { generateEmbedding } from '../services/vector.js';
import { EntryRepository, TranslationRepository, SummaryRepository } from '../db/repositories/index.js';
import { AIAutomationRuleRepository } from '../db/repositories/aiAutomationRule.js';
import { FeedRepository } from '../db/repositories/feed.js';
import { TagRepository } from '../db/repositories/tag.js';
import { getDatabase } from '../db/session.js';
import { userSettingsService } from '../services/userSettings.js';
import { getConfig } from '../config/index.js';
import { initTaggingClient } from '../services/tagging.js';
import { getObjectBody } from '../utils/http.js';
import { AIAutomationMode, AIScopeType, AITaskKey } from '../db/models.js';
import {
  AUTOMATION_SCOPE_TYPES,
  AUTOMATION_TASK_KEYS,
  aiAutomationResolver,
} from '../services/aiAutomationResolver.js';
import {
  aggregateDigestService,
  buildDigestTimeWindow,
  parseAggregateDigestRecord,
  type DigestSourceItem,
} from '../services/aggregateDigest.js';

function resolveServiceConfig(service: ServiceKey) {
  const settings = userSettingsService.getSettings();
  const config = getConfig();

  const envFallbackApiKey = config.glmApiKey || '';
  const envFallbackBaseUrl = config.glmBaseUrl || '';
  const envFallbackModel = config.glmModel || '';

  // Global default from user settings
  const globalApiKey = settings.default_ai_api_key || envFallbackApiKey;
  const globalBaseUrl = settings.default_ai_base_url || envFallbackBaseUrl;
  const globalModel = settings.default_ai_model || envFallbackModel;

  // Service-specific field mapping
  const serviceFields: Record<ServiceKey, { useCustom: string; apiKey: string; baseUrl: string; model: string }> = {
    summary: {
      useCustom: 'summary_use_custom',
      apiKey: 'summary_api_key',
      baseUrl: 'summary_base_url',
      model: 'summary_model_name',
    },
    translation: {
      useCustom: 'translation_use_custom',
      apiKey: 'translation_api_key',
      baseUrl: 'translation_base_url',
      model: 'translation_model_name',
    },
    tagging: {
      useCustom: 'tagging_use_custom',
      apiKey: 'tagging_api_key',
      baseUrl: 'tagging_base_url',
      model: 'tagging_model_name',
    },
    embedding: {
      useCustom: 'embedding_use_custom',
      apiKey: 'embedding_api_key',
      baseUrl: 'embedding_base_url',
      model: 'embedding_model',
    },
  };

  const fields = serviceFields[service];

  // Embedding always uses its own config (it's not a chat/LLM model)
  const alwaysCustomServices: ServiceKey[] = ['embedding'];
  const useCustom = alwaysCustomServices.includes(service) || (settings as any)[fields.useCustom] === 1;

  if (useCustom) {
    return {
      apiKey: (settings as any)[fields.apiKey] || '',
      baseUrl: (settings as any)[fields.baseUrl] || '',
      modelName: (settings as any)[fields.model] || '',
    };
  }

  return {
    apiKey: globalApiKey,
    baseUrl: globalBaseUrl,
    modelName: globalModel,
  };
}

type ScopeDigestEntryRow = {
  id: string;
  feed_id: string;
  title: string | null;
  url: string | null;
  published_at: string | null;
  inserted_at: string;
  summary: string | null;
  content?: string | null;
  feed_title: string | null;
  group_name: string | null;
};

function queryScopeDigestEntries(input: {
  scope_type: Exclude<AIScopeType, 'global'>;
  scope_id: string;
  startDate: string | null;
  limit?: number;
}) {
  const db = getDatabase();
  const limit = Math.max(1, Math.min(input.limit || 20, 50));

  if (input.scope_type === 'feed') {
    if (input.startDate) {
      return db.prepare(`
        SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
               f.title as feed_title, f.group_name as group_name
        FROM entries e
        LEFT JOIN feeds f ON e.feed_id = f.id
        WHERE e.feed_id = ?
          AND e.inserted_at >= ?
        ORDER BY e.inserted_at DESC
        LIMIT ?
      `).all(input.scope_id, input.startDate, limit) as ScopeDigestEntryRow[];
    }
    return db.prepare(`
      SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
             f.title as feed_title, f.group_name as group_name
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
      WHERE e.feed_id = ?
      ORDER BY e.inserted_at DESC
      LIMIT ?
    `).all(input.scope_id, limit) as ScopeDigestEntryRow[];
  }

  if (input.scope_type === 'group') {
    if (input.startDate) {
      return db.prepare(`
        SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
               f.title as feed_title, f.group_name as group_name
        FROM entries e
        INNER JOIN feeds f ON e.feed_id = f.id
        WHERE COALESCE(f.group_name, '') = ?
          AND e.inserted_at >= ?
        ORDER BY e.inserted_at DESC
        LIMIT ?
      `).all(input.scope_id, input.startDate, limit) as ScopeDigestEntryRow[];
    }
    return db.prepare(`
      SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
             f.title as feed_title, f.group_name as group_name
      FROM entries e
      INNER JOIN feeds f ON e.feed_id = f.id
      WHERE COALESCE(f.group_name, '') = ?
      ORDER BY e.inserted_at DESC
      LIMIT ?
    `).all(input.scope_id, limit) as ScopeDigestEntryRow[];
  }

  if (input.startDate) {
    return db.prepare(`
      SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
             f.title as feed_title, f.group_name as group_name
      FROM entries e
      INNER JOIN entry_tags et ON e.id = et.entry_id
      LEFT JOIN feeds f ON e.feed_id = f.id
      WHERE et.tag_id = ?
        AND e.inserted_at >= ?
      ORDER BY e.inserted_at DESC
      LIMIT ?
    `).all(input.scope_id, input.startDate, limit) as ScopeDigestEntryRow[];
  }

  return db.prepare(`
    SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content,
           f.title as feed_title, f.group_name as group_name
    FROM entries e
    INNER JOIN entry_tags et ON e.id = et.entry_id
    LEFT JOIN feeds f ON e.feed_id = f.id
    WHERE et.tag_id = ?
    ORDER BY e.inserted_at DESC
    LIMIT ?
  `).all(input.scope_id, limit) as ScopeDigestEntryRow[];
}

function toDigestSourceItems(rows: ScopeDigestEntryRow[]): DigestSourceItem[] {
  return rows.map((entry, index) => ({
    ref: index + 1,
    entry_id: entry.id,
    title: entry.title || 'Untitled',
    summary: entry.summary,
    content_snippet: entry.content,
    feed_title: entry.feed_title,
    group_name: entry.group_name,
    published_at: entry.published_at,
  }));
}

function resolveDigestScopeLabel(scope_type: Exclude<AIScopeType, 'global'>, scope_id: string) {
  if (scope_type === 'feed') {
    const feedRepo = new FeedRepository();
    const feed = feedRepo.findById(scope_id);
    if (!feed) return null;
    return feed.custom_title || feed.title || feed.url || scope_id;
  }
  if (scope_type === 'tag') {
    const tagRepo = new TagRepository();
    const tag = tagRepo.findById(scope_id);
    return tag?.name || null;
  }
  return scope_id;
}

function createClient(service: ServiceKey, overrides?: { apiKey?: string; baseUrl?: string; modelName?: string }) {
  const resolved = resolveServiceConfig(service);
  return new AIClient({
    apiKey: overrides?.apiKey ?? resolved.apiKey,
    baseUrl: overrides?.baseUrl ?? resolved.baseUrl,
    model: overrides?.modelName ?? resolved.modelName,
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
  if (!content) {
    return null;
  }

  const metaLines: string[] = [];
  if (entry.title) metaLines.push(`Title: ${entry.title}`);
  if (entry.author) metaLines.push(`Author: ${entry.author}`);
  if (entry.published_at) metaLines.push(`Published: ${entry.published_at}`);

  if (!metaLines.length) {
    return content;
  }

  return `Metadata:\n${metaLines.join('\n')}\n\nContent:\n${content}`;
}

export async function aiRoutes(app: FastifyInstance) {
  const entryRepo = new EntryRepository();
  const translationRepo = new TranslationRepository();
  const summaryRepo = new SummaryRepository();
  const automationRuleRepo = new AIAutomationRuleRepository();

  const isTaskKey = (value: unknown): value is AITaskKey =>
    typeof value === 'string' && AUTOMATION_TASK_KEYS.includes(value as AITaskKey);
  const isScopeType = (value: unknown): value is AIScopeType =>
    typeof value === 'string' && AUTOMATION_SCOPE_TYPES.includes(value as AIScopeType);
  const isAutomationMode = (value: unknown): value is AIAutomationMode =>
    value === 'inherit' || value === 'enabled' || value === 'disabled';

  function getLegacyDefaults() {
    return AUTOMATION_TASK_KEYS.map((taskKey) => ({
      task_key: taskKey,
      scope_type: 'global' as const,
      scope_id: null,
      enabled: aiAutomationResolver.resolve({ taskKey, scopeType: 'global' }),
      source: 'legacy_fallback' as const,
    }));
  }

  app.get('/ai/automation-rules', async () => {
    return {
      items: automationRuleRepo.findAll(),
      defaults: getLegacyDefaults(),
    };
  });

  app.patch('/ai/automation-rules', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const upserts = Array.isArray(body.upserts) ? body.upserts : [];
    const removals = Array.isArray(body.removals) ? body.removals : [];

    for (const item of upserts) {
      const payload = getObjectBody(item);
      if (!payload || !isTaskKey(payload.task_key) || !isScopeType(payload.scope_type) || !isAutomationMode(payload.mode)) {
        return reply.code(400).send({ error: 'Invalid automation rule in upserts' });
      }
      const scopeId = typeof payload.scope_id === 'string' && payload.scope_id.trim()
        ? payload.scope_id.trim()
        : null;
      if (payload.scope_type !== 'global' && !scopeId) {
        return reply.code(400).send({ error: 'scope_id is required for non-global automation rules' });
      }
      automationRuleRepo.upsert({
        task_key: payload.task_key,
        scope_type: payload.scope_type,
        scope_id: scopeId,
        mode: payload.mode,
      });
    }

    for (const item of removals) {
      const payload = getObjectBody(item);
      if (!payload || !isTaskKey(payload.task_key) || !isScopeType(payload.scope_type)) {
        return reply.code(400).send({ error: 'Invalid automation rule in removals' });
      }
      const scopeId = typeof payload.scope_id === 'string' && payload.scope_id.trim()
        ? payload.scope_id.trim()
        : null;
      if (payload.scope_type !== 'global' && !scopeId) {
        return reply.code(400).send({ error: 'scope_id is required for non-global automation removals' });
      }
      automationRuleRepo.deleteByTaskAndScope(payload.task_key, payload.scope_type, scopeId);
    }

    return {
      success: true,
      items: automationRuleRepo.findAll(),
      defaults: getLegacyDefaults(),
    };
  });

  app.get('/ai/digests', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const scope_type = query.scope_type;
    const scope_id = query.scope_id;
    const period = typeof query.period === 'string' && query.period.trim() ? query.period.trim() : 'latest';
    const { startDate, periodKey, normalizedPeriod } = buildDigestTimeWindow(period);
    const time_range_key = typeof query.time_range_key === 'string' && query.time_range_key.trim() ? query.time_range_key.trim() : periodKey;
    const language = typeof query.language === 'string' && query.language.trim() ? query.language.trim() : 'zh';

    if (scope_type !== 'feed' && scope_type !== 'group' && scope_type !== 'tag') {
      return reply.code(400).send({ error: 'scope_type must be feed, group, or tag' });
    }
    if (typeof scope_id !== 'string' || !scope_id.trim()) {
      return reply.code(400).send({ error: 'scope_id is required' });
    }
    const scopeId = scope_id.trim();
    const scopeLabel = resolveDigestScopeLabel(scope_type, scopeId);
    if (!scopeLabel) {
      return reply.code(404).send({ error: 'digest scope not found' });
    }

    const entries = queryScopeDigestEntries({
      scope_type,
      scope_id: scopeId,
      startDate,
      limit: 20,
    });

    const record = aggregateDigestService.getLatest({
      scope_type,
      scope_id: scopeId,
      period: normalizedPeriod,
      time_range_key,
      language,
    });

    return {
      scope_label: scopeLabel,
      period: normalizedPeriod,
      time_range_key,
      recentCount: entries.length,
      entries: entries.slice(0, 5),
      item: record ? {
        ...record,
        citations: parseAggregateDigestRecord(record.citations_json, []),
        keywords: parseAggregateDigestRecord(record.keywords_json, []),
      } : null,
    };
  });

  app.get('/ai/digests/history', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const scope_type = query.scope_type;
    const scope_id = query.scope_id;
    const period = typeof query.period === 'string' && query.period.trim() ? query.period.trim() : 'latest';
    const language = typeof query.language === 'string' && query.language.trim() ? query.language.trim() : 'zh';
    const cursor = typeof query.cursor === 'string' && query.cursor.trim() ? query.cursor.trim() : null;
    const limit = Math.max(1, Math.min(Number(query.limit) || 10, 50));

    if (scope_type !== 'feed' && scope_type !== 'group' && scope_type !== 'tag') {
      return reply.code(400).send({ error: 'scope_type must be feed, group, or tag' });
    }
    if (typeof scope_id !== 'string' || !scope_id.trim()) {
      return reply.code(400).send({ error: 'scope_id is required' });
    }

    const result = aggregateDigestService.getHistory({
      scope_type,
      scope_id: scope_id.trim(),
      period,
      language,
      limit,
      cursor,
    });

    return {
      items: result.items.map((item) => ({
        ...item,
        citations: parseAggregateDigestRecord(item.citations_json, []),
        keywords: parseAggregateDigestRecord(item.keywords_json, []),
      })),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  });

  app.post('/ai/digests/regenerate', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const scope_type = body.scope_type;
    const scope_id = typeof body.scope_id === 'string' ? body.scope_id.trim() : '';
    const period = typeof body.period === 'string' && body.period.trim() ? body.period.trim() : 'latest';
    const uiLanguage = typeof body.ui_language === 'string' && body.ui_language.trim() ? body.ui_language.trim() : 'zh';
    const triggerType = body.trigger_type === 'auto' ? 'auto' : 'manual';

    if (scope_type !== 'feed' && scope_type !== 'group' && scope_type !== 'tag') {
      return reply.code(400).send({ error: 'scope_type must be feed, group, or tag' });
    }
    if (!scope_id) {
      return reply.code(400).send({ error: 'scope_id is required' });
    }

    const scopeLabel = resolveDigestScopeLabel(scope_type, scope_id);
    if (!scopeLabel) {
      return reply.code(404).send({ error: 'digest scope not found' });
    }

    const { startDate, normalizedPeriod, periodKey } = buildDigestTimeWindow(period);
    const entries = queryScopeDigestEntries({
      scope_type,
      scope_id,
      startDate,
      limit: 20,
    });

    if (!entries.length) {
      return reply.code(400).send({ error: '当前时间范围内暂无可用于生成摘要的文章' });
    }

    try {
      const generated = await aggregateDigestService.generate({
        scope_type,
        scope_id,
        scope_label: scopeLabel,
        period: normalizedPeriod,
        time_range_key: periodKey,
        language: uiLanguage,
        items: toDigestSourceItems(entries),
        trigger_type: triggerType,
      });

      return {
        scope_label: scopeLabel,
        period: normalizedPeriod,
        time_range_key: periodKey,
        recentCount: entries.length,
        entries: entries.slice(0, 5),
        item: {
          summary: generated.payload.summary_md,
          citations: generated.payload.citations,
          keywords: generated.payload.keywords || [],
          summary_updated_at: generated.record.created_at,
          time_range_key: periodKey,
          source_count: entries.length,
          model_name: generated.modelName,
          trigger_type: triggerType,
        },
      };
    } catch (error) {
      console.error('Failed to regenerate aggregate digest:', error);
      return reply.code(500).send({ error: '生成聚合摘要失败' });
    }
  });

  // POST /ai/summary - Generate summary (frontend expects entry_id)
  app.post('/ai/summary', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const entry_id = typeof body.entry_id === 'string' ? body.entry_id : undefined;
    const language = typeof body.language === 'string' ? body.language : undefined;
    const force = typeof body.force === 'boolean' ? body.force : false;
    const targetLanguage = language || 'zh';

    if (!entry_id) {
      return reply.code(400).send({ error: 'entry_id is required' });
    }

    const entry = entryRepo.findById(entry_id);
    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    const existing = summaryRepo.findByEntryIdAndLanguage(entry_id, targetLanguage);
    if (!force && existing?.summary) {
      return { entry_id, language: targetLanguage, summary: existing.summary };
    }

    const combinedContent = buildSummaryContent(entry);
    if (!combinedContent) {
      return reply.code(400).send({ error: 'Entry has no content to summarize' });
    }

    try {
      const client = createClient('summary');
      const settings = userSettingsService.getSettings();
      const userPreference = settings.summary_prompt_preference || settings.ai_prompt_preference || '';
      const summary = await client.summarize(combinedContent, { language: targetLanguage, userPreference });
      summaryRepo.upsert({ entry_id, language: targetLanguage, summary });
      return { entry_id, language: targetLanguage, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Summary generation failed';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /ai/translate-title - Translate entry title
  app.post('/ai/translate-title', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const entry_id = typeof body.entry_id === 'string' ? body.entry_id : undefined;
    const language = typeof body.language === 'string' ? body.language : undefined;
    const targetLanguage = language || 'zh';

    if (!entry_id) {
      return reply.code(400).send({ error: 'entry_id is required' });
    }

    const entry = entryRepo.findById(entry_id);
    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    if (!entry.title) {
      return { entry_id, title: '', language: targetLanguage };
    }

    const existing = translationRepo.findByEntryIdAndLanguage(entry_id, targetLanguage);
    if (existing?.title) {
      return { entry_id, title: existing.title, language: targetLanguage, from_cache: true };
    }

    try {
      const client = createClient('translation');
      const settings = userSettingsService.getSettings();
      const userPreference = settings.translation_prompt_preference || settings.ai_prompt_preference || '';
      const title = await client.translate(entry.title, { targetLanguage, userPreference });
      translationRepo.upsert({ entry_id, language: targetLanguage, title });
      return { entry_id, title, language: targetLanguage, from_cache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Title translation failed';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /ai/translate-blocks - SSE translation
  app.post('/ai/translate-blocks', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const entryId = typeof body.entry_id === 'string' ? body.entry_id : undefined;
    const sourceLang = typeof body.source_lang === 'string' ? body.source_lang : 'en';
    const targetLang = typeof body.target_lang === 'string' ? body.target_lang : 'zh';
    const blocks = Array.isArray(body.blocks)
      ? body.blocks.filter(
          (block): block is { id: string; text: string } =>
            typeof block === 'object' &&
            block !== null &&
            typeof (block as { id?: unknown }).id === 'string' &&
            typeof (block as { text?: unknown }).text === 'string'
        )
      : [];

    if (!entryId || blocks.length === 0) {
      return reply.code(400).send({ error: 'entry_id and blocks are required' });
    }

    const entry = entryRepo.findById(entryId);
    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    // Explicitly set CORS headers for SSE
    reply.raw.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');

    reply.raw.flushHeaders();

    const sendEvent = (event: string, data: Record<string, unknown>) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const cacheKey = `${sourceLang}:${targetLang}`;
    const existing = translationRepo.findByEntryIdAndLanguage(entryId, targetLang);
    let existingMap: Record<string, Record<string, string>> = {};

    if (existing?.paragraph_map) {
      try {
        existingMap = JSON.parse(existing.paragraph_map);
      } catch (error) {
        existingMap = {};
      }
    }

    const cachedMap = existingMap[cacheKey] ? { ...existingMap[cacheKey] } : {};
    const hits: Array<{ id: string; text: string }> = [];
    const misses: Array<{ id: string; text: string }> = [];

    for (const block of blocks) {
      if (cachedMap[block.id]) {
        hits.push({ id: block.id, text: cachedMap[block.id] });
      } else {
        misses.push({ id: block.id, text: block.text });
      }
    }

    let successCount = hits.length;
    let failedCount = 0;

    sendEvent('progress', { total: blocks.length, completed: 0, cached: hits.length });
    for (const hit of hits) {
      sendEvent('translation', { id: hit.id, text: hit.text });
    }

    try {
      const client = createClient('translation');
      const settings = userSettingsService.getSettings();
      const userPreference = settings.translation_prompt_preference || settings.ai_prompt_preference || '';

      for (const block of misses) {
        if (request.raw.aborted) {
          break;
        }

        try {
          const translated = await client.translate(block.text, { targetLanguage: targetLang, userPreference });
          cachedMap[block.id] = translated;
          sendEvent('translation', { id: block.id, text: translated });
          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Translation failed';
          sendEvent('error', { id: block.id, error: message });
          failedCount += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation failed';
      for (const block of misses) {
        sendEvent('error', { id: block.id, error: message });
      }
      failedCount += misses.length;
    }

    existingMap[cacheKey] = cachedMap;
    translationRepo.upsert({ entry_id: entryId, language: targetLang, paragraph_map: existingMap });

    sendEvent('done', {
      total: blocks.length,
      success: successCount,
      failed: failedCount,
      cached: hits.length,
    });

    reply.raw.end();
    return reply;
  });

  // POST /ai/translate - Translate text
  app.post('/ai/translate', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const text = typeof body.text === 'string' ? body.text : '';
    const target_language = typeof body.target_language === 'string' ? body.target_language : undefined;
    const entry_id = typeof body.entry_id === 'string' ? body.entry_id : undefined;

    if (!text) {
      return reply.code(400).send({ error: 'Text is required' });
    }

    try {
      if (entry_id) {
        const existing = translationRepo.findByEntryIdAndLanguage(entry_id, target_language || 'zh');
        if (existing?.title) {
          return { translation: existing.title, cached: true };
        }
      }

      const client = createClient('translation');
      const settings = userSettingsService.getSettings();
      const userPreference = settings.translation_prompt_preference || settings.ai_prompt_preference || '';
      const translation = await client.translate(text, { targetLanguage: target_language || 'zh', userPreference });

      if (entry_id) {
        translationRepo.upsert({
          entry_id,
          language: target_language || 'zh',
          title: translation,
        });
      }

      return { translation, cached: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation failed';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /ai/summarize - Generate summary
  app.post('/ai/summarize', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const content = typeof body.content === 'string' ? body.content : '';
    const language = typeof body.language === 'string' ? body.language : undefined;
    const entry_id = typeof body.entry_id === 'string' ? body.entry_id : undefined;

    if (!content) {
      return reply.code(400).send({ error: 'Content is required' });
    }

    try {
      if (entry_id) {
        const existing = summaryRepo.findByEntryIdAndLanguage(entry_id, language || 'zh');
        if (existing?.summary) {
          return { summary: existing.summary, cached: true };
        }
      }

      const client = createClient('summary');
      const settings = userSettingsService.getSettings();
      const userPreference = settings.summary_prompt_preference || settings.ai_prompt_preference || '';
      const summary = await client.summarize(content, { language: language || 'zh', userPreference });

      if (entry_id) {
        summaryRepo.upsert({
          entry_id,
          language: language || 'zh',
          summary,
        });
      }

      return { summary, cached: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Summarization failed';
      return reply.code(500).send({ error: message });
    }
  });

  // GET /ai/config - Get AI configuration
  app.get('/ai/config', async () => {
    const settings = userSettingsService.getSettings();

    return {
      global: {
        provider: settings.default_ai_provider || '',
        api_key: settings.default_ai_api_key || '',
        base_url: settings.default_ai_base_url || '',
        model_name: settings.default_ai_model || '',
        has_api_key: !!settings.default_ai_api_key,
      },
      summary: {
        use_custom: settings.summary_use_custom === 1,
        api_key: settings.summary_api_key || '',
        base_url: settings.summary_base_url || '',
        model_name: settings.summary_model_name || '',
      },
      translation: {
        use_custom: settings.translation_use_custom === 1,
        api_key: settings.translation_api_key || '',
        base_url: settings.translation_base_url || '',
        model_name: settings.translation_model_name || '',
      },
      tagging: {
        use_custom: settings.tagging_use_custom === 1,
        api_key: settings.tagging_api_key || '',
        base_url: settings.tagging_base_url || '',
        model_name: settings.tagging_model_name || '',
      },
      embedding: {
        use_custom: settings.embedding_use_custom === 1,
        api_key: settings.embedding_api_key || '',
        base_url: settings.embedding_base_url || '',
        model_name: settings.embedding_model || '',
      },
      features: {
        auto_summary: !!settings.ai_auto_summary,
        auto_title_translation: !!settings.ai_auto_title_translation,
        auto_tagging: !!settings.ai_auto_tagging,
        title_display_mode: settings.ai_title_display_mode || 'original-first',
        translation_language: settings.ai_translation_language || 'zh',
      },
    };
  });

  // PATCH /ai/config - Update AI configuration
  app.patch('/ai/config', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    const globalConfig = getObjectBody(body.global) || {};
    const summaryConfig = getObjectBody(body.summary) || {};
    const translationConfig = getObjectBody(body.translation) || {};
    const taggingConfig = getObjectBody(body.tagging) || {};
    const embeddingConfig = getObjectBody(body.embedding) || {};
    const features = getObjectBody(body.features) || {};

    const updates: Record<string, any> = {};
    const settings = userSettingsService.getSettings();
    const wasAutoTaggingEnabled = settings.ai_auto_tagging === 1;
    const now = new Date().toISOString();

    // Global default config
    if (globalConfig.provider !== undefined) updates.default_ai_provider = globalConfig.provider;
    if (globalConfig.api_key !== undefined) updates.default_ai_api_key = globalConfig.api_key;
    if (globalConfig.base_url !== undefined) updates.default_ai_base_url = globalConfig.base_url;
    if (globalConfig.model_name !== undefined) updates.default_ai_model = globalConfig.model_name;

    // Per-service custom override flags
    if (summaryConfig.use_custom !== undefined) updates.summary_use_custom = summaryConfig.use_custom ? 1 : 0;
    if (translationConfig.use_custom !== undefined) updates.translation_use_custom = translationConfig.use_custom ? 1 : 0;
    if (taggingConfig.use_custom !== undefined) updates.tagging_use_custom = taggingConfig.use_custom ? 1 : 0;
    if (embeddingConfig.use_custom !== undefined) updates.embedding_use_custom = embeddingConfig.use_custom ? 1 : 0;

    // Per-service custom configurations
    if (summaryConfig.api_key !== undefined) updates.summary_api_key = summaryConfig.api_key;
    if (summaryConfig.base_url !== undefined) updates.summary_base_url = summaryConfig.base_url;
    if (summaryConfig.model_name !== undefined) updates.summary_model_name = summaryConfig.model_name;

    if (translationConfig.api_key !== undefined) updates.translation_api_key = translationConfig.api_key;
    if (translationConfig.base_url !== undefined) updates.translation_base_url = translationConfig.base_url;
    if (translationConfig.model_name !== undefined) updates.translation_model_name = translationConfig.model_name;

    if (taggingConfig.api_key !== undefined) updates.tagging_api_key = taggingConfig.api_key;
    if (taggingConfig.base_url !== undefined) updates.tagging_base_url = taggingConfig.base_url;
    if (taggingConfig.model_name !== undefined) updates.tagging_model_name = taggingConfig.model_name;

    if (embeddingConfig.api_key !== undefined) updates.embedding_api_key = embeddingConfig.api_key;
    if (embeddingConfig.base_url !== undefined) updates.embedding_base_url = embeddingConfig.base_url;
    if (embeddingConfig.model_name !== undefined) updates.embedding_model = embeddingConfig.model_name;

    // Feature flags
    if (features.auto_summary !== undefined) updates.ai_auto_summary = features.auto_summary ? 1 : 0;
    if (features.auto_title_translation !== undefined) updates.ai_auto_title_translation = features.auto_title_translation ? 1 : 0;
    if (features.auto_tagging !== undefined) {
      updates.ai_auto_tagging = features.auto_tagging ? 1 : 0;
      if (features.auto_tagging && !wasAutoTaggingEnabled) {
        updates.ai_auto_tagging_start_at = now;
      }
    }
    if (features.title_display_mode !== undefined) updates.ai_title_display_mode = features.title_display_mode;
    if (features.translation_language !== undefined) updates.ai_translation_language = features.translation_language;

    userSettingsService.updateSettings(updates);
    initTaggingClient();

    return { success: true, message: 'AI configuration updated' };
  });

  // POST /ai/test - Test AI connection
  app.post('/ai/test', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ success: false, message: 'Invalid request body: expected an object' });
    }

    const service = (typeof body.service === 'string' ? body.service : 'summary') as ServiceKey;
    const apiKey = typeof body.api_key === 'string' ? body.api_key : undefined;
    const baseUrl = typeof body.base_url === 'string' ? body.base_url : undefined;
    const modelName = typeof body.model_name === 'string' ? body.model_name : undefined;

    if (!apiKey || !baseUrl || !modelName) {
      return {
        success: false,
        message: 'Missing api_key, base_url, or model_name',
      };
    }

    // Special case for embedding testing
    if (service === 'embedding') {
      try {
        // We need to bypass the client creation and test embedding generation directly
        // or construct a temporary client configuration.
        // Since generateEmbedding reads from UserSettings, we should ideally construct a temporary client.
        // But generateEmbedding is hardcoded to read from settings. 
        // For testing, let's update settings temporarily? No that's bad.
        // Let's modify generateEmbedding to accept overrides or create a temp test function here.

        // Simple test using openai directly
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey, baseURL: baseUrl });
        await client.embeddings.create({
          model: modelName,
          input: "test",
          encoding_format: "float"
        });
        return { success: true, message: 'Embedding API connection test succeeded' };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Embedding API connection test failed',
        };
      }
    }

    try {
      const client = createClient(service, { apiKey, baseUrl, modelName });
      await client.translate('Hello', { targetLanguage: 'zh' });
      return { success: true, message: 'AI connection test succeeded' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AI connection test failed',
      };
    }
  });

  // POST /ai/vector/rebuild - Rebuild vector database
  app.post('/ai/vector/rebuild', async (request, reply) => {
    try {
      const { rebuildVectorDB } = await import('../services/vector.js');

      // Check if embedding is configured
      const embeddingConfig = resolveServiceConfig('embedding' as any);
      if (!embeddingConfig.apiKey) {
        return reply.code(400).send({
          error: 'Embedding API key not configured'
        });
      }

      // Start rebuild (batch size 50 to avoid overwhelming the API)
      const result = await rebuildVectorDB(50);

      return {
        success: true,
        message: `Vector database rebuilt: ${result.processed} processed, ${result.failed} failed`,
        ...result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vector rebuild failed';
      console.error('[Vector] Rebuild error:', error);
      return reply.code(500).send({ error: message });
    }
  });

  // GET /ai/vector/stats - Get vector database statistics
  app.get('/ai/vector/stats', async () => {
    try {
      const { getVectorStats } = await import('../services/vector.js');
      return getVectorStats();
    } catch (error) {
      console.error('[Vector] Stats error:', error);
      return {
        total_entries: 0,
        vectorized_entries: 0,
        pending_entries: 0
      };
    }
  });

  // POST /ai/search - Semantic search using vector similarity
  app.post<{
    Body: { query: string; limit?: number; type?: 'semantic' | 'keyword' | 'hybrid' }
  }>('/ai/search', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.status(400).send({ error: 'Invalid request body: expected an object' });
    }

    const query = typeof body.query === 'string' ? body.query : '';
    const limit = typeof body.limit === 'number' ? body.limit : 20;
    const type = body.type === 'semantic' || body.type === 'keyword' || body.type === 'hybrid'
      ? body.type
      : 'hybrid';

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    try {
      const results: Array<{
        id: string;
        title: string;
        content?: string;
        feed_id: string;
        feed_title?: string;
        published_at: string | null;
        url: string | null;
        score: number;
        match_type: 'semantic' | 'keyword';
      }> = [];

      // Keyword search using SQL LIKE
      if (type === 'keyword' || type === 'hybrid') {
        const db = (await import('../db/session.js')).getDatabase();
        const keywordResults = db.prepare(`
          SELECT e.id, e.title, e.content, e.feed_id, f.title as feed_title,
                 e.published_at, e.url
          FROM entries e
          LEFT JOIN feeds f ON e.feed_id = f.id
          WHERE e.title LIKE ? OR e.content LIKE ?
          ORDER BY e.published_at DESC
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, limit) as Array<{
          id: string;
          title: string;
          content: string;
          feed_id: string;
          feed_title: string;
          published_at: string | null;
          url: string | null;
        }>;

        for (const r of keywordResults) {
          results.push({
            ...r,
            score: 0.8,
            match_type: 'keyword'
          });
        }
      }

      // Semantic search using vector similarity
      if (type === 'semantic' || type === 'hybrid') {
        try {
          const { searchVectors } = await import('../services/vector.js');
          const vectorResults = await searchVectors(query, limit);

          if (vectorResults && vectorResults.length > 0) {
            const db = (await import('../db/session.js')).getDatabase();

            for (const vr of vectorResults) {
              // Skip if already in results (from keyword search)
              if (results.some(r => r.id === vr.id)) continue;

              // Get full entry data
              const entry = db.prepare(`
                SELECT e.id, e.title, e.content, e.feed_id, f.title as feed_title,
                       e.published_at, e.url
                FROM entries e
                LEFT JOIN feeds f ON e.feed_id = f.id
                WHERE e.id = ?
              `).get(vr.id) as {
                id: string;
                title: string;
                content: string;
                feed_id: string;
                feed_title: string;
                published_at: string | null;
                url: string | null;
              } | undefined;

              if (entry) {
                results.push({
                  ...entry,
                  score: 1 - (vr.distance || 0),
                  match_type: 'semantic'
                });
              }
            }
          }
        } catch (vectorError) {
          console.warn('[Search] Vector search failed, using keyword only:', vectorError);
        }
      }

      // Sort by score and deduplicate
      const uniqueResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        query,
        type,
        total: uniqueResults.length,
        results: uniqueResults.map(r => ({
          ...r,
          content: r.content ? r.content.substring(0, 300) : ''
        }))
      };
    } catch (error) {
      console.error('[Search] Error:', error);
      return reply.status(500).send({ error: 'Search failed' });
    }
  });
}
