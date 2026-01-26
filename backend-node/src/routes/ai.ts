/**
 * AI API Routes (Translation and Summarization)
 */

import { FastifyInstance } from 'fastify';
import { AIClient, type ServiceKey } from '../services/ai.js';
import { generateEmbedding } from '../services/vector.js';
import { EntryRepository, TranslationRepository, SummaryRepository } from '../db/repositories/index.js';
import { userSettingsService } from '../services/userSettings.js';
import { getConfig } from '../config/index.js';

function resolveServiceConfig(service: ServiceKey) {
  const settings = userSettingsService.getSettings();
  const config = getConfig();

  const fallbackApiKey = config.glmApiKey || '';
  const fallbackBaseUrl = config.glmBaseUrl || '';
  const fallbackModel = config.glmModel || '';

  if (service === 'summary') {
    return {
      apiKey: settings.summary_api_key || fallbackApiKey,
      baseUrl: settings.summary_base_url || fallbackBaseUrl,
      modelName: settings.summary_model_name || fallbackModel,
    };
  }

  if (service === 'embedding') {
    return {
      apiKey: settings.embedding_api_key || '',
      baseUrl: settings.embedding_base_url || '',
      modelName: settings.embedding_model || '',
    };
  }

  return {
    apiKey: settings.translation_api_key || fallbackApiKey,
    baseUrl: settings.translation_base_url || fallbackBaseUrl,
    modelName: settings.translation_model_name || fallbackModel,
  };
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

  // POST /ai/summary - Generate summary (frontend expects entry_id)
  app.post('/ai/summary', async (request, reply) => {
    const { entry_id, language } = request.body as { entry_id?: string; language?: string };
    const targetLanguage = language || 'zh';

    if (!entry_id) {
      return reply.code(400).send({ error: 'entry_id is required' });
    }

    const entry = entryRepo.findById(entry_id);
    if (!entry) {
      return reply.code(404).send({ error: 'Entry not found' });
    }

    const existing = summaryRepo.findByEntryIdAndLanguage(entry_id, targetLanguage);
    if (existing?.summary) {
      return { entry_id, language: targetLanguage, summary: existing.summary };
    }

    const combinedContent = buildSummaryContent(entry);
    if (!combinedContent) {
      return reply.code(400).send({ error: 'Entry has no content to summarize' });
    }

    try {
      const client = createClient('summary');
      const summary = await client.summarize(combinedContent, { language: targetLanguage });
      summaryRepo.upsert({ entry_id, language: targetLanguage, summary });
      return { entry_id, language: targetLanguage, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Summary generation failed';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /ai/translate-title - Translate entry title
  app.post('/ai/translate-title', async (request, reply) => {
    const { entry_id, language } = request.body as { entry_id?: string; language?: string };
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
      const title = await client.translate(entry.title, { targetLanguage });
      translationRepo.upsert({ entry_id, language: targetLanguage, title });
      return { entry_id, title, language: targetLanguage, from_cache: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Title translation failed';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /ai/translate-blocks - SSE translation
  app.post('/ai/translate-blocks', async (request, reply) => {
    const body = request.body as {
      entry_id?: string;
      source_lang?: string;
      target_lang?: string;
      blocks?: Array<{ id: string; text: string }>;
    };

    const entryId = body.entry_id;
    const sourceLang = body.source_lang || 'en';
    const targetLang = body.target_lang || 'zh';
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];

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

      for (const block of misses) {
        if (request.raw.aborted) {
          break;
        }

        try {
          const translated = await client.translate(block.text, { targetLanguage: targetLang });
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
    const { text, target_language, entry_id } = request.body as any;

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
      const translation = await client.translate(text, { targetLanguage: target_language || 'zh' });

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
    const { content, language, entry_id } = request.body as any;

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
      const summary = await client.summarize(content, { language: language || 'zh' });

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
    const summaryConfig = resolveServiceConfig('summary');
    const translationConfig = resolveServiceConfig('translation');
    // @ts-ignore - 'embedding' is a new service key not yet in ServiceKey type maybe
    const embeddingConfig = resolveServiceConfig('embedding' as any);
    const settings = userSettingsService.getSettings();

    return {
      summary: {
        api_key: summaryConfig.apiKey,
        base_url: summaryConfig.baseUrl,
        model_name: summaryConfig.modelName,
        has_api_key: !!summaryConfig.apiKey,
      },
      translation: {
        api_key: translationConfig.apiKey,
        base_url: translationConfig.baseUrl,
        model_name: translationConfig.modelName,
        has_api_key: !!translationConfig.apiKey,
      },
      embedding: {
        api_key: embeddingConfig.apiKey,
        base_url: embeddingConfig.baseUrl,
        model_name: embeddingConfig.modelName,
        has_api_key: !!embeddingConfig.apiKey,
      },
      features: {
        auto_summary: !!settings.ai_auto_summary,
        auto_title_translation: !!settings.ai_auto_title_translation,
        title_display_mode: settings.ai_title_display_mode || 'original-first',
        translation_language: settings.ai_translation_language || 'zh',
      },
    };
  });

  // PATCH /ai/config - Update AI configuration
  app.patch('/ai/config', async (request) => {
    const body = request.body as any;
    const summaryConfig = body.summary || {};
    const translationConfig = body.translation || {};
    const embeddingConfig = body.embedding || {};
    const features = body.features || {};

    const updates: Record<string, any> = {};

    if (summaryConfig.api_key !== undefined) updates.summary_api_key = summaryConfig.api_key;
    if (summaryConfig.base_url !== undefined) updates.summary_base_url = summaryConfig.base_url;
    if (summaryConfig.model_name !== undefined) updates.summary_model_name = summaryConfig.model_name;

    if (translationConfig.api_key !== undefined) updates.translation_api_key = translationConfig.api_key;
    if (translationConfig.base_url !== undefined) updates.translation_base_url = translationConfig.base_url;
    if (translationConfig.model_name !== undefined) updates.translation_model_name = translationConfig.model_name;

    if (embeddingConfig.api_key !== undefined) updates.embedding_api_key = embeddingConfig.api_key;
    if (embeddingConfig.base_url !== undefined) updates.embedding_base_url = embeddingConfig.base_url;
    if (embeddingConfig.model_name !== undefined) updates.embedding_model = embeddingConfig.model_name;

    if (features.auto_summary !== undefined) updates.ai_auto_summary = features.auto_summary ? 1 : 0;
    if (features.auto_title_translation !== undefined) updates.ai_auto_title_translation = features.auto_title_translation ? 1 : 0;
    if (features.title_display_mode !== undefined) updates.ai_title_display_mode = features.title_display_mode;
    if (features.translation_language !== undefined) updates.ai_translation_language = features.translation_language;

    userSettingsService.updateSettings(updates);

    return { success: true, message: 'AI configuration updated' };
  });

  // POST /ai/test - Test AI connection
  app.post('/ai/test', async (request) => {
    const body = request.body as any;

    const service = (body.service || 'summary') as ServiceKey;
    const apiKey = body.api_key;
    const baseUrl = body.base_url;
    const modelName = body.model_name;

    if (!apiKey || !baseUrl || !modelName) {
      return {
        success: false,
        message: 'Missing api_key, base_url, or model_name',
      };
    }

    // Special case for embedding testing
    if (service === 'embedding' as any) {
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
}
