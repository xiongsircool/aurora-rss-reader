/**
 * On-device AI client. Port of `backend-node/src/services/ai.ts`, but instead
 * of the OpenAI SDK (Node-only) it POSTs directly to an OpenAI-compatible
 * /chat/completions endpoint via the platform HTTP layer — so summaries and
 * translation run on the device with no backend.
 *
 * Behavior preserved from the backend: <think> reasoning blocks are stripped,
 * the user's custom instruction is appended to the system prompt, output is
 * Markdown, and errors are surfaced with status codes.
 */
import { httpRequest, HttpError } from '../platform/http'

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const LANGUAGE_NAMES: Record<string, string> = {
  zh: '中文',
  'zh-CN': '中文',
  en: 'English',
  'en-US': 'English',
  ja: '日本語',
  'ja-JP': '日本語',
  ko: '한국어',
  'ko-KR': '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
}

function langDisplay(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

/** Strip <think>...</think> reasoning blocks some models emit. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim()
}

export function buildSummaryPrompt(language: string, userPreference?: string): string {
  let prompt = `你是一个专业的 RSS 阅读器助手。你会收到一段文章文本，其中开头部分可能包含标题、作者、时间等元信息，之后是正文内容。请用 ${langDisplay(language)} 输出全面而精炼的摘要。

输出要求：
1. 使用 Markdown 输出，允许使用短标题、无序列表、强调、引用和表格。
2. 不要输出 HTML。
3. 如果原文包含公式或推导，请使用 LaTeX 公式语法：行内公式用 $...$，块级公式用 $$...$$。
4. 先给出一句总览，再用 3-6 个高信息密度要点展开。
5. 抓住文章的核心观点、关键论据、重要细节和支撑数据。
6. 保持逻辑清晰，减少空话和重复，不要写"总之""综上所述"这类收尾套话。
7. 控制长度在合理范围内，确保信息密度。`
  const pref = userPreference?.trim()
  if (pref) prompt += `\n\n用户额外要求：${pref}`
  return prompt
}

export function buildTranslatePrompt(targetLanguage: string, userPreference?: string): string {
  let prompt = `你是专业翻译助手。请将以下文本翻译为${langDisplay(targetLanguage)}，保持 Markdown 格式和 HTML 标签不变，只翻译文本内容。`
  const pref = userPreference?.trim()
  if (pref) prompt += `\n\n用户额外要求：${pref}`
  return prompt
}

export class AiClient {
  private config: AiConfig

  constructor(config: AiConfig) {
    this.config = config
  }

  get isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.apiKey && this.config.model)
  }

  private endpoint(): string {
    const base = this.config.baseUrl.replace(/\/$/, '')
    return `${base}/chat/completions`
  }

  async chat(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
    if (!this.config.apiKey) throw new Error('API Key 未配置')
    if (!this.config.baseUrl) throw new Error('API Base URL 未配置')
    if (!this.config.model) throw new Error('Model 未配置')

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? 0.3,
    }
    // Only send max_tokens when a positive cap is requested (0 = unlimited).
    if (options.maxTokens && options.maxTokens > 0) body.max_tokens = options.maxTokens

    try {
      const res = await httpRequest({
        url: this.endpoint(),
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        json: body,
        timeoutMs: 90_000,
      })
      const parsed = JSON.parse(res.text) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = parsed.choices?.[0]?.message?.content ?? ''
      return stripThink(content)
    } catch (err) {
      if (err instanceof HttpError) throw new Error(`AI API 错误 (${err.status})`)
      throw err
    }
  }

  async summarize(content: string, options: { language?: string; userPreference?: string } = {}): Promise<string> {
    const language = options.language || 'zh'
    const maxInputLength = 8000
    const clipped = content.length > maxInputLength ? `${content.slice(0, maxInputLength)}...` : content
    return this.chat([
      { role: 'system', content: buildSummaryPrompt(language, options.userPreference) },
      { role: 'user', content: clipped },
    ])
  }

  async translate(text: string, options: { targetLanguage?: string; userPreference?: string } = {}): Promise<string> {
    const targetLanguage = options.targetLanguage || 'zh'
    return this.chat(
      [
        { role: 'system', content: buildTranslatePrompt(targetLanguage, options.userPreference) },
        { role: 'user', content: text },
      ],
      { maxTokens: 2048 },
    )
  }
}

/**
 * Build the model input from an entry: prepend lightweight metadata (title,
 * author, time) to the body, matching the backend's buildSummaryContent.
 */
export function buildEntryContent(entry: {
  title?: string | null
  author?: string | null
  published_at?: string | null
  readability_content?: string | null
  content?: string | null
  summary?: string | null
}): string | null {
  const content = entry.readability_content || entry.content || entry.summary
  if (!content) return null

  const metaLines: string[] = []
  if (entry.title) metaLines.push(`Title: ${entry.title}`)
  if (entry.author) metaLines.push(`Author: ${entry.author}`)
  if (entry.published_at) metaLines.push(`Date: ${entry.published_at}`)

  if (!metaLines.length) return content
  return `Metadata:\n${metaLines.join('\n')}\n\nContent:\n${content}`
}
