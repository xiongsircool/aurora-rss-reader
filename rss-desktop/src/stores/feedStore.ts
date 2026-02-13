import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../api/client'
import type { Entry, EntryPage, Feed, SummaryResult, ViewType } from '../types'
import { useFeedGroups } from './feedGroups'
import {
  parseOlderThan,
  shouldMarkEntryRead,
  type MarkAsReadOptions,
  type MarkAsReadResult,
} from './feedMarkAsRead'

export const useFeedStore = defineStore('feed', () => {
  // === Core State ===
  const feeds = ref<Feed[]>([])
  const entries = ref<Entry[]>([])
  const activeFeedId = ref<string | null>(null)
  const activeGroupName = ref<string | null>(null)
  const activeViewType = ref<ViewType>('articles')
  const selectedEntryId = ref<string | null>(null)
  const loadingFeeds = ref(false)
  const loadingEntries = ref(false)
  const addingFeed = ref(false)
  const summaryCache = ref<Record<string, SummaryResult>>({})
  const errorMessage = ref<string | null>(null)
  const lastFeedFilters = ref<{ dateRange?: string; timeField?: string } | null>(null)
  const lastEntryFilters = ref<{ unreadOnly?: boolean; dateRange?: string; timeField?: string } | null>(null)
  const entriesCursor = ref<string | null>(null)
  const entriesHasMore = ref(true)
  const entriesLoadingMore = ref(false)
  const entriesQueryKey = ref('')

  const selectedEntry = computed(() =>
    entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null,
  )

  // === View Type Computed ===
  const filteredFeeds = computed(() => feeds.value.filter(f => f.view_type === activeViewType.value))

  const viewTypeStats = computed(() => {
    const stats: Record<string, { count: number; unread: number }> = {}
    const types: ViewType[] = ['articles', 'social', 'pictures', 'videos', 'audio', 'notifications']
    types.forEach(type => {
      const typeFeeds = feeds.value.filter(f => f.view_type === type)
      stats[type] = {
        count: typeFeeds.length,
        unread: typeFeeds.reduce((sum, f) => sum + (f.unread_count || 0), 0),
      }
    })
    return stats
  })

  // === Group Management (delegated) ===
  const {
    collapsedGroups,
    groupedFeeds,
    groupStats,
    sortedGroupNames,
    toggleGroupCollapse,
    isGroupCollapsed,
    expandAllGroups,
    collapseAllGroups,
    loadCollapsedGroups,
    loadCustomGroups,
    createGroup,
    deleteGroup,
  } = useFeedGroups(filteredFeeds)

  // === Entries Query Key ===
  function buildEntriesQueryKey(params: {
    feedId: string | null
    groupName: string | null
    viewType?: string | null
    unreadOnly: boolean
    dateRange?: string
    timeField?: string
  }) {
    return JSON.stringify({
      feedId: params.feedId,
      groupName: params.groupName,
      viewType: params.viewType ?? null,
      unreadOnly: params.unreadOnly,
      dateRange: params.dateRange ?? null,
      timeField: params.timeField ?? null,
    })
  }

  function mergeEntries(existing: Entry[], incoming: Entry[]) {
    if (!incoming.length) return existing
    const seen = new Set(existing.map(e => e.id))
    const merged = existing.slice()
    for (const entry of incoming) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push(entry)
      }
    }
    return merged
  }

  // === Feed CRUD ===

  async function fetchFeeds(options?: { dateRange?: string; timeField?: string }) {
    loadingFeeds.value = true
    try {
      const hasDateRange = options && Object.prototype.hasOwnProperty.call(options, 'dateRange')
      const hasTimeField = options && Object.prototype.hasOwnProperty.call(options, 'timeField')
      const mergedFilters = {
        dateRange: hasDateRange ? options?.dateRange : lastFeedFilters.value?.dateRange,
        timeField: hasTimeField ? options?.timeField : lastFeedFilters.value?.timeField,
      }
      lastFeedFilters.value = mergedFilters

      const params: Record<string, string> = {}
      if (mergedFilters.dateRange && mergedFilters.dateRange !== 'all') {
        params.date_range = mergedFilters.dateRange
      }
      if (mergedFilters.timeField) {
        params.time_field = mergedFilters.timeField
      }

      const { data } = await api.get<Feed[]>('/feeds', { params })
      feeds.value = data
    } catch (error) {
      console.error(error)
      errorMessage.value = '加载订阅列表失败'
    } finally {
      loadingFeeds.value = false
    }
  }

  async function addFeed(url: string, options?: { groupName?: string | null; viewType?: ViewType }) {
    if (!url) return
    addingFeed.value = true
    try {
      const payload: { url: string; group_name?: string; view_type?: string } = { url }
      if (options?.groupName) payload.group_name = options.groupName
      payload.view_type = options?.viewType ?? activeViewType.value
      const { data } = await api.post<Feed>('/feeds', payload)
      feeds.value = [data, ...feeds.value]
      await fetchEntries({
        unreadOnly: lastEntryFilters.value?.unreadOnly,
        dateRange: lastEntryFilters.value?.dateRange,
        timeField: lastEntryFilters.value?.timeField,
      })
    } catch (error) {
      console.error(error)
      errorMessage.value = '添加订阅失败，请检查链接'
    } finally {
      addingFeed.value = false
    }
  }

  async function deleteFeed(feedId: string) {
    try {
      await api.delete(`/feeds/${feedId}`)
      feeds.value = feeds.value.filter(f => f.id !== feedId)
      if (activeFeedId.value === feedId) {
        activeFeedId.value = null
        entries.value = []
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '删除订阅失败'
    }
  }

  async function updateFeed(feedId: string, updates: { group_name?: string; custom_title?: string | null; ai_tagging_enabled?: boolean }) {
    try {
      const { data } = await api.patch<Feed>(`/feeds/${feedId}`, updates)
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) feeds.value[index] = data
      await fetchFeeds()
    } catch (error) {
      console.error(error)
      errorMessage.value = '更新订阅失败'
    }
  }

  async function updateFeedTagging(feedId: string, enabled: boolean) {
    try {
      const { data } = await api.patch<Feed>(`/feeds/${feedId}`, { ai_tagging_enabled: enabled })
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) feeds.value[index] = data
    } catch (error) {
      console.error(error)
      errorMessage.value = '更新订阅失败'
    }
  }

  async function bulkUpdateFeedTagging(feedIds: string[], enabled: boolean) {
    if (feedIds.length === 0) return
    for (const id of feedIds) await updateFeedTagging(id, enabled)
  }

  async function updateFeedViewType(feedId: string, viewType: ViewType) {
    try {
      const { data } = await api.patch<Feed>(`/feeds/${feedId}`, { view_type: viewType })
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) feeds.value[index] = data
    } catch (error) {
      console.error(error)
      errorMessage.value = '更新订阅类型失败'
    }
  }

  async function refreshActiveFeed() {
    if (activeGroupName.value) {
      const groupFeeds = groupedFeeds.value[activeGroupName.value] || []
      for (const feed of groupFeeds) {
        api.post(`/feeds/${feed.id}/refresh`).catch(err => console.error(err))
      }
      setTimeout(() => {
        fetchFeeds()
        fetchEntries({
          groupName: activeGroupName.value!,
          unreadOnly: lastEntryFilters.value?.unreadOnly,
          dateRange: lastEntryFilters.value?.dateRange,
          timeField: lastEntryFilters.value?.timeField,
        })
      }, 2000)
      return
    }
    const feedId = activeFeedId.value
    if (!feedId) return
    const oldFeed = feeds.value.find(f => f.id === feedId)
    const oldTime = oldFeed?.last_checked_at
    try {
      await api.post(`/feeds/${feedId}/refresh`)
      let attempts = 0
      const checkInterval = setInterval(async () => {
        attempts++
        await fetchFeeds()
        const newFeed = feeds.value.find(f => f.id === feedId)
        if (newFeed?.last_checked_at !== oldTime || attempts >= 5) {
          clearInterval(checkInterval)
          await fetchEntries({
            unreadOnly: lastEntryFilters.value?.unreadOnly,
            dateRange: lastEntryFilters.value?.dateRange,
            timeField: lastEntryFilters.value?.timeField,
          })
        }
      }, 1000)
    } catch (err) {
      console.error(err)
      errorMessage.value = '刷新失败'
    }
  }

  // === Entries ===

  async function fetchEntries(options?: {
    feedId?: string
    groupName?: string
    viewType?: ViewType
    unreadOnly?: boolean
    dateRange?: string
    timeField?: string
    append?: boolean
  }) {
    const append = !!options?.append
    const targetFeed = options?.feedId ?? activeFeedId.value
    const targetGroup = options?.groupName ?? activeGroupName.value
    const targetViewType = options?.viewType ?? (!targetFeed && !targetGroup ? activeViewType.value : null)
    if (!targetFeed && !targetGroup && !targetViewType) return

    const hasUnreadOnly = options && Object.prototype.hasOwnProperty.call(options, 'unreadOnly')
    const hasDateRange = options && Object.prototype.hasOwnProperty.call(options, 'dateRange')
    const hasTimeField = options && Object.prototype.hasOwnProperty.call(options, 'timeField')
    const mergedFilters = {
      unreadOnly: hasUnreadOnly ? (options?.unreadOnly as boolean) : (lastEntryFilters.value?.unreadOnly ?? false),
      dateRange: hasDateRange ? options?.dateRange : lastEntryFilters.value?.dateRange,
      timeField: hasTimeField ? options?.timeField : lastEntryFilters.value?.timeField,
    }
    lastEntryFilters.value = mergedFilters

    const queryKey = buildEntriesQueryKey({
      feedId: targetFeed,
      groupName: targetGroup,
      viewType: targetViewType,
      unreadOnly: mergedFilters.unreadOnly,
      dateRange: mergedFilters.dateRange,
      timeField: mergedFilters.timeField,
    })
    const queryChanged = queryKey !== entriesQueryKey.value
    const resetPagination = !append || queryChanged
    const shouldAppend = append && !resetPagination

    if (resetPagination) {
      entriesQueryKey.value = queryKey
      entriesCursor.value = null
      entriesHasMore.value = true
    }

    if (shouldAppend) {
      if (entriesLoadingMore.value || loadingEntries.value || !entriesHasMore.value) return
      entriesLoadingMore.value = true
    } else {
      loadingEntries.value = true
    }

    try {
      const params: Record<string, string | number | boolean> = {}
      if (targetFeed) params.feed_id = targetFeed
      else if (targetGroup) params.group_name = targetGroup
      else if (targetViewType) params.view_type = targetViewType

      if (mergedFilters.unreadOnly) params.unread_only = true
      if (mergedFilters.dateRange && mergedFilters.dateRange !== 'all') params.date_range = mergedFilters.dateRange
      if (mergedFilters.timeField) params.time_field = mergedFilters.timeField
      if (shouldAppend && entriesCursor.value) params.cursor = entriesCursor.value

      const { data } = await api.get<EntryPage>('/entries', { params })
      const pageItems = data.items ?? []
      entries.value = shouldAppend ? mergeEntries(entries.value, pageItems) : pageItems
      entriesCursor.value = data.next_cursor
      entriesHasMore.value = data.has_more

      if (!shouldAppend) {
        if (entries.value.length > 0) {
          const defaultEntry = entries.value.find(e => e.id === selectedEntryId.value) ?? entries.value[0]
          selectedEntryId.value = defaultEntry.id
        } else {
          selectedEntryId.value = null
        }
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '加载文章失败'
    } finally {
      if (shouldAppend) entriesLoadingMore.value = false
      else loadingEntries.value = false
    }
  }

  async function loadMoreEntries() {
    return fetchEntries({ append: true })
  }

  // === Selection ===

  function selectFeed(id: string) {
    if (activeFeedId.value === id) return
    activeFeedId.value = id
    activeGroupName.value = null
  }

  function selectGroup(groupName: string) {
    if (activeGroupName.value === groupName) return
    activeGroupName.value = groupName
    activeFeedId.value = null
  }

  function selectViewType(viewType: ViewType) {
    if (activeViewType.value === viewType) return
    activeViewType.value = viewType
    activeFeedId.value = null
    activeGroupName.value = null
  }

  function selectEntry(entryId: string) {
    selectedEntryId.value = entryId
  }

  // === Entry State ===

  function adjustFeedUnreadCount(feedId: string, delta: number) {
    const feed = feeds.value.find(f => f.id === feedId)
    if (feed) feed.unread_count = Math.max(0, (feed.unread_count || 0) + delta)
  }

  async function toggleEntryState(entry: Entry, state: Partial<Pick<Entry, 'read' | 'starred'>>) {
    const previousRead = entry.read
    try {
      await api.patch<Entry>(`/entries/${entry.id}`, state)
      entry.read = state.read ?? entry.read
      entry.starred = state.starred ?? entry.starred
      if (state.read !== undefined && previousRead !== entry.read) {
        adjustFeedUnreadCount(entry.feed_id, entry.read ? -1 : 1)
      }
    } catch (error) {
      console.error('Failed to toggle entry state:', error)
      errorMessage.value = '更新文章状态失败'
      throw error
    }
  }

  // === AI ===

  async function requestSummary(entryId: string, language = 'zh') {
    if (summaryCache.value[entryId]) return summaryCache.value[entryId]
    const { data } = await api.post<SummaryResult>('/ai/summary', {
      entry_id: entryId,
      language,
    }, { timeout: 90000 })
    summaryCache.value[entryId] = data
    return data
  }

  async function requestTitleTranslation(entryId: string, language = 'zh') {
    const { data } = await api.post<{ entry_id: string; title: string; language: string }>('/ai/translate-title', {
      entry_id: entryId,
      language,
    }, { timeout: 30000 })
    return { title: data.title, language: data.language }
  }

  // === OPML ===

  async function exportOpml() {
    try {
      const response = await api.get('/opml/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'rss_subscriptions.opml')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      errorMessage.value = '导出 OPML 失败'
      throw error
    }
  }

  async function importOpml(file: File) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<{ imported: number; skipped: number; errors: string[] }>(
        '/opml/import',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      await fetchFeeds()
      return data
    } catch (error) {
      console.error(error)
      errorMessage.value = '导入 OPML 失败'
      throw error
    }
  }

  // === Mark as Read ===

  async function markAsRead(options: MarkAsReadOptions = {}): Promise<MarkAsReadResult> {
    try {
      const { data } = await api.post<MarkAsReadResult>('/entries/mark-read', {
        feed_id: options.feedId ?? null,
        group_name: options.groupName ?? null,
        older_than: options.olderThan ?? null,
        time_field: options.timeField ?? 'inserted_at',
      })
      if (data.feed_counts) {
        Object.entries(data.feed_counts).forEach(([fid, count]) => {
          adjustFeedUnreadCount(fid, -count)
        })
      }
      const cutoff = parseOlderThan(options.olderThan)
      const timeField = options.timeField ?? 'inserted_at'
      entries.value.forEach(entry => {
        if (data.feed_counts && data.feed_counts[entry.feed_id] && shouldMarkEntryRead(entry, cutoff, timeField, options.feedId)) {
          entry.read = true
        }
      })
      return data
    } catch (error) {
      console.error('Mark as read failed:', error)
      throw error
    }
  }

  return {
    // State
    feeds,
    entries,
    selectedEntry,
    activeFeedId,
    activeGroupName,
    activeViewType,
    loadingFeeds,
    loadingEntries,
    entriesHasMore,
    entriesLoadingMore,
    addingFeed,
    errorMessage,
    summaryCache,
    // Group (delegated)
    groupedFeeds,
    groupStats,
    sortedGroupNames,
    collapsedGroups,
    // View type
    filteredFeeds,
    viewTypeStats,
    // Feed CRUD
    fetchFeeds,
    fetchEntries,
    loadMoreEntries,
    addFeed,
    selectFeed,
    selectGroup,
    selectViewType,
    selectEntry,
    refreshActiveFeed,
    deleteFeed,
    updateFeed,
    updateFeedTagging,
    bulkUpdateFeedTagging,
    updateFeedViewType,
    toggleEntryState,
    requestSummary,
    requestTitleTranslation,
    exportOpml,
    importOpml,
    // Group management
    toggleGroupCollapse,
    isGroupCollapsed,
    expandAllGroups,
    collapseAllGroups,
    loadCollapsedGroups,
    loadCustomGroups,
    // Mark as read
    markAsRead,
    // Custom groups
    createGroup,
    deleteGroup,
  }
})
