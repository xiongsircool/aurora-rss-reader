import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRepositories } from '../data/repositories'
import { AiClient, buildEntryContent } from '../domain/aiClient'
import { useSettingsStore } from './settingsStore'
import type { EntryRow } from '../data/models'

interface AiState {
  summary: string | null
  translation: string | null
  summaryLoading: boolean
  translationLoading: boolean
  error: string | null
}

function emptyState(): AiState {
  return { summary: null, translation: null, summaryLoading: false, translationLoading: false, error: null }
}

export const useAiStore = defineStore('ai', () => {
  // State is keyed by entry id so navigating between articles never shows one
  // entry's summary on another (guards against the desktop cross-page bug).
  const byEntry = ref<Record<string, AiState>>({})

  function state(entryId: string): AiState {
    if (!byEntry.value[entryId]) byEntry.value[entryId] = emptyState()
    return byEntry.value[entryId]
  }

  async function client(): Promise<AiClient> {
    const settings = useSettingsStore()
    if (!settings.loaded) await settings.load()
    return new AiClient({
      baseUrl: settings.ai.base_url,
      apiKey: settings.ai.api_key,
      model: settings.ai.model,
    })
  }

  /** Load any cached summary/translation for an entry (no network). */
  async function loadCached(entryId: string, language: string) {
    const s = state(entryId)
    const repos = await getRepositories()
    const [summary, translation] = await Promise.all([
      repos.summaries.get(entryId, language),
      repos.translations.get(entryId, language),
    ])
    s.summary = summary?.content ?? null
    s.translation = translation?.content ?? null
  }

  /**
   * Generate (or regenerate) a summary for an entry. `force` bypasses the cache
   * so the reader's "regenerate" action actually re-runs the model.
   */
  async function summarize(entry: EntryRow, options: { force?: boolean } = {}) {
    const settings = useSettingsStore()
    if (!settings.loaded) await settings.load()
    const language = settings.ai.language || 'zh-CN'
    const s = state(entry.id)
    s.error = null

    const repos = await getRepositories()
    if (!options.force) {
      const cached = await repos.summaries.get(entry.id, language)
      if (cached) {
        s.summary = cached.content
        return
      }
    }

    const ai = await client()
    if (!ai.isConfigured) {
      s.error = 'AI 未配置：请在设置中填写 API 地址与密钥'
      return
    }

    const content = buildEntryContent(entry)
    if (!content) {
      s.error = '没有可用于摘要的正文内容'
      return
    }

    s.summaryLoading = true
    try {
      const result = await ai.summarize(content, { language, userPreference: settings.ai.prompt })
      s.summary = result
      await repos.summaries.upsert(entry.id, language, result, settings.ai.model)
    } catch (err) {
      s.error = err instanceof Error ? err.message : String(err)
    } finally {
      s.summaryLoading = false
    }
  }

  /** Translate an entry's body into the configured language; cached per entry. */
  async function translate(entry: EntryRow, options: { force?: boolean } = {}) {
    const settings = useSettingsStore()
    if (!settings.loaded) await settings.load()
    const language = settings.ai.language || 'zh-CN'
    const s = state(entry.id)
    s.error = null

    const repos = await getRepositories()
    if (!options.force) {
      const cached = await repos.translations.get(entry.id, language)
      if (cached?.content) {
        s.translation = cached.content
        return
      }
    }

    const ai = await client()
    if (!ai.isConfigured) {
      s.error = 'AI 未配置：请在设置中填写 API 地址与密钥'
      return
    }

    const source = entry.readability_content || entry.content || entry.summary
    if (!source) {
      s.error = '没有可翻译的内容'
      return
    }

    s.translationLoading = true
    try {
      const result = await ai.translate(source, { targetLanguage: language, userPreference: settings.ai.prompt })
      s.translation = result
      await repos.translations.upsert(entry.id, language, { content: result }, settings.ai.model)
    } catch (err) {
      s.error = err instanceof Error ? err.message : String(err)
    } finally {
      s.translationLoading = false
    }
  }

  return { byEntry, state, loadCached, summarize, translate }
})
