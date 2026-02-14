/**
 * Tags Store
 * Manages smart tagging state for the workspace
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TagMatchRule {
    keywords: string[]
    operator: 'AND' | 'OR'
    exclude: string[]
}

export interface UserTag {
    id: string
    name: string
    description: string | null
    color: string
    sort_order: number
    enabled: number
    match_mode: 'ai' | 'rule' | 'both'
    match_rules: string | null // JSON: TagMatchRule[]
    created_at: string
    updated_at: string
    entry_count?: number
}

export interface TagEntry {
    id: string
    feed_id: string
    title: string
    url: string
    summary: string | null
    content: string | null
    published_at: string | null
    inserted_at: string
    is_read: number
    is_starred: number
    feed_title?: string
    tags?: UserTag[]
}

export interface AnalysisStats {
    pending: number
    analyzed: number
    skipped: number
    withTags: number
    withoutTags: number
}

export interface RerunSummary {
    total: number
    success: number
    tagged: number
    untagged: number
}

export interface TagConfig {
    apiKey: string
    baseUrl: string
    modelName: string
    autoTagging: boolean
    tagsVersion: number
    hasApiKey: boolean
}

export const useTagsStore = defineStore('tags', () => {
    // State
    const tags = ref<UserTag[]>([])
    const selectedTagId = ref<string | null>(null)
    const selectedView = ref<'tag' | 'pending' | 'untagged'>('pending')
    const entries = ref<TagEntry[]>([])
    const stats = ref<AnalysisStats>({ pending: 0, analyzed: 0, skipped: 0, withTags: 0, withoutTags: 0 })
    const config = ref<TagConfig | null>(null)
    const loading = ref(false)
    const analyzing = ref(false)
    const cursor = ref<string | null>(null)
    const hasMore = ref(false)

    // Computed
    const selectedTag = computed(() =>
        selectedTagId.value ? tags.value.find(t => t.id === selectedTagId.value) : null
    )

    const enabledTags = computed(() =>
        tags.value.filter(t => t.enabled === 1)
    )

    // API Base URL
    const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

    // Actions
    async function fetchTags() {
        try {
            const res = await fetch(`${API_BASE}/tags`)
            const data = await res.json()
            tags.value = data.items || []
        } catch (error) {
            console.error('Failed to fetch tags:', error)
        }
    }

    async function createTag(input: {
        name: string
        description?: string
        color?: string
        match_mode?: 'ai' | 'rule' | 'both'
        match_rules?: TagMatchRule[]
    }) {
        try {
            const res = await fetch(`${API_BASE}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || '创建标签失败')
            }
            const data = await res.json()
            await fetchTags()
            return data.item
        } catch (error) {
            console.error('Failed to create tag:', error)
            throw error
        }
    }

    async function updateTag(id: string, input: {
        name?: string
        description?: string
        color?: string
        enabled?: boolean
        match_mode?: 'ai' | 'rule' | 'both'
        match_rules?: TagMatchRule[]
    }) {
        try {
            const res = await fetch(`${API_BASE}/tags/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || '更新标签失败')
            }
            await fetchTags()
        } catch (error) {
            console.error('Failed to update tag:', error)
            throw error
        }
    }

    async function deleteTag(id: string) {
        try {
            await fetch(`${API_BASE}/tags/${id}`, { method: 'DELETE' })
            await fetchTags()
            if (selectedTagId.value === id) {
                selectedTagId.value = null
                selectedView.value = 'pending'
            }
        } catch (error) {
            console.error('Failed to delete tag:', error)
            throw error
        }
    }

    async function fetchStats() {
        try {
            const res = await fetch(`${API_BASE}/ai/tags/stats`)
            stats.value = await res.json()
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    async function fetchPendingEntries(
        refresh = false,
        options: { dateRange?: string; timeField?: string } = {}
    ) {
        if (refresh) {
            cursor.value = null
            entries.value = []
        }
        loading.value = true
        try {
            const params = new URLSearchParams({ limit: '50' })
            if (cursor.value) params.append('cursor', cursor.value)
            if (options.dateRange && options.dateRange !== 'all') {
                params.append('date_range', options.dateRange)
            }
            if (options.timeField) {
                params.append('time_field', options.timeField)
            }

            const res = await fetch(`${API_BASE}/ai/tags/pending?${params}`)
            const data = await res.json()

            if (refresh) {
                entries.value = data.items || []
            } else {
                entries.value = [...entries.value, ...(data.items || [])]
            }
            cursor.value = data.nextCursor
            hasMore.value = data.hasMore
        } catch (error) {
            console.error('Failed to fetch pending entries:', error)
        } finally {
            loading.value = false
        }
    }

    async function fetchUntaggedEntries(
        refresh = false,
        options: { dateRange?: string; timeField?: string } = {}
    ) {
        if (refresh) {
            cursor.value = null
            entries.value = []
        }
        loading.value = true
        try {
            const params = new URLSearchParams({ limit: '50' })
            if (cursor.value) params.append('cursor', cursor.value)
            if (options.dateRange && options.dateRange !== 'all') {
                params.append('date_range', options.dateRange)
            }
            if (options.timeField) {
                params.append('time_field', options.timeField)
            }

            const res = await fetch(`${API_BASE}/ai/tags/untagged?${params}`)
            const data = await res.json()

            if (refresh) {
                entries.value = data.items || []
            } else {
                entries.value = [...entries.value, ...(data.items || [])]
            }
            cursor.value = data.nextCursor
            hasMore.value = data.hasMore
        } catch (error) {
            console.error('Failed to fetch untagged entries:', error)
        } finally {
            loading.value = false
        }
    }

    async function fetchEntriesByTag(
        tagId: string,
        refresh = false,
        options: { dateRange?: string; timeField?: string } = {}
    ) {
        if (refresh) {
            cursor.value = null
            entries.value = []
        }
        loading.value = true
        try {
            const params = new URLSearchParams({ limit: '50' })
            if (cursor.value) params.append('cursor', cursor.value)
            if (options.dateRange && options.dateRange !== 'all') {
                params.append('date_range', options.dateRange)
            }
            if (options.timeField) {
                params.append('time_field', options.timeField)
            }

            const res = await fetch(`${API_BASE}/tags/${tagId}/entries?${params}`)
            const data = await res.json()

            if (refresh) {
                entries.value = data.items || []
            } else {
                entries.value = [...entries.value, ...(data.items || [])]
            }
            cursor.value = data.nextCursor
            hasMore.value = data.hasMore
        } catch (error) {
            console.error('Failed to fetch entries by tag:', error)
        } finally {
            loading.value = false
        }
    }

    async function analyzeEntries(entryIds: string[]) {
        analyzing.value = true
        try {
            const res = await fetch(`${API_BASE}/ai/tags/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryIds }),
            })
            const data = await res.json()
            // Refresh data after analysis
            await fetchStats()
            await fetchTags()
            return data
        } catch (error) {
            console.error('Failed to analyze entries:', error)
            throw error
        } finally {
            analyzing.value = false
        }
    }

    async function rerunRange(input: {
        from: string
        to: string
        feedIds?: string[]
        mode?: 'missing' | 'all'
        cursor?: string | null
        limit?: number
    }): Promise<{ summary: RerunSummary; nextCursor: string | null; hasMore: boolean }> {
        const res = await fetch(`${API_BASE}/ai/tags/rerun-range`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        })
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || '范围重跑失败')
        }
        const data = await res.json()
        await fetchStats()
        await fetchTags()
        return {
            summary: data.summary,
            nextCursor: data.nextCursor ?? null,
            hasMore: data.hasMore ?? false,
        }
    }

    async function reanalyzeEntry(entryId: string) {
        try {
            const res = await fetch(`${API_BASE}/entries/${entryId}/tags/reanalyze`, {
                method: 'POST',
            })
            const data = await res.json()
            await fetchStats()
            return data
        } catch (error) {
            console.error('Failed to reanalyze entry:', error)
            throw error
        }
    }

    async function addTagToEntry(entryId: string, tagId: string) {
        try {
            await fetch(`${API_BASE}/entries/${entryId}/tags/${tagId}`, {
                method: 'POST',
            })
            await fetchTags()
        } catch (error) {
            console.error('Failed to add tag to entry:', error)
            throw error
        }
    }

    async function removeTagFromEntry(entryId: string, tagId: string) {
        try {
            await fetch(`${API_BASE}/entries/${entryId}/tags/${tagId}`, {
                method: 'DELETE',
            })
            await fetchTags()
        } catch (error) {
            console.error('Failed to remove tag from entry:', error)
            throw error
        }
    }

    async function getEntryTags(entryId: string): Promise<UserTag[]> {
        try {
            const res = await fetch(`${API_BASE}/entries/${entryId}/tags`)
            const data = await res.json()
            return data.items || []
        } catch (error) {
            console.error('Failed to get entry tags:', error)
            return []
        }
    }

    async function fetchConfig() {
        try {
            const res = await fetch(`${API_BASE}/ai/tags/config`)
            config.value = await res.json()
        } catch (error) {
            console.error('Failed to fetch config:', error)
        }
    }

    async function updateConfig(input: { apiKey?: string; baseUrl?: string; modelName?: string; autoTagging?: boolean }) {
        try {
            const res = await fetch(`${API_BASE}/ai/tags/config`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            config.value = await res.json()
        } catch (error) {
            console.error('Failed to update config:', error)
            throw error
        }
    }

    async function testConfig() {
        try {
            const res = await fetch(`${API_BASE}/ai/tags/test`, {
                method: 'POST',
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || '测试失败')
            }
            return await res.json()
        } catch (error) {
            console.error('Failed to test config:', error)
            throw error
        }
    }

    function selectTag(tagId: string | null) {
        selectedTagId.value = tagId
        selectedView.value = tagId ? 'tag' : 'pending'
    }

    function setView(view: 'tag' | 'pending' | 'untagged') {
        selectedView.value = view
        if (view !== 'tag') {
            selectedTagId.value = null
        }
    }

    // === Information Aggregation APIs ===

    async function fetchFilteredEntries(tagIds: string[], mode: 'and' | 'or' = 'or', refresh = false) {
        if (refresh) {
            cursor.value = null
            entries.value = []
        }
        loading.value = true
        try {
            const params = new URLSearchParams({
                ids: tagIds.join(','),
                mode,
                limit: '50',
            })
            if (cursor.value) params.append('cursor', cursor.value)
            const res = await fetch(`${API_BASE}/tags/filter?${params}`)
            const data = await res.json()
            if (refresh) {
                entries.value = data.items || []
            } else {
                entries.value = [...entries.value, ...(data.items || [])]
            }
            cursor.value = data.nextCursor
            hasMore.value = data.hasMore
        } catch (error) {
            console.error('Failed to fetch filtered entries:', error)
        } finally {
            loading.value = false
        }
    }

    async function fetchTimeline(tagId: string, groupBy: 'week' | 'month' = 'week'): Promise<any> {
        try {
            const params = new URLSearchParams({ group_by: groupBy, limit: '20' })
            const res = await fetch(`${API_BASE}/tags/${tagId}/timeline?${params}`)
            return await res.json()
        } catch (error) {
            console.error('Failed to fetch timeline:', error)
            return { items: [] }
        }
    }

    async function fetchDigest(period: 'today' | 'week' = 'today'): Promise<any> {
        try {
            const params = new URLSearchParams({ period })
            const res = await fetch(`${API_BASE}/digest?${params}`)
            return await res.json()
        } catch (error) {
            console.error('Failed to fetch digest:', error)
            return { items: [] }
        }
    }

    async function fetchRelatedTags(tagId: string): Promise<Array<{ id: string; name: string; color: string; overlap_count: number }>> {
        try {
            const res = await fetch(`${API_BASE}/tags/${tagId}/related`)
            const data = await res.json()
            return data.items || []
        } catch (error) {
            console.error('Failed to fetch related tags:', error)
            return []
        }
    }

    return {
        // State
        tags,
        selectedTagId,
        selectedView,
        entries,
        stats,
        config,
        loading,
        analyzing,
        hasMore,
        // Computed
        selectedTag,
        enabledTags,
        // Actions
        fetchTags,
        createTag,
        updateTag,
        deleteTag,
        fetchStats,
        fetchPendingEntries,
        fetchUntaggedEntries,
        fetchEntriesByTag,
        analyzeEntries,
        rerunRange,
        reanalyzeEntry,
        addTagToEntry,
        removeTagFromEntry,
        getEntryTags,
        fetchConfig,
        updateConfig,
        testConfig,
        selectTag,
        setView,
        // Aggregation
        fetchFilteredEntries,
        fetchTimeline,
        fetchDigest,
        fetchRelatedTags,
    }
})
