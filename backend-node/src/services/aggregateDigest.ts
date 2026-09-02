import { createHash } from 'crypto';
import { AIClient } from './ai.js';
import { AggregateDigestRepository } from '../db/repositories/aggregateDigest.js';
import { getDatabase } from '../db/session.js';
import { getConfig } from '../config/index.js';
import { userSettingsService } from './userSettings.js';
import { AIScopeType } from '../db/models.js';

export type DigestLanguage = 'zh' | 'en' | 'ja' | 'ko';

export interface DigestSourceItem {
  ref: number;
  entry_id: string;
  title: string;
  summary?: string | null;
  content_snippet?: string | null;
  feed_title?: string | null;
  group_name?: string | null;
  published_at?: string | null;
}

export interface AggregateDigestCitation {
  ref: number;
  entry_id: string;
}

export interface AggregateDigestPayload {
  summary_md: string;
  citations: AggregateDigestCitation[];
  keywords?: string[];
}

function normalizeDigestLanguage(language?: string | null): DigestLanguage {
  const value = (language || '').toLowerCase();
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('ko')) return 'ko';
  return 'zh';
}

function getLanguageDisplayName(language: DigestLanguage) {
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
    modelName: modelName || 'unknown',
  };
}

export function buildDigestTimeWindow(period?: string) {
  const now = new Date();
  if (period === 'week') {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const isoDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const isoDay = isoDate.getUTCDay() || 7;
    isoDate.setUTCDate(isoDate.getUTCDate() + 4 - isoDay);
    const isoYear = isoDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNo = Math.ceil((((isoDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const weekKey = `${isoYear}-W${String(weekNo).padStart(2, '0')}`;

    return { startDate: weekStart.toISOString(), periodKey: weekKey, normalizedPeriod: 'week' as const };
  }

  return { startDate: null, periodKey: 'latest', normalizedPeriod: 'latest' as const };
}

export function buildDigestSourceHash(items: DigestSourceItem[]) {
  const payload = items
    .map((item) => [item.ref, item.entry_id, item.title.trim()].join(':'))
    .join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

function buildSnippet(item: DigestSourceItem) {
  const raw = (item.summary || item.content_snippet || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '无';
  return raw.slice(0, 220);
}

function parseKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && !!item.trim()).slice(0, 8);
}

function sanitizeSummaryMarkdown(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseAggregateDigestPayload(
  raw: string,
  itemsByRef: Map<number, DigestSourceItem>,
): AggregateDigestPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const tryParse = (candidate: string) => {
    try {
      return JSON.parse(candidate) as {
        summary_md?: unknown;
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
  if (!parsed) return null;

  const summary_md = sanitizeSummaryMarkdown(parsed.summary_md);
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations
        .map((item) => {
          const ref = typeof item?.ref === 'number' ? item.ref : Number(item?.ref);
          if (!Number.isInteger(ref)) return null;
          const source = itemsByRef.get(ref);
          if (!source) return null;
          return { ref, entry_id: source.entry_id };
        })
        .filter((item): item is AggregateDigestCitation => !!item)
    : [];

  if (!summary_md) return null;

  return {
    summary_md,
    citations,
    keywords: parseKeywords(parsed.keywords),
  };
}

function extractCitationRefs(summaryMarkdown: string) {
  const refs = new Set<number>();
  for (const match of summaryMarkdown.matchAll(/\[(\d+)\]/g)) {
    const ref = Number(match[1]);
    if (Number.isInteger(ref)) refs.add(ref);
  }
  return Array.from(refs).sort((a, b) => a - b);
}

function ensureCitations(payload: AggregateDigestPayload, itemsByRef: Map<number, DigestSourceItem>) {
  const existing = new Set(payload.citations.map((item) => item.ref));
  const refsInSummary = extractCitationRefs(payload.summary_md);
  for (const ref of refsInSummary) {
    if (existing.has(ref)) continue;
    const item = itemsByRef.get(ref);
    if (!item) continue;
    payload.citations.push({ ref, entry_id: item.entry_id });
    existing.add(ref);
  }
  payload.citations.sort((a, b) => a.ref - b.ref);
  return payload;
}

function buildDigestPromptContext(input: {
  scope_type: Exclude<AIScopeType, 'global'>;
  scope_label: string;
  period: 'latest' | 'week';
  time_range_key: string;
  language: DigestLanguage;
  items: DigestSourceItem[];
}) {
  const scopeDisplay = input.scope_type === 'feed'
    ? '订阅'
    : input.scope_type === 'group'
      ? '分组'
      : '标签';
  const periodDisplay = input.period === 'week' ? '本周' : '最新';
  const languageDisplay = getLanguageDisplayName(input.language);
  const sourceLines = input.items.map((item) => {
    const parts = [
      `[${item.ref}] 标题: ${item.title || 'Untitled'}`,
      item.feed_title ? `来源: ${item.feed_title}` : null,
      item.group_name ? `分组: ${item.group_name}` : null,
      item.published_at ? `时间: ${item.published_at}` : null,
      `线索: ${buildSnippet(item)}`,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n');

  const systemPrompt = `你是 RSS 信息聚合助手。你会收到某个${scopeDisplay}的一组文章线索，请输出结构化 JSON，总结近期重要变化。
输出必须是 JSON 对象，格式：
{"summary_md":"Markdown 摘要","citations":[{"ref":1}],"keywords":["关键词1","关键词2"]}`;

  const userPrompt = `${scopeDisplay}：${input.scope_label}
时间范围：${periodDisplay}
时间标识：${input.time_range_key}
输出语言：${languageDisplay}

信息源：
${sourceLines}

要求：
1. summary_md 必须使用 ${languageDisplay} 输出，可以用 Markdown，但不要输出 HTML。
2. 内容应是归纳总结，不要逐条复述。
3. 如果引用来源，请在正文中使用 [1] [2] 这样的编号。
4. citations 只填写 ref，不要输出标题、链接或 entry_id。
5. 引用只能使用输入中已有的 ref 编号，不得编造。
6. 尽量提炼 3-6 个高信息密度点，并给出一句结论。
7. keywords 输出 0-8 个短词。
8. 输出必须是严格 JSON，不要代码块。`;

  return { systemPrompt, userPrompt };
}

export class AggregateDigestService {
  private repo = new AggregateDigestRepository();

  getLatest(input: {
    scope_type: Exclude<AIScopeType, 'global'>;
    scope_id: string;
    period: string;
    time_range_key: string;
    language: string;
  }) {
    return this.repo.findLatestByScope(input);
  }

  getHistory(input: {
    scope_type: Exclude<AIScopeType, 'global'>;
    scope_id: string;
    period: string;
    language: string;
    limit: number;
    cursor?: string | null;
  }) {
    return this.repo.findHistoryByScope(input);
  }

  async generate(input: {
    scope_type: Exclude<AIScopeType, 'global'>;
    scope_id: string;
    scope_label: string;
    period: 'latest' | 'week';
    time_range_key: string;
    language?: string | null;
    items: DigestSourceItem[];
    trigger_type?: 'auto' | 'manual';
  }) {
    const language = normalizeDigestLanguage(input.language);
    const itemsByRef = new Map(input.items.map((item) => [item.ref, item]));
    const { client, modelName } = resolveSummaryClient();
    const prompt = buildDigestPromptContext({
      scope_type: input.scope_type,
      scope_label: input.scope_label,
      period: input.period,
      time_range_key: input.time_range_key,
      language,
      items: input.items,
    });

    const raw = await client.chat(
      [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt },
      ],
      { maxTokens: 2200, temperature: 0.2 },
    );

    const parsed = parseAggregateDigestPayload(raw, itemsByRef) || {
      summary_md: raw.trim(),
      citations: [],
      keywords: [],
    };
    const payload = ensureCitations(parsed, itemsByRef);
    const sourceHash = buildDigestSourceHash(input.items);

    const record = this.repo.create({
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      period: input.period,
      time_range_key: input.time_range_key,
      language,
      source_count: input.items.length,
      source_hash: sourceHash,
      summary_md: payload.summary_md,
      citations_json: JSON.stringify(payload.citations),
      keywords_json: payload.keywords?.length ? JSON.stringify(payload.keywords) : null,
      model_name: modelName,
      trigger_type: input.trigger_type ?? 'manual',
    });

    return { payload, record, modelName, sourceHash, language };
  }

  mirrorLegacyTagDigest(input: {
    tag_id: string;
    period: 'latest' | 'week';
    time_range_key: string;
    language: string;
    source_count: number;
    source_hash: string;
    summary: string;
    keywords: string[];
    model_name: string;
    trigger_type: 'auto' | 'manual';
  }) {
    getDatabase().prepare(`
      INSERT INTO digest_tag_summaries (
        id, tag_id, period, time_range_key, language, source_count, source_hash,
        summary, keywords_json, model_name, trigger_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `${input.tag_id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      input.tag_id,
      input.period,
      input.time_range_key,
      input.language,
      input.source_count,
      input.source_hash,
      input.summary,
      JSON.stringify(input.keywords || []),
      input.model_name,
      input.trigger_type,
      new Date().toISOString(),
    );
  }
}

export const aggregateDigestService = new AggregateDigestService();

export function parseAggregateDigestRecord<T = AggregateDigestCitation[]>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
