import { createHash } from 'crypto';
import { AIClient } from './ai.js';
import { FeedRepository } from '../db/repositories/feed.js';
import { ScopeSummaryRepository, type ScopeSummaryScopeType, type ScopeSummaryWindowType } from '../db/repositories/scopeSummary.js';
import { getDatabase } from '../db/session.js';
import { getConfig } from '../config/index.js';
import { userSettingsService } from './userSettings.js';

export type ScopeSummaryLanguage = 'zh' | 'en' | 'ja' | 'ko';

export interface ScopeSummarySourceItem {
  ref: number;
  entry_id: string;
  title: string;
  summary?: string | null;
  content_snippet?: string | null;
  feed_title?: string | null;
  published_at?: string | null;
}

export interface ScopeSummaryCitation {
  ref: number;
  entry_id: string;
}

export interface ScopeSummaryPayload {
  summary_md: string;
  citations: ScopeSummaryCitation[];
  keywords?: string[];
}

export interface ScopeSummaryChunkPayload {
  chunk_summary_md: string;
  citations: ScopeSummaryCitation[];
  keywords?: string[];
}

type ScopeSummaryEntryRow = {
  id: string;
  feed_id: string;
  title: string | null;
  url: string | null;
  published_at: string | null;
  inserted_at: string;
  summary: string | null;
  content: string | null;
  readability_content: string | null;
  feed_title: string | null;
};

function normalizeLanguage(language?: string | null): ScopeSummaryLanguage {
  const value = (language || '').toLowerCase();
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('ko')) return 'ko';
  return 'zh';
}

function getLanguageDisplayName(language: ScopeSummaryLanguage) {
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

  // Check if scope summary should use its own custom settings
  const scopeUseCustom = settings.scope_summary_use_custom === 1;

  let baseUrl: string;
  let apiKey: string;
  let modelName: string;

  if (scopeUseCustom) {
    // Use scope summary's own custom settings
    baseUrl = settings.scope_summary_base_url || config.glmBaseUrl || '';
    apiKey = settings.scope_summary_api_key || config.glmApiKey || '';
    modelName = settings.scope_summary_model_name || config.glmModel || '';
  } else {
    // Use default AI settings
    const useDefaultCustom = settings.summary_use_custom === 1;
    baseUrl = (useDefaultCustom ? settings.summary_base_url : settings.default_ai_base_url) || config.glmBaseUrl || '';
    apiKey = (useDefaultCustom ? settings.summary_api_key : settings.default_ai_api_key) || config.glmApiKey || '';
    modelName = (useDefaultCustom ? settings.summary_model_name : settings.default_ai_model) || config.glmModel || '';
  }

  return {
    client: new AIClient({ baseUrl, apiKey, model: modelName }),
    modelName: modelName || 'unknown',
  };
}

export function normalizeScopeSummaryWindowType(value?: string | null): ScopeSummaryWindowType {
  if (value === '3d' || value === '7d' || value === '30d') return value;
  return '24h';
}

export function buildScopeSummaryWindow(windowType?: string | null) {
  const normalizedWindow = normalizeScopeSummaryWindowType(windowType);
  const end = new Date();
  const start = new Date(end);
  const hoursMap: Record<ScopeSummaryWindowType, number> = {
    '24h': 24,
    '3d': 72,
    '7d': 168,
    '30d': 720,
  };
  start.setHours(start.getHours() - hoursMap[normalizedWindow]);
  return {
    windowType: normalizedWindow,
    windowStartAt: start.toISOString(),
    windowEndAt: end.toISOString(),
  };
}

