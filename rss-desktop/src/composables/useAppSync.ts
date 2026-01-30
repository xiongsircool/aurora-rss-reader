import { ref } from 'vue'
import { useFeedStore } from '../stores/feedStore'
import { useSettingsStore } from '../stores/settingsStore'

export function useAppSync(
    showFavoritesOnly: { value: boolean },
    loadFavoritesData: () => Promise<void>,
    dateRangeFilter: { value: string }
) {
    const store = useFeedStore()
    const settingsStore = useSettingsStore()

    // Background sync timer
    const backgroundSyncTimer = ref<number | null>(null)

    function syncFeedsCounts() {
        const filterDateRange = settingsStore.settings.enable_date_filter ? dateRangeFilter.value : undefined
        const filterTimeField = settingsStore.settings.time_field
        if (store.loadingFeeds) return Promise.resolve()
        return store.fetchFeeds({ dateRange: filterDateRange, timeField: filterTimeField })
    }

    function handleWindowFocus() {
        if (showFavoritesOnly.value) {
            loadFavoritesData()
        } else {
            syncFeedsCounts()
        }
    }

    function startBackgroundSync() {
        if (backgroundSyncTimer.value) {
            window.clearInterval(backgroundSyncTimer.value)
            backgroundSyncTimer.value = null
        }
        // Sync every 3s when visible, 6s when hidden
        // Only syncing counts (lightweight)
        const intervalMs = document.hidden ? 6000 : 3000
        backgroundSyncTimer.value = window.setInterval(() => {
            if (showFavoritesOnly.value) {
                loadFavoritesData()
            } else {
                syncFeedsCounts()
            }
        }, intervalMs)
    }

    function handleVisibilityChange() {
        startBackgroundSync()
        if (!document.hidden) {
            handleWindowFocus()
        }
    }

    function initSync() {
        startBackgroundSync()
        window.addEventListener('focus', handleWindowFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    function cleanupSync() {
        if (backgroundSyncTimer.value) {
            window.clearInterval(backgroundSyncTimer.value)
            backgroundSyncTimer.value = null
        }
        window.removeEventListener('focus', handleWindowFocus)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    return {
        initSync,
        cleanupSync,
        // Expose internally used functions if needed, mainly for testing
        syncFeedsCounts,
        handleWindowFocus
    }
}
