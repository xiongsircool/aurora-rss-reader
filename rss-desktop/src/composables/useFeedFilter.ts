import { ref, computed, watch } from 'vue'
import { useFeedStore } from '../stores/feedStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { getTimeRangeText } from '../utils/date'

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }
}

export function useFeedFilter() {
    const store = useFeedStore()
    const favoritesStore = useFavoritesStore()
    const settingsStore = useSettingsStore()

    // State
    const searchQuery = ref('')
    const filterMode = ref<'all' | 'unread' | 'starred'>('all')
    const dateRangeFilter = ref('30d')
    const filterLoading = ref(false)
    const showFavoritesOnly = ref(false)
    const selectedFavoriteFeed = ref<string | null>(null)
    const lastActiveFeedId = ref<string | null>(null)

    // Computed
    const isDateFilterActive = computed(
        () => settingsStore.settings.enable_date_filter && dateRangeFilter.value !== 'all'
    )

    const timeFilterLabel = computed(() =>
        (isDateFilterActive.value ? getTimeRangeText(dateRangeFilter.value) : '')
    )

    const currentEntries = computed(() =>
        (showFavoritesOnly.value ? favoritesStore.starredEntries : store.entries)
    )

    const filteredEntries = computed(() => {
        let result = currentEntries.value

        if (showFavoritesOnly.value) {
            if (filterMode.value === 'unread') {
                result = result.filter((entry) => !entry.read)
            }
            // In favorites mode, all entries are starred implicitly or we are just viewing starred items.
            // If explicit starred filter is needed within favorites, logic could be added, 
            // but usually favorites view IS the starred view.
        } else {
            // Subscription view context
            if (filterMode.value === 'unread') {
                result = result.filter((entry) => !entry.read)
            } else if (filterMode.value === 'starred') {
                result = result.filter((entry) => entry.starred)
            }
        }

        // Filter by specific feed in Favorites mode
        if (showFavoritesOnly.value && selectedFavoriteFeed.value) {
            result = result.filter((entry) => entry.feed_id === selectedFavoriteFeed.value)
        }

        // Apply search query
        if (searchQuery.value.trim()) {
            const query = searchQuery.value.toLowerCase()
            result = result.filter(
                (entry) =>
                    entry.title?.toLowerCase().includes(query) ||
                    entry.summary?.toLowerCase().includes(query) ||
                    entry.content?.toLowerCase().includes(query) ||
                    entry.feed_title?.toLowerCase().includes(query)
            )
        }

        return result
    })

    // Actions
    async function applyFilters(options: { refreshFeeds?: boolean } = {}) {
        const filterDateRange = settingsStore.settings.enable_date_filter ? dateRangeFilter.value : undefined
        const filterTimeField = settingsStore.settings.time_field

        const promises: Promise<unknown>[] = []

        if (options.refreshFeeds) {
            promises.push(
                store.fetchFeeds({
                    dateRange: filterDateRange,
                    timeField: filterTimeField
                })
            )
        }

        if (showFavoritesOnly.value) {
            if (promises.length) {
                await Promise.all(promises)
            }
            return
        }

        // If no feed or group selected, regular filter logic
        if (!store.activeFeedId && !store.activeGroupName) {
            if (promises.length) {
                await Promise.all(promises)
            }
            return
        }

        filterLoading.value = true
        promises.push(
            store.fetchEntries({
                feedId: store.activeFeedId || undefined,
                groupName: store.activeGroupName || undefined,
                unreadOnly: filterMode.value === 'unread',
                dateRange: filterDateRange,
                timeField: filterTimeField
            })
        )

        try {
            await Promise.all(promises)
        } finally {
            filterLoading.value = false
        }
    }

    const debouncedApplyFilters = debounce(applyFilters, 300)

    // Watchers setup
    function setupFilterWatchers() {
        // Watch active feed/group changes
        watch(
            () => [store.activeFeedId, store.activeGroupName],
            async () => {
                if ((store.activeFeedId || store.activeGroupName) && !showFavoritesOnly.value) {
                    await applyFilters()
                }
            }
        )

        // Watch filter mode
        watch(filterMode, () => {
            debouncedApplyFilters()
        })

        // Watch date range
        watch(dateRangeFilter, () => {
            debouncedApplyFilters({ refreshFeeds: true })
        })

        // Watch time field setting
        watch(
            () => settingsStore.settings.time_field,
            () => {
                debouncedApplyFilters({ refreshFeeds: true })
            }
        )
    }

    // Helper to switch to Favorites mode
    async function selectFavoriteFeed(feedId: string | null, loadFavoritesData: (opts: any) => Promise<void>) {
        if (!showFavoritesOnly.value) {
            lastActiveFeedId.value = store.activeFeedId
        }
        selectedFavoriteFeed.value = feedId
        showFavoritesOnly.value = true
        filterMode.value = 'starred' // Auto-set filter mode for UI consistency if needed
        await loadFavoritesData({ includeEntries: true, feedId })
    }

    function backToAllFeeds(selectedFavoriteEntryId: { value: string | null }) {
        showFavoritesOnly.value = false
        selectedFavoriteFeed.value = null
        selectedFavoriteEntryId.value = null
        filterMode.value = 'all'

        if (lastActiveFeedId.value) {
            store.selectFeed(lastActiveFeedId.value)
        }
    }

    return {
        // State
        searchQuery,
        filterMode,
        dateRangeFilter,
        filterLoading,
        showFavoritesOnly,
        selectedFavoriteFeed,
        lastActiveFeedId,

        // Computed
        filteredEntries,
        isDateFilterActive,
        timeFilterLabel,

        // Methods
        applyFilters,
        debouncedApplyFilters,
        setupFilterWatchers,
        selectFavoriteFeed,
        backToAllFeeds
    }
}
