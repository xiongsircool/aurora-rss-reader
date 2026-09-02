import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { useFeedStore } from '../stores/feedStore'
import { useTagsStore } from '../stores/tagsStore'
import { useArticleTranslation } from './useArticleTranslation'
import { useTitleTranslation } from './useTitleTranslation'
import { useAIAutomation } from './useAIAutomation'
import type { Entry } from '../types'

type NotifyType = 'success' | 'error' | 'info'

interface UseEntryAIOptions {
  notify: (message: string, type: NotifyType) => void
  t: (key: string, params?: Record<string, unknown>) => string
}

function getContentTextLength(html?: string | null): number {
  if (!html) return 0
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length
}

function selectTranslationContent(entry: Entry | null): string | null {
  if (!entry) return null
  const candidates = [
    { value: entry.readability_content, priority: 3 },
    { value: entry.content, priority: 2 },
    { value: entry.summary, priority: 1 },
  ]
  let best: { value: string; length: number; priority: number } | null = null
  for (const candidate of candidates) {
    if (!candidate.value) continue
    const length = getContentTextLength(candidate.value)
    if (!best || length > best.length || (length === best.length && candidate.priority > best.priority)) {
      best = { value: candidate.value, length, priority: candidate.priority }
    }
  }
  if (best && best.length > 0) return best.value
  return entry.readability_content ?? entry.content ?? entry.summary ?? null
}

