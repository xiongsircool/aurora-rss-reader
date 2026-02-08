import { ref } from 'vue'
import type { Feed } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const FEED_ICON_COLORS = [
    '#FF8A3D',
    '#2EC4B6',
    '#8E6CFF',
    '#34C759',
    '#FF6B6B',
    '#4D9DE0',
    '#FFB5A7',
    '#6B705C'
]

/**
 * Composable for managing feed icons loading, error handling, and color generation
 */
export function useFeedIcons() {
    const brokenFeedIcons = ref<Record<string, boolean>>({})
    const loadedIconUrls = ref<Record<string, boolean>>({})

    /**
     * Generate the icon proxy URL for a feed
     */
    function iconSrcFor(url?: string | null): string | undefined {
        if (!url) return undefined
        return `${API_BASE}/icons/proxy?url=${encodeURIComponent(url)}`
    }

    /**
     * Handle successful icon load
     */
    function handleFeedIconLoad(_feedId: string, url?: string | null) {
        if (!url) return
        loadedIconUrls.value = { ...loadedIconUrls.value, [url]: true }
    }

    /**
     * Handle icon load error
     */
    function handleFeedIconError(feedId: string, failedUrl?: string | null) {
        brokenFeedIcons.value = {
            ...brokenFeedIcons.value,
            [feedId]: true
        }
        if (failedUrl) {
            const { [failedUrl]: _omit, ...rest } = loadedIconUrls.value
            loadedIconUrls.value = rest
        }
    }

    /**
     * Check if a feed's icon is broken
     */
    function isFeedIconBroken(feed?: Feed | null): boolean {
        if (!feed?.favicon_url) return true
        return !!brokenFeedIcons.value[feed.id]
    }

    /**
     * Check if an icon URL has been loaded
     */
    function isFeedIconLoaded(url?: string | null): boolean {
        if (!url) return false
        return !!loadedIconUrls.value[url]
    }

    /**
     * Generate a consistent color for a feed based on its ID
     */
    function getFeedColor(feedId: string): string {
        if (!feedId) return FEED_ICON_COLORS[0]
        let hash = 0
        for (let i = 0; i < feedId.length; i += 1) {
            hash = (hash * 31 + feedId.charCodeAt(i)) >>> 0
        }
        return FEED_ICON_COLORS[hash % FEED_ICON_COLORS.length]
    }

    /**
     * Get the initial letters for a feed icon fallback
     * @param title Feed title or URL
     * @returns 1-2 character abbreviation
     */
    function getFeedInitial(title: string): string {
        if (!title) return '?'

        // Remove common prefixes
        const cleaned = title
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .trim()

        if (!cleaned) return '?'

        // Chinese: take first two characters
        if (/[\u4e00-\u9fa5]/.test(cleaned)) {
            const chineseChars = cleaned.match(/[\u4e00-\u9fa5]/g)
            if (chineseChars && chineseChars.length >= 2) {
                return chineseChars.slice(0, 2).join('')
            }
            if (chineseChars && chineseChars.length === 1) {
                return chineseChars[0]
            }
        }

        // English: take first letters
        const words = cleaned.split(/[\s\-_\.]+/).filter(w => w.length > 0)
        if (words.length >= 2) {
            // Multiple words: take first letter of first two words
            return (words[0][0] + words[1][0]).toUpperCase()
        }
        if (words.length === 1 && words[0].length >= 2) {
            // Single word: take first two letters
            return words[0].substring(0, 2).toUpperCase()
        }

        // Fallback: first character
        return cleaned[0].toUpperCase()
    }

    return {
        brokenFeedIcons,
        loadedIconUrls,
        iconSrcFor,
        handleFeedIconLoad,
        handleFeedIconError,
        isFeedIconBroken,
        isFeedIconLoaded,
        getFeedColor,
        getFeedInitial,
        FEED_ICON_COLORS
    }
}
