import { useFeedStore } from '../stores/feedStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useNotification } from '../composables/useNotification'
import type { Entry } from '../types'

export function useFeedActions() {
    const store = useFeedStore()
    const favoritesStore = useFavoritesStore()
    const { showNotification } = useNotification()

    async function handleToggleStar(entry: Entry | null, showFavoritesOnly: boolean, afterActionCallback?: () => Promise<void>) {
        if (!entry) return

        try {
            const entryId = entry.id
            const willBeStarred = !entry.starred

            if (willBeStarred) {
                await favoritesStore.starEntry(entryId)
                showNotification('已添加到收藏', 'success')
            } else {
                await favoritesStore.unstarEntry(entryId)
                showNotification('已从收藏中移除', 'success')
            }

            // Update store state
            await store.toggleEntryState(entry, { starred: willBeStarred })

            // Reload favorites if in favorites mode
            if (showFavoritesOnly && afterActionCallback) {
                await afterActionCallback()
            }
        } catch (error) {
            console.error('Failed to toggle star:', error)
            showNotification('操作失败，请重试', 'error')
        }
    }

    return {
        handleToggleStar
    }
}
