import { ref, computed, watch } from 'vue'
import { useFeedStore } from '../stores/feedStore'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
    clampAutoTitleTranslationLimit,
    getRecommendedTitleTranslationConcurrency,
    TITLE_TRANSLATION_CONCURRENCY_FALLBACK
} from '../constants/translation'
import type { NavigatorConnection } from '../constants/translation'
import type { Entry } from '../types'

/**
 * Composable for managing title translation with concurrency control
 */
export function useTitleTranslation() {
    const store = useFeedStore()
    const aiStore = useAIStore()
    const settingsStore = useSettingsStore()

    const aiFeatures = computed(() => aiStore.config.features)

    const titleTranslationLoadingMap = ref<Record<string, boolean>>({})
    const titleTranslationConcurrency = ref(getRecommendedTitleTranslationConcurrency())
    const titleTranslationQueue: Array<() => void> = []
    let activeTitleTranslationTasks = 0
    let detachConnectionListener: (() => void) | null = null

    const titleTranslationLanguageLabel = computed(() =>
        (aiFeatures.value?.translation_language || '').toUpperCase()
    )

    const maxAutoTitleTranslations = computed(() =>
        clampAutoTitleTranslationLimit(settingsStore.settings.max_auto_title_translations)
    )

    /**
     * Bind network connection listener to adjust concurrency
     */
    function bindConnectionListener() {
        if (typeof navigator === 'undefined') return
        const nav = navigator as Navigator & {
            connection?: NavigatorConnection
        }
        const connection = nav.connection
        if (!connection) return
        const handler = () => {
            titleTranslationConcurrency.value = getRecommendedTitleTranslationConcurrency()
        }
        if (connection.addEventListener) {
            connection.addEventListener('change', handler)
            detachConnectionListener = () => connection.removeEventListener?.('change', handler)
            return
        }
        if ('onchange' in connection) {
            const previous = connection.onchange
            const wrapper = function (this: NavigatorConnection, event: Event) {
                handler()
                previous?.call(this, event)
            }
            connection.onchange = wrapper
            detachConnectionListener = () => {
                if (connection.onchange === wrapper) {
                    connection.onchange = previous ?? null
                }
            }
        }
    }

    /**
     * Cleanup network connection listener
     */
    function cleanupConnectionListener() {
        detachConnectionListener?.()
        detachConnectionListener = null
    }

    function releaseTitleTranslationSlot() {
        activeTitleTranslationTasks = Math.max(0, activeTitleTranslationTasks - 1)
        const next = titleTranslationQueue.shift()
        if (next) {
            next()
        }
    }

    async function acquireTitleTranslationSlot() {
        const limit = Math.max(1, titleTranslationConcurrency.value || TITLE_TRANSLATION_CONCURRENCY_FALLBACK)
        while (activeTitleTranslationTasks >= limit) {
            await new Promise<void>((resolve) => {
                titleTranslationQueue.push(resolve)
            })
        }
        activeTitleTranslationTasks++
    }

    async function withTitleTranslationSemaphore<T>(task: () => Promise<T>): Promise<T> {
        await acquireTitleTranslationSlot()
        try {
            return await task()
        } finally {
            releaseTitleTranslationSlot()
        }
    }

    /**
     * Get cache key for title translation
     */
    function getTitleTranslationCacheKey(entryId: string): string {
        const language = aiFeatures.value?.translation_language || 'zh'
        return `${entryId}_${language}_title`
    }

    /**
     * Get translated title from cache
     */
    function getTranslatedTitle(entryId: string): string | null {
        const cacheKey = getTitleTranslationCacheKey(entryId)
        return store.titleTranslationCache[cacheKey]?.title ?? null
    }

    /**
     * Check if title translation is loading
     */
    function isTitleTranslationLoading(entryId: string): boolean {
        const cacheKey = getTitleTranslationCacheKey(entryId)
        return !!titleTranslationLoadingMap.value[cacheKey]
    }

    /**
     * Ensure title translation is available for an entry
     */
    async function ensureTitleTranslation(entry: Entry) {
        if (!aiFeatures.value?.auto_title_translation || !entry?.id || !entry.title) {
            return
        }
        const cacheKey = getTitleTranslationCacheKey(entry.id)
        if (store.titleTranslationCache[cacheKey] || titleTranslationLoadingMap.value[cacheKey]) {
            return
        }
        titleTranslationLoadingMap.value[cacheKey] = true
        try {
            await withTitleTranslationSemaphore(() =>
                store.requestTitleTranslation(entry.id, aiFeatures.value?.translation_language || 'zh')
            )
        } catch (error) {
            console.error('Title translation failed:', error)
        } finally {
            delete titleTranslationLoadingMap.value[cacheKey]
        }
    }

    /**
     * Setup watcher for auto-translating visible entries
     */
    function setupAutoTranslationWatcher(getEntries: () => Entry[]) {
        return watch(
            () => ({
                entries: getEntries(),
                language: aiFeatures.value?.translation_language,
                auto: aiFeatures.value?.auto_title_translation,
                concurrency: maxAutoTitleTranslations.value
            }),
            ({ entries, auto, concurrency }) => {
                if (!auto) {
                    titleTranslationLoadingMap.value = {}
                    return
                }

                const entriesToTranslate = (entries || []).filter((entry: Entry) => {
                    const cacheKey = getTitleTranslationCacheKey(entry.id)
                    return !store.titleTranslationCache[cacheKey] && !titleTranslationLoadingMap.value[cacheKey]
                }) as Entry[]

                const limitedEntries = entriesToTranslate.slice(0, concurrency)
                limitedEntries.forEach((entry) => {
                    ensureTitleTranslation(entry)
                })
            },
            { immediate: true }
        )
    }

    return {
        // State
        titleTranslationLoadingMap,
        titleTranslationConcurrency,

        // Computed
        aiFeatures,
        titleTranslationLanguageLabel,
        maxAutoTitleTranslations,

        // Methods
        bindConnectionListener,
        cleanupConnectionListener,
        getTitleTranslationCacheKey,
        getTranslatedTitle,
        isTitleTranslationLoading,
        ensureTitleTranslation,
        setupAutoTranslationWatcher
    }
}