function buildSourceHash(items: ScopeSummarySourceItem[]) {
  const payload = items.map((item) => [item.ref, item.entry_id, item.title.trim()].join(':')).join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Extract markdown content from a raw AI response that might contain JSON or be plain markdown.
 */
function extractMarkdownFromRawResponse(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Try to find JSON and extract markdown fields
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary_md) return sanitizeMarkdown(parsed.summary_md);
      if (parsed.chunk_summary_md) return sanitizeMarkdown(parsed.chunk_summary_md);
      // Try to find any string field that looks like markdown
      for (const key of Object.keys(parsed)) {
        const value = parsed[key];
        if (typeof value === 'string' && value.length > 50 && value.includes('\n')) {
          return sanitizeMarkdown(value);
        }
      }
    } catch {
      // Not valid JSON, continue with markdown extraction
    }
  }

  // Try to extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return sanitizeMarkdown(fenceMatch[1].trim());
  }

  // Remove any remaining JSON-like wrapper and return the content
  let cleaned = trimmed
    .replace(/^```[\s\S]*?```$/gm, '')  // Remove fenced code blocks
    .replace(/^{[\s\S]*?^}$/gm, '')     // Remove JSON objects
    .replace(/^\d+\.\s*$/gm, '')        // Remove numbered list markers
    .trim();

  // If still looks like JSON, return a generic message
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return '【摘要生成失败】AI 返回了无效的响应格式。请重新生成。';
  }

  return sanitizeMarkdown(cleaned);
}

function sanitizeMarkdown(value: unknown): string {
  if (typeof value !== 'string') return '';
  let cleaned = value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  // Remove trailing reference-only block such as:
  // 参考文献
  // [1]
  // [2]
  cleaned = cleaned.replace(
    /\n{0,2}(?:#{1,6}\s*)?(?:参考文献|参考资料|references?)\s*\n(?:\s*(?:[-*]\s*)?\[\d+\]\s*\n?)+\s*$/i,
    '',
  ).trim();
  return cleaned;
}

function parseKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && !!item.trim()).slice(0, 10);
}

function extractCitationRefs(summaryMarkdown: string) {
  const refs = new Set<number>();
  // Extract from <span entry_id="0,1,2"> format (0-based indices)
  for (const match of summaryMarkdown.matchAll(/<span\s+entry_id="([^"]+)"/gi)) {
    const ids = match[1].split(',').map(s => s.trim());
    for (const id of ids) {
      const num = Number(id);
      if (Number.isInteger(num) && num >= 0) {
        refs.add(num + 1); // Convert 0-based to 1-based ref
      }
    }
  }
  // Extract from (编号: X) or 编号: X format
  for (const match of summaryMarkdown.matchAll(/[（(]?编号:\s*(\d+)[）)]?/g)) {
    const num = Number(match[1]);
    if (Number.isInteger(num) && num >= 0) {
      refs.add(num + 1); // Convert 0-based to 1-based ref
    }
  }
  // Extract from plain (0), (1), (2) format (0-based indices)
  for (const match of summaryMarkdown.matchAll(/\((\d+)\)/g)) {
    const num = Number(match[1]);
    if (Number.isInteger(num) && num >= 0) {
      refs.add(num + 1); // Convert 0-based to 1-based ref
    }
  }
  // Fallback: also support old [1] format
  for (const match of summaryMarkdown.matchAll(/\[(\d+)\]/g)) {
    const ref = Number(match[1]);
    if (Number.isInteger(ref) && ref > 0) refs.add(ref);
  }
  return Array.from(refs).sort((a, b) => a - b);
}

function ensureCitations<T extends { summary_md?: string; chunk_summary_md?: string; citations: ScopeSummaryCitation[] }>(
  payload: T,
  itemsByRef: Map<number, ScopeSummarySourceItem>,
) {
  const existing = new Set(payload.citations.map((item) => item.ref));
  const body = payload.summary_md ?? payload.chunk_summary_md ?? '';
  for (const ref of extractCitationRefs(body)) {
    if (existing.has(ref)) continue;
    const item = itemsByRef.get(ref);
    if (!item) continue;
    payload.citations.push({ ref, entry_id: item.entry_id });
    existing.add(ref);
  }
  payload.citations.sort((a, b) => a.ref - b.ref);
  return payload;
}