export function useEntryAI(
  currentSelectedEntry: Ref<Entry | null>,
  { notify, t }: UseEntryAIOptions,
) {
  const store = useFeedStore()
  const tagsStore = useTagsStore()
  const { automationRevision, isEntryTaskEnabled } = useAIAutomation()
  const summaryText = ref('')
  const summaryLoading = ref(false)
  const translationLanguage = ref('')

  const lastVisibleEntries = ref<Entry[]>([])
  let summaryRequestVersion = 0

  const {
    aiFeatures,
    titleTranslationLanguageLabel,
    getTranslatedTitle,
    isTitleTranslationLoading,
    isTitleTranslationFailed,
    registerAutoRetryHandler,
    queueAutoTitleTranslation,
    requestTitleTranslation,
    setupAutoTranslationWatcher,
  } = useTitleTranslation()

  // Initialize from settings, but allow manual override
  watch(
    () => aiFeatures.value?.translation_language,
    (newLang) => {
      if (newLang && !translationLanguage.value) {
        translationLanguage.value = newLang
      }
    },
    { immediate: true },
  )

  const currentEntryId = computed(() => currentSelectedEntry.value?.id ?? null)
  const currentEntryContent = computed(() => selectTranslationContent(currentSelectedEntry.value))

  const {
    progress: fullTextTranslationProgress,
    blocks: fullTextTranslationBlocks,
    isTranslating: isFullTextTranslating,
    showTranslation: showFullTextTranslation,
    translatableBlocks: fullTextTranslatableBlocks,
    getTranslation: getFullTextTranslation,
    isBlockLoading: isFullTextBlockLoading,
    isBlockFailed: isFullTextBlockFailed,
    toggleTranslation: toggleFullTextTranslationRaw,
  } = useArticleTranslation(currentEntryId, currentEntryContent, translationLanguage)

  const translatedTitle = computed(() => {
    if (!currentSelectedEntry.value) return null
    return getTranslatedTitle(currentSelectedEntry.value.id, translationLanguage.value)
  })

  const cleanupTitleTranslationAutoRetry = registerAutoRetryHandler((entryId, language) => {
    const entry = lastVisibleEntries.value.find((item) => item.id === entryId)
    if (!entry) return
    if (!isEntryTaskEnabled('title_translation', entry)) return
    queueAutoTitleTranslation(entry, language)
  })

  const cleanupAutoTranslationWatcher = setupAutoTranslationWatcher()

  async function handleFullTextTranslation() {
    const wasShowing = showFullTextTranslation.value
    toggleFullTextTranslationRaw()
    if (!wasShowing && currentSelectedEntry.value) {
      await nextTick()
      if (fullTextTranslatableBlocks.value.length === 0) {
        notify(t('toast.translationNoText'), 'info')
      }
      try {
        await requestTitleTranslation(currentSelectedEntry.value.id, translationLanguage.value)
      } catch (error) {
        console.warn('Title translation failed:', error)
      }
    }
  }

  async function handleSummary() {
    if (!currentSelectedEntry.value) return
    const requestVersion = ++summaryRequestVersion
    const entryId = currentSelectedEntry.value.id
    const hadSummary = !!summaryText.value.trim()
    const previousSummary = summaryText.value
    summaryLoading.value = true
    if (hadSummary) {
      summaryText.value = ''
    }
    try {
      const summaryLanguage = aiFeatures.value?.translation_language || 'zh'
      const summary = await store.requestSummary(entryId, summaryLanguage, { force: hadSummary })
      if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === entryId) {
        summaryText.value = summary.summary
        notify(t('toast.summarySuccess'), 'success')
      }
    } catch {
      if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === entryId) {
        summaryText.value = previousSummary
        notify(t('toast.summaryFailed'), 'error')
      }
    } finally {
      if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === entryId) {
        summaryLoading.value = false
      }
    }
  }

  function handleEntriesVisible(entries: Entry[]) {
    lastVisibleEntries.value = entries
    entries.forEach((entry) => queueAutoTitleTranslation(entry))
  }

  watch(
    () => [automationRevision.value, aiFeatures.value?.translation_language],
    () => {
      if (!lastVisibleEntries.value.length) return
      lastVisibleEntries.value.forEach((entry) => queueAutoTitleTranslation(entry))
    },
  )

  watch(
    () => [currentSelectedEntry.value, automationRevision.value] as const,
    async (entry) => {
      const selectedEntry = entry[0]
      const requestVersion = ++summaryRequestVersion
      if (!selectedEntry) {
        summaryText.value = ''
        summaryLoading.value = false
        return
      }
      const cached = store.getCachedSummary(selectedEntry.id)
      summaryText.value = cached?.summary ?? ''
      if (isEntryTaskEnabled('entry_summary', selectedEntry) && !cached?.summary) {
        try {
          summaryLoading.value = true
          const summaryLanguage = aiFeatures.value?.translation_language || 'zh'
          const summary = await store.requestSummary(selectedEntry.id, summaryLanguage)
          if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === selectedEntry.id) {
            summaryText.value = summary.summary
          }
        } catch (error) {
          if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === selectedEntry.id) {
            console.error('Auto summary failed:', error)
          }
        } finally {
          if (requestVersion === summaryRequestVersion && currentSelectedEntry.value?.id === selectedEntry.id) {
            summaryLoading.value = false
          }
        }
      }
      if (!selectedEntry.read) {
        await store.toggleEntryState(selectedEntry, { read: true })
        tagsStore.updateEntryState(selectedEntry.id, { read: true })
      }
    },
    { immediate: true },
  )

  watch(
    () => translationLanguage.value,
    async (newLang, oldLang) => {
      if (newLang === oldLang || !currentSelectedEntry.value || !showFullTextTranslation.value) return
      try {
        await requestTitleTranslation(currentSelectedEntry.value.id, newLang)
      } catch (error) {
        console.warn('Title translation failed:', error)
      }
    },
  )

  function cleanup() {
    cleanupTitleTranslationAutoRetry()
    cleanupAutoTranslationWatcher()
  }

  return {
    aiFeatures,
    titleTranslationLanguageLabel,
    translatedTitle,
    translationLanguage,
    summaryText,
    summaryLoading,
    fullTextTranslationProgress,
    fullTextTranslationBlocks,
    isFullTextTranslating,
    showFullTextTranslation,
    getFullTextTranslation,
    isFullTextBlockLoading,
    isFullTextBlockFailed,
    getTranslatedTitle,
    isTitleTranslationLoading,
    isTitleTranslationFailed,
    handleEntriesVisible,
    handleFullTextTranslation,
    handleSummary,
    cleanup,
  }
}
