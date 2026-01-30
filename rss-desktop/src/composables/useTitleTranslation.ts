import { computed, ref, watch } from 'vue'
import { useFeedStore } from '../stores/feedStore'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { clampAutoTitleTranslationLimit } from '../constants/translation'
import type { Entry } from '../types'

type TitleTranslationResult = { title: string; language: string }
type TranslationTask = { entryId: string; language: string }
type TitleTranslationAutoRetryHandler = (entryId: string, language: string) => void

/**
 * Composable for managing title translation with concurrency control
 */
export function useTitleTranslation() {
  const store = useFeedStore()
  const aiStore = useAIStore()
  const settingsStore = useSettingsStore()

  const TITLE_TRANSLATION_FAILURE_COOLDOWN_MS = 30_000

  const aiFeatures = computed(() => aiStore.config.features)

  const titleTranslationResults = ref<Record<string, string>>({})
  const titleTranslationLoadingMap = ref<Record<string, boolean>>({})
  const titleTranslationFailureMap = ref<Record<string, number>>({})
  const inFlightPromises = new Map<string, Promise<TitleTranslationResult>>()
  const autoRetryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let autoRetryHandler: TitleTranslationAutoRetryHandler | null = null
  const autoTranslationQueue: TranslationTask[] = []
  const queuedKeys = new Set<string>()
  let activeAutoTasks = 0

  const titleTranslationLanguageLabel = computed(() =>
    (aiFeatures.value?.translation_language || '').toUpperCase()
  )

  const maxAutoTitleTranslations = computed(() =>
    clampAutoTitleTranslationLimit(settingsStore.settings.max_auto_title_translations)
  )

  function getFailureTimestamp(cacheKey: string): number | null {
    return titleTranslationFailureMap.value[cacheKey] ?? null
  }

  function isInFailureCooldown(cacheKey: string): boolean {
    const failedAt = getFailureTimestamp(cacheKey)
    if (!failedAt) {
      return false
    }
    return Date.now() - failedAt < TITLE_TRANSLATION_FAILURE_COOLDOWN_MS
  }

  function scheduleAutoRetry(cacheKey: string, entryId: string, language: string) {
    const existingTimer = autoRetryTimers.get(cacheKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    const timer = setTimeout(() => {
      autoRetryTimers.delete(cacheKey)
      if (!autoRetryHandler) {
        return
      }
      if (titleTranslationResults.value[cacheKey] !== undefined) {
        return
      }
      if (inFlightPromises.has(cacheKey)) {
        return
      }
      autoRetryHandler(entryId, language)
    }, TITLE_TRANSLATION_FAILURE_COOLDOWN_MS)
    autoRetryTimers.set(cacheKey, timer)
  }

  function recordFailure(cacheKey: string, entryId: string, language: string) {
    titleTranslationFailureMap.value[cacheKey] = Date.now()
    scheduleAutoRetry(cacheKey, entryId, language)
  }

  function clearFailure(cacheKey: string) {
    if (titleTranslationFailureMap.value[cacheKey]) {
      delete titleTranslationFailureMap.value[cacheKey]
    }
    const timer = autoRetryTimers.get(cacheKey)
    if (timer) {
      clearTimeout(timer)
      autoRetryTimers.delete(cacheKey)
    }
  }

  function registerAutoRetryHandler(handler: TitleTranslationAutoRetryHandler | null) {
    autoRetryHandler = handler
    return () => {
      if (autoRetryHandler === handler) {
        autoRetryHandler = null
      }
    }
  }

  function clearTitleTranslationCacheForLanguage(language?: string | null) {
    if (!language) {
      return
    }
    const suffix = `_${language}_title`
    const results = titleTranslationResults.value
    Object.keys(results).forEach((key) => {
      if (key.endsWith(suffix)) {
        delete results[key]
      }
    })
    const loading = titleTranslationLoadingMap.value
    Object.keys(loading).forEach((key) => {
      if (key.endsWith(suffix)) {
        delete loading[key]
      }
    })
    const failures = titleTranslationFailureMap.value
    Object.keys(failures).forEach((key) => {
      if (key.endsWith(suffix)) {
        delete failures[key]
      }
    })
    autoRetryTimers.forEach((timer, key) => {
      if (key.endsWith(suffix)) {
        clearTimeout(timer)
        autoRetryTimers.delete(key)
      }
    })
  }

  watch(
    () => aiFeatures.value?.translation_language || 'zh',
    (newLanguage, oldLanguage) => {
      if (newLanguage === oldLanguage) {
        return
      }
      clearTitleTranslationCacheForLanguage(oldLanguage)
    }
  )

  /**
   * Get cache key for title translation
   */
  function getTitleTranslationCacheKey(entryId: string, language: string): string {
    return `${entryId}_${language}_title`
  }

  /**
   * Get translated title from cache
   */
  function getTranslatedTitle(entryId: string, language?: string): string | null {
    const currentLanguage = language || aiFeatures.value?.translation_language || 'zh'
    const cacheKey = getTitleTranslationCacheKey(entryId, currentLanguage)
    return titleTranslationResults.value[cacheKey] ?? null
  }

  /**
   * Check if title translation is loading
   */
  function isTitleTranslationLoading(entryId: string, language?: string): boolean {
    const currentLanguage = language || aiFeatures.value?.translation_language || 'zh'
    const cacheKey = getTitleTranslationCacheKey(entryId, currentLanguage)
    return !!titleTranslationLoadingMap.value[cacheKey]
  }

  function isTitleTranslationFailed(entryId: string, language?: string): boolean {
    const currentLanguage = language || aiFeatures.value?.translation_language || 'zh'
    const cacheKey = getTitleTranslationCacheKey(entryId, currentLanguage)
    return !!titleTranslationFailureMap.value[cacheKey]
  }

  /**
   * Request title translation and update local state
   */
  async function requestTitleTranslation(entryId: string, language: string): Promise<TitleTranslationResult> {
    const cacheKey = getTitleTranslationCacheKey(entryId, language)
    const cachedTitle = titleTranslationResults.value[cacheKey]
    if (cachedTitle !== undefined) {
      clearFailure(cacheKey)
      if (titleTranslationLoadingMap.value[cacheKey]) {
        delete titleTranslationLoadingMap.value[cacheKey]
      }
      return { title: cachedTitle, language }
    }

    const existing = inFlightPromises.get(cacheKey)
    if (existing) {
      return existing
    }

    if (isInFailureCooldown(cacheKey)) {
      throw new Error('Title translation is in cooldown')
    }

    titleTranslationLoadingMap.value[cacheKey] = true
    const requestPromise = store.requestTitleTranslation(entryId, language)
      .then((result) => {
        titleTranslationResults.value[cacheKey] = result.title
        clearFailure(cacheKey)
        return result
      })
      .catch((error) => {
        recordFailure(cacheKey, entryId, language)
        throw error
      })
      .finally(() => {
        delete titleTranslationLoadingMap.value[cacheKey]
        inFlightPromises.delete(cacheKey)
      })

    inFlightPromises.set(cacheKey, requestPromise)
    return requestPromise
  }

  function enqueueAutoTranslation(entry: Entry, language: string) {
    if (!entry?.id || !entry.title) {
      return
    }
    const cacheKey = getTitleTranslationCacheKey(entry.id, language)
    if (isInFailureCooldown(cacheKey)) {
      return
    }
    if (titleTranslationResults.value[cacheKey] !== undefined) {
      return
    }
    if (inFlightPromises.has(cacheKey) || queuedKeys.has(cacheKey)) {
      return
    }
    queuedKeys.add(cacheKey)
    autoTranslationQueue.push({ entryId: entry.id, language })
    titleTranslationLoadingMap.value[cacheKey] = true
  }

  function clearQueuedLoading() {
    queuedKeys.forEach((cacheKey) => {
      if (!inFlightPromises.has(cacheKey)) {
        delete titleTranslationLoadingMap.value[cacheKey]
      }
    })
  }

  function processAutoQueue() {
    const limit = Math.max(1, maxAutoTitleTranslations.value || 1)
    while (activeAutoTasks < limit && autoTranslationQueue.length) {
      const task = autoTranslationQueue.shift()
      if (!task) {
        break
      }
      const cacheKey = getTitleTranslationCacheKey(task.entryId, task.language)
      queuedKeys.delete(cacheKey)
      activeAutoTasks += 1
      requestTitleTranslation(task.entryId, task.language)
        .catch((error) => {
          console.warn('Title translation failed:', error)
        })
        .finally(() => {
          activeAutoTasks = Math.max(0, activeAutoTasks - 1)
          processAutoQueue()
        })
    }
  }

  function queueAutoTitleTranslation(entry: Entry, languageOverride?: string) {
    const autoEnabled = !!aiFeatures.value?.auto_title_translation
    if (!autoEnabled) {
      return
    }
    const language = languageOverride || aiFeatures.value?.translation_language || 'zh'
    enqueueAutoTranslation(entry, language)
    processAutoQueue()
  }

  /**
   * Setup watcher for auto-translation settings and list changes
   */
  function setupAutoTranslationWatcher() {
    const stopSettingsWatch = watch(
      () => [
        aiFeatures.value?.translation_language || 'zh',
        aiFeatures.value?.auto_title_translation,
      ],
      ([, auto]) => {
        clearQueuedLoading()
        autoTranslationQueue.length = 0
        queuedKeys.clear()

        if (!auto) {
          return
        }
      },
      { immediate: true }
    )

    const stopLimitWatch = watch(
      () => maxAutoTitleTranslations.value,
      () => {
        processAutoQueue()
      }
    )

    return () => {
      stopSettingsWatch()
      stopLimitWatch()
    }
  }

  return {
    // Computed
    aiFeatures,
    titleTranslationLanguageLabel,
    maxAutoTitleTranslations,

    // Methods
    getTitleTranslationCacheKey,
    getTranslatedTitle,
    isTitleTranslationLoading,
    isTitleTranslationFailed,
    registerAutoRetryHandler,
    requestTitleTranslation,
    queueAutoTitleTranslation,
    setupAutoTranslationWatcher
  }
}