function parseJsonPayload<T extends 'final' | 'chunk'>(
  raw: string,
  itemsByRef: Map<number, ScopeSummarySourceItem>,
  mode: T,
): T extends 'final' ? ScopeSummaryPayload | null : ScopeSummaryChunkPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null as any;

  const tryParse = (candidate: string) => {
    try {
      return JSON.parse(candidate) as {
        summary_md?: unknown;
        chunk_summary_md?: unknown;
        citations?: Array<{ ref?: unknown }>;
        keywords?: unknown;
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  const fenced = !direct ? trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] : null;
  const objectChunk = !direct && !fenced
    ? (() => {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
    })()
    : null;
  const parsed = direct || (fenced ? tryParse(fenced.trim()) : null) || (objectChunk ? tryParse(objectChunk) : null);
  if (!parsed) return null as any;

  const citations = Array.isArray(parsed.citations)
    ? parsed.citations
      .map((item) => {
        const ref = typeof item?.ref === 'number' ? item.ref : Number(item?.ref);
        if (!Number.isInteger(ref)) return null;
        // AI 可能输出 0-based 或 1-based，尝试两种方式
        const source = itemsByRef.get(ref) || itemsByRef.get(ref + 1);
        if (!source) return null;
        // 标准化为 1-based ref
        const normalizedRef = itemsByRef.get(ref) ? ref : ref + 1;
        return { ref: normalizedRef, entry_id: source.entry_id };
      })
      .filter((item): item is ScopeSummaryCitation => !!item)
    : [];

  if (mode === 'chunk') {
    const payload: ScopeSummaryChunkPayload = {
      chunk_summary_md: sanitizeMarkdown(parsed.chunk_summary_md ?? parsed.summary_md),
      citations,
      keywords: parseKeywords(parsed.keywords),
    };
    if (!payload.chunk_summary_md) return null as any;
    return ensureCitations(payload, itemsByRef) as any;
  }

  const payload: ScopeSummaryPayload = {
    summary_md: sanitizeMarkdown(parsed.summary_md),
    citations,
    keywords: parseKeywords(parsed.keywords),
  };
  if (!payload.summary_md) return null as any;
  return ensureCitations(payload, itemsByRef) as any;
}

function buildSnippet(item: ScopeSummarySourceItem) {
  const raw = (item.summary || item.content_snippet || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '无';
  return raw.slice(0, 420);
}

function chunkItems<T>(items: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}

async function runWithTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildChunkPrompt(input: {
  scope_type: ScopeSummaryScopeType;
  scope_label: string;
  window_type: ScopeSummaryWindowType;
  language: ScopeSummaryLanguage;
  items: ScopeSummarySourceItem[];
}) {
  const scopeDisplay = input.scope_type === 'feed' ? '订阅源' : '分类';
  const languageDisplay = getLanguageDisplayName(input.language);
  const sourceLines = input.items.map((item) => {
    const snippet = buildSnippet(item);
    const itemIndex = item.ref - 1;
    const parts = [
      `编号: ${itemIndex}`,
      `标题: ${item.title || 'Untitled'}`,
      item.published_at ? `时间: ${item.published_at}` : null,
      `内容: ${snippet}`,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n');

  // Get user's personalized summary preference
  const settings = userSettingsService.getSettings();
  const userPreference = settings.summary_prompt_preference?.trim() || '';
  const preferenceInstruction = userPreference
    ? `\n\n【个性化风格要求】（请务必遵循）：\n${userPreference}`
    : '';

  return {
    systemPrompt: `你是资深RSS内容编辑，擅长从多篇文章中提取核心信息并生成结构化摘要。${preferenceInstruction}\n\n输出格式（严格JSON）：\n{"chunk_summary_md":"Markdown字符串","keywords":["关键词数组"]}\n\n【必须遵守的硬性规则】：\n1. 每提到一篇具体文章，就必须用 <span entry_id="编号">文章相关词语</span> 包裹该词语\n2. 编号必须是 0 到 ${input.items.length - 1} 之间的数字（0-based）\n3. 禁止使用 (0)、[1]、编号:X 等任何其他引用格式\n4. 不要输出参考文献或引用列表`,
    userPrompt: `${scopeDisplay}：${input.scope_label}\n时间范围：${input.window_type}\n输出语言：${languageDisplay}\n\n文章材料（共${input.items.length}篇，编号从0到${input.items.length - 1}）：\n${sourceLines}\n\n【生成规则 - 必须严格遵守】：\n1. chunk_summary_md 是 Markdown 总结\n2. 【关键】每提到一篇具体文章的内容，必须用 <span entry_id="0">关键词</span> 包裹\n3. 示例：<span entry_id="0">Kagi Translate</span>推出了新功能，<span entry_id="1,2">相关报道</span>指出...\n4. 【禁止】绝对不要使用 (0)、[1]、编号:X 等格式，只用 <span entry_id="...">\n5. 每句话最好都带引用\n6. 输出纯JSON格式，不要代码块`,
  };
}

function buildMergePrompt(input: {
  scope_type: ScopeSummaryScopeType;
  scope_label: string;
  window_type: ScopeSummaryWindowType;
  language: ScopeSummaryLanguage;
  chunks: ScopeSummaryChunkPayload[];
}) {
  const scopeDisplay = input.scope_type === 'feed' ? '订阅源' : '分类';
  const languageDisplay = getLanguageDisplayName(input.language);
  const chunkLines = input.chunks.map((chunk, index) => {
    return `### 分块 ${index + 1}\n${chunk.chunk_summary_md}`;
  }).join('\n\n');

  // Get user's personalized summary preference
  const settings = userSettingsService.getSettings();
  const userPreference = settings.summary_prompt_preference?.trim() || '';
  const preferenceInstruction = userPreference
    ? `\n\n【个性化风格要求】（请务必遵循）：\n${userPreference}`
    : '';

  return {
    systemPrompt: `你是资深RSS内容编辑，擅长整合多个摘要片段生成连贯的结构化总结。${preferenceInstruction}\n\n输出格式（严格JSON）：\n{"summary_md":"Markdown字符串","keywords":["关键词数组"]}\n\n【必须遵守的硬性规则】：\n1. 保留所有原文中的 <span entry_id="编号"> 引用标签格式\n2. 编号必须是数字（0-based）\n3. 禁止使用 (0)、[1]、编号:X 等任何其他引用格式\n4. 不要输出参考文献或引用列表`,
    userPrompt: `${scopeDisplay}：${input.scope_label}\n时间范围：${input.window_type}\n输出语言：${languageDisplay}\n\n分块摘要（来自${input.chunks.length}个批次）：\n${chunkLines}\n\n【整合规则 - 必须严格遵守】：\n1. 将多个分块整合为一个连贯的总结\n2. 【关键】保留所有 <span entry_id="0"> 引用标签，格式绝对不能改变\n3. 示例：<span entry_id="0">Kagi Translate</span>推出了新功能，<span entry_id="1,2">相关报道</span>指出...\n4. 【禁止】绝对不要使用 (0)、[1]、编号:X 等格式\n5. 突出主题脉络和关键信息点\n6. 不要添加参考文献部分\n7. 输出纯JSON格式，不要代码块`,
  };
}

function resolveScopeLabel(scopeType: ScopeSummaryScopeType, scopeId: string) {
  if (scopeType === 'group') {
    // Verify group exists in database
    const db = getDatabase();
    const groupFeeds = db.prepare('SELECT COUNT(*) as count FROM feeds WHERE group_name = ?').get(scopeId) as { count: number };
    console.log(`[ScopeSummary] Group lookup: name="${scopeId}", feed_count=${groupFeeds?.count ?? 0}`);
    return scopeId;
  }
  const feedRepo = new FeedRepository();
  const feed = feedRepo.findById(scopeId);
  if (!feed) return null;
  return feed.custom_title || feed.title || feed.url || scopeId;
}

function queryEntries(input: {
  scope_type: ScopeSummaryScopeType;
  scope_id: string;
  windowStartAt: string;
  windowEndAt: string;
  limit: number;
}) {
  const db = getDatabase();
  const limit = Math.max(1, Math.min(input.limit, 200));
  let rows: ScopeSummaryEntryRow[];

  if (input.scope_type === 'feed') {
    rows = db.prepare(`
      SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content, e.readability_content,
             f.title AS feed_title
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
      WHERE e.feed_id = ?
        AND COALESCE(e.published_at, e.inserted_at) >= ?
        AND COALESCE(e.published_at, e.inserted_at) <= ?
      ORDER BY COALESCE(e.published_at, e.inserted_at) DESC
      LIMIT ?
    `).all(input.scope_id, input.windowStartAt, input.windowEndAt, limit) as ScopeSummaryEntryRow[];
  } else {
    // Group query - debug: list all unique group_names
    const allGroups = db.prepare('SELECT DISTINCT group_name FROM feeds').all() as { group_name: string }[];
    console.log(`[ScopeSummary] Available group_names:`, allGroups.map(g => g.group_name));

    rows = db.prepare(`
      SELECT e.id, e.feed_id, e.title, e.url, e.published_at, e.inserted_at, e.summary, e.content, e.readability_content,
             f.title AS feed_title
      FROM entries e
      INNER JOIN feeds f ON e.feed_id = f.id
      WHERE COALESCE(f.group_name, '') = ?
        AND COALESCE(e.published_at, e.inserted_at) >= ?
        AND COALESCE(e.published_at, e.inserted_at) <= ?
      ORDER BY COALESCE(e.published_at, e.inserted_at) DESC
      LIMIT ?
    `).all(input.scope_id, input.windowStartAt, input.windowEndAt, limit) as ScopeSummaryEntryRow[];

    console.log(`[ScopeSummary] Group query: group="${input.scope_id}", window="${input.windowStartAt} to ${input.windowEndAt}", result_count=${rows.length}`);
  }

  return rows;
}

function toSourceItems(rows: ScopeSummaryEntryRow[]): ScopeSummarySourceItem[] {
  return rows.map((entry, index) => ({
    ref: index + 1,
    entry_id: entry.id,
    title: entry.title || 'Untitled',
    summary: entry.summary,
    content_snippet: entry.readability_content || entry.content,
    feed_title: entry.feed_title,
    published_at: entry.published_at || entry.inserted_at,
  }));
}

function parseJsonRecord<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class ScopeSummaryService {
  private repo = new ScopeSummaryRepository();

  getSettings() {
    const settings = userSettingsService.getSettings();
    return {
      enabled: settings.scope_summary_enabled === 1,
      auto_generate: settings.scope_summary_auto_generate === 1,
      auto_generate_interval_minutes: Math.max(5, Number(settings.scope_summary_auto_interval_minutes) || 60),
      default_window: normalizeScopeSummaryWindowType(settings.scope_summary_default_window),
      max_entries: Math.max(20, Math.min(Number(settings.scope_summary_max_entries) || 100, 200)),
      chunk_size: Math.max(5, Math.min(Number(settings.scope_summary_chunk_size) || 10, 25)),
    };
  }

  buildScopeState(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type?: string | null;
    language?: string | null;
  }) {
    const settings = this.getSettings();
    const language = normalizeLanguage(input.language);
    const { windowType, windowStartAt, windowEndAt } = buildScopeSummaryWindow(input.window_type || settings.default_window);
    const scopeLabel = resolveScopeLabel(input.scope_type, input.scope_id);
    if (!scopeLabel) return null;

    const rows = queryEntries({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      windowStartAt,
      windowEndAt,
      limit: settings.max_entries,
    });
    const items = toSourceItems(rows);
    const sourceHash = buildSourceHash(items);
    const latestRun = this.repo.findLatest({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      window_type: windowType,
      language,
    });

    let status: 'empty' | 'idle' | 'stale' | 'generating' | 'ready' | 'failed' = 'idle';
    if (!items.length) {
      status = 'empty';
    } else if (!latestRun) {
      status = 'idle';
    } else if (latestRun.status === 'generating') {
      const generatingAgeMs = Date.now() - new Date(latestRun.updated_at).getTime();
      if (generatingAgeMs >= 20 * 60 * 1000) {
        this.repo.updateRun(latestRun.id, {
          status: 'failed',
          error_message: 'Scope summary generation exceeded 20 minutes and was marked as failed.',
        });
        status = 'failed';
      } else {
        status = 'generating';
      }
    } else if (latestRun.status === 'failed') {
      status = 'failed';
    } else if (latestRun.source_hash !== sourceHash) {
      status = 'stale';
    } else {
      const ageMs = Date.now() - new Date(latestRun.updated_at).getTime();
      const staleByInterval = ageMs >= settings.auto_generate_interval_minutes * 60 * 1000;
      status = staleByInterval ? 'stale' : 'ready';
    }

    return {
      scopeLabel,
      language,
      settings,
      windowType,
      windowStartAt,
      windowEndAt,
      rows,
      items,
      sourceHash,
      latestRun,
      status,
    };
  }

  async generate(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type?: string | null;
    language?: string | null;
    trigger_type?: 'auto' | 'manual';
  }) {
    const state = this.buildScopeState(input);
    if (!state) {
      throw new Error('scope not found');
    }
    if (!state.items.length) {
      throw new Error('empty scope window');
    }

    const { client, modelName } = resolveSummaryClient();
    const triggerType = input.trigger_type ?? 'manual';
    const run = this.repo.createRun({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      window_type: state.windowType,
      window_start_at: state.windowStartAt,
      window_end_at: state.windowEndAt,
      language: state.language,
      source_count: state.items.length,
      source_hash: state.sourceHash,
      status: 'generating',
      trigger_type: triggerType,
    });

    try {
      const itemsByRef = new Map(state.items.map((item) => [item.ref, item]));
      const chunks = chunkItems(state.items, state.settings.chunk_size);
      console.log(`[ScopeSummary] Processing ${state.items.length} items with chunk_size=${state.settings.chunk_size}, resulting in ${chunks.length} chunks`);
      console.log(`[ScopeSummary] Chunk sizes:`, chunks.map(c => c.length));
      const chunkPayloads: ScopeSummaryChunkPayload[] = [];

      for (let index = 0; index < chunks.length; index += 1) {
        const chunkItemsList = chunks[index];
        const prompt = buildChunkPrompt({
          scope_type: input.scope_type,
          scope_label: state.scopeLabel,
          window_type: state.windowType,
          language: state.language,
          items: chunkItemsList,
        });
        // Log the prompt for debugging
        console.log(`\n========== CHUNK ${index + 1} PROMPT ==========`);
        console.log(`SYSTEM: ${prompt.systemPrompt}`);
        console.log(`\nUSER (前2000字符): ${prompt.userPrompt.slice(0, 2000)}...`);
        console.log(`===============================================\n`);

        const raw = await runWithTimeout(
          client.chat(
            [
              { role: 'system', content: prompt.systemPrompt },
              { role: 'user', content: prompt.userPrompt },
            ],
            { maxTokens: 2200, temperature: 0.25 },
          ),
          90_000,
          `scope-summary chunk#${index + 1}`,
        );
        const parsed = parseJsonPayload(raw, itemsByRef, 'chunk');
        let payload: ScopeSummaryChunkPayload;
        if (!parsed) {
          console.error(`[ScopeSummary] Failed to parse chunk#${index + 1} response as JSON, raw response:`, raw.slice(0, 500));
          // Fallback: extract markdown from raw response
          const fallbackMarkdown = extractMarkdownFromRawResponse(raw);
          const fallbackPayload = {
            chunk_summary_md: fallbackMarkdown,
            citations: [] as ScopeSummaryCitation[],
            keywords: [],
          };
          payload = ensureCitations(fallbackPayload, itemsByRef);
        } else {
          payload = ensureCitations(parsed, itemsByRef);
        }
        chunkPayloads.push(payload);
        this.repo.createChunk({
          run_id: run.id,
          chunk_index: index,
          source_count: chunkItemsList.length,
          source_refs_json: JSON.stringify(chunkItemsList.map((item) => item.ref)),
          chunk_summary_md: payload.chunk_summary_md,
          keywords_json: payload.keywords?.length ? JSON.stringify(payload.keywords) : null,
          model_name: modelName,
        });
      }

      const mergePrompt = buildMergePrompt({
        scope_type: input.scope_type,
        scope_label: state.scopeLabel,
        window_type: state.windowType,
        language: state.language,
        chunks: chunkPayloads,
      });
      // Log merge prompt for debugging
      console.log(`\n========== MERGE PROMPT ==========`);
      console.log(`SYSTEM: ${mergePrompt.systemPrompt}`);
      console.log(`\nUSER (前3000字符): ${mergePrompt.userPrompt.slice(0, 3000)}...`);
      console.log(`=================================\n`);

      const mergeRaw = await runWithTimeout(
        client.chat(
          [
            { role: 'system', content: mergePrompt.systemPrompt },
            { role: 'user', content: mergePrompt.userPrompt },
          ],
          { maxTokens: 2600, temperature: 0.2 },
        ),
        120_000,
        'scope-summary merge',
      );
      const finalPayload = parseJsonPayload(mergeRaw, itemsByRef, 'final');
      let ensuredPayload: ScopeSummaryPayload;
      if (!finalPayload) {
        console.error('[ScopeSummary] Failed to parse merge response as JSON, raw response:', mergeRaw.slice(0, 500));
        // Fallback: extract markdown content from the raw response
        const fallbackMarkdown = extractMarkdownFromRawResponse(mergeRaw);
        const fallbackPayload = {
          summary_md: fallbackMarkdown,
          citations: [] as ScopeSummaryCitation[],
          keywords: [],
        };
        ensuredPayload = ensureCitations(fallbackPayload, itemsByRef);
      } else {
        ensuredPayload = ensureCitations(finalPayload, itemsByRef);
      }
      const readyRun = this.repo.updateRun(run.id, {
        status: 'ready',
        summary_md: ensuredPayload.summary_md,
        citations_json: JSON.stringify(ensuredPayload.citations),
        keywords_json: ensuredPayload.keywords?.length ? JSON.stringify(ensuredPayload.keywords) : null,
        model_name: modelName,
        error_message: null,
      });
      if (!readyRun) throw new Error('failed to update scope summary run');

      return {
        state,
        run: readyRun,
        payload: ensuredPayload,
        entries: state.rows,
      };
    } catch (error) {
      this.repo.updateRun(run.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        model_name: modelName,
      });
      throw error;
    }
  }

  getHistory(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type: ScopeSummaryWindowType;
    language?: string | null;
    limit: number;
    cursor?: string | null;
  }) {
    return this.repo.findHistory({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      window_type: input.window_type,
      language: normalizeLanguage(input.language),
      limit: input.limit,
      cursor: input.cursor,
    });
  }

  parseRun(run: ReturnType<ScopeSummaryRepository['findById']>) {
    if (!run) return null;
    return {
      ...run,
      citations: parseJsonRecord(run.citations_json, [] as ScopeSummaryCitation[]),
      keywords: parseJsonRecord(run.keywords_json, [] as string[]),
    };
  }
}

export const scopeSummaryService = new ScopeSummaryService();
