import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../api/client'
import type { Entry, EntryPage, Feed, SummaryResult } from '../types'

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<Feed[]>([])
  const entries = ref<Entry[]>([])
  const activeFeedId = ref<string | null>(null)
  const activeGroupName = ref<string | null>(null)
  const selectedEntryId = ref<string | null>(null)
  const loadingFeeds = ref(false)
  const loadingEntries = ref(false)
  const addingFeed = ref(false)
  const summaryCache = ref<Record<string, SummaryResult>>({})
  const errorMessage = ref<string | null>(null)
  const collapsedGroups = ref<Set<string>>(new Set())
  const lastFeedFilters = ref<{ dateRange?: string; timeField?: string } | null>(null)
  const lastEntryFilters = ref<{ unreadOnly?: boolean; dateRange?: string; timeField?: string } | null>(null)
  const entriesCursor = ref<string | null>(null)
  const entriesHasMore = ref(true)
  const entriesLoadingMore = ref(false)
  const entriesQueryKey = ref('')

  const selectedEntry = computed(() =>
    entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null
  )

  // 分组相关的计算属性
  const groupedFeeds = computed(() => {
    const groups: Record<string, Feed[]> = {}

    // 将feeds按分组归类
    feeds.value.forEach(feed => {
      const groupName = feed.group_name || '未分组'
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(feed)
    })

    // 对每个分组内的feeds按名称排序
    Object.keys(groups).forEach(groupName => {
      groups[groupName].sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url))
    })

    return groups
  })

  const groupStats = computed(() => {
    const stats: Record<string, { feedCount: number; unreadCount: number }> = {}

    Object.entries(groupedFeeds.value).forEach(([groupName, groupFeeds]) => {
      const feedCount = groupFeeds.length
      const unreadCount = groupFeeds.reduce((sum, feed) => sum + (feed.unread_count || 0), 0)
      stats[groupName] = { feedCount, unreadCount }
    })

    return stats
  })

  const sortedGroupNames = computed(() => {
    const groups = Object.keys(groupedFeeds.value)
    return groups.sort((a, b) => {
      // 未分组放在最后
      if (a === '未分组') return 1
      if (b === '未分组') return -1
      return a.localeCompare(b)
    })
  })

  function buildEntriesQueryKey(params: {
    feedId: string | null
    groupName: string | null
    unreadOnly: boolean
    dateRange?: string
    timeField?: string
  }) {
    return JSON.stringify({
      feedId: params.feedId,
      groupName: params.groupName,
      unreadOnly: params.unreadOnly,
      dateRange: params.dateRange ?? null,
      timeField: params.timeField ?? null,
    })
  }

  function mergeEntries(existing: Entry[], incoming: Entry[]) {
    if (!incoming.length) return existing
    const seen = new Set(existing.map((entry) => entry.id))
    const merged = existing.slice()
    for (const entry of incoming) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push(entry)
      }
    }
    return merged
  }

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
      // 仅在没有任何选择时（既未选中订阅，也未选中分组）才设定默认订阅
      // 避免在分组模式下被刷新订阅列表时意外切回到单个订阅
      if (!activeFeedId.value && !activeGroupName.value && data.length > 0) {
        activeFeedId.value = data[0].id
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '加载订阅列表失败'
    } finally {
      loadingFeeds.value = false
    }
  }

  async function addFeed(url: string, options?: { groupName?: string | null }) {
    if (!url) return
    addingFeed.value = true
    try {
      const payload: { url: string; group_name?: string } = { url }
      if (options?.groupName) {
        payload.group_name = options.groupName
      }
      const { data } = await api.post<Feed>('/feeds', payload)
      feeds.value = [data, ...feeds.value]
      const hasSelection = !!activeFeedId.value || !!activeGroupName.value
      if (!hasSelection) {
        activeFeedId.value = data.id
      }
      // 保留当前的过滤器状态
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

  async function refreshActiveFeed() {
    // 如果是分组模式，刷新该分组下的所有订阅源
    if (activeGroupName.value) {
      const groupFeeds = groupedFeeds.value[activeGroupName.value] || []
      for (const feed of groupFeeds) {
        // 并行触发刷新，不等待逐个完成
        api.post(`/feeds/${feed.id}/refresh`).catch(err => {
          console.error(err)
        })
      }

      // 分组刷新可能耗时较长，这里给一个简单的延迟反馈
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

    // 单个订阅源模式
    const feedId = activeFeedId.value
    if (!feedId) return

    // 获取刷新前的状态，用于对比
    const oldFeed = feeds.value.find(f => f.id === feedId)
    const oldTime = oldFeed?.last_checked_at

    try {
      await api.post(`/feeds/${feedId}/refresh`)

      // 轮询检查状态更新（最多尝试 5 次，每次 1 秒）
      let attempts = 0
      const checkInterval = setInterval(async () => {
        attempts++

        // 仅重新获取订阅列表来检查时间戳（轻量）
        await fetchFeeds()
        const newFeed = feeds.value.find(f => f.id === feedId)

        // 如果时间变了，或者超过最大尝试次数，停止轮询
        if (newFeed?.last_checked_at !== oldTime || attempts >= 5) {
          clearInterval(checkInterval)
          // 刷新完成后，同时更新文章列表
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

  async function deleteFeed(feedId: string) {
    try {
      await api.delete(`/feeds/${feedId}`)
      feeds.value = feeds.value.filter((f) => f.id !== feedId)
      if (activeFeedId.value === feedId) {
        activeFeedId.value = feeds.value.length > 0 ? feeds.value[0].id : null
        if (activeFeedId.value) {
          // 保留当前的过滤器状态
          await fetchEntries({
            unreadOnly: lastEntryFilters.value?.unreadOnly,
            dateRange: lastEntryFilters.value?.dateRange,
            timeField: lastEntryFilters.value?.timeField,
          })
        } else {
          entries.value = []
        }
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '删除订阅失败'
    }
  }

  async function updateFeed(feedId: string, updates: { group_name?: string }) {
    try {
      const { data } = await api.patch<Feed>(`/feeds/${feedId}`, updates)
      const index = feeds.value.findIndex((f) => f.id === feedId)
      if (index !== -1) {
        feeds.value[index] = data
      }
      // 统一刷新订阅列表，确保未读统计与当前筛选条件一致
      await fetchFeeds()
    } catch (error) {
      console.error(error)
      errorMessage.value = '更新订阅失败'
    }
  }

  async function fetchEntries(options?: {
    feedId?: string
    groupName?: string
    unreadOnly?: boolean
    dateRange?: string
    timeField?: string
    append?: boolean
  }) {
    const append = !!options?.append
    const targetFeed = options?.feedId ?? activeFeedId.value
    const targetGroup = options?.groupName ?? activeGroupName.value

    // 如果既没有feed也没有group，则返回
    if (!targetFeed && !targetGroup) return

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

      // 优先使用 feedId，其次使用 groupName
      if (targetFeed) {
        params.feed_id = targetFeed
      } else if (targetGroup) {
        params.group_name = targetGroup
      }

      if (mergedFilters.unreadOnly) {
        params.unread_only = true
      }

      if (mergedFilters.dateRange && mergedFilters.dateRange !== 'all') {
        params.date_range = mergedFilters.dateRange
      }

      if (mergedFilters.timeField) {
        params.time_field = mergedFilters.timeField
      }

      if (shouldAppend && entriesCursor.value) {
        params.cursor = entriesCursor.value
      }

      const { data } = await api.get<EntryPage>('/entries', { params })
      const pageItems = data.items ?? []
      entries.value = shouldAppend ? mergeEntries(entries.value, pageItems) : pageItems
      entriesCursor.value = data.next_cursor
      entriesHasMore.value = data.has_more

      if (!shouldAppend) {
        if (entries.value.length > 0) {
          const defaultEntry = entries.value.find((entry) => entry.id === selectedEntryId.value) ?? entries.value[0]
          selectedEntryId.value = defaultEntry.id
        } else {
          selectedEntryId.value = null
        }
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '加载文章失败'
    } finally {
      if (shouldAppend) {
        entriesLoadingMore.value = false
      } else {
        loadingEntries.value = false
      }
    }
  }

  async function loadMoreEntries() {
    return fetchEntries({ append: true })
  }

  function selectFeed(id: string) {
    if (activeFeedId.value === id) return
    activeFeedId.value = id
    activeGroupName.value = null  // 清除分组选择
  }

  function selectGroup(groupName: string) {
    if (activeGroupName.value === groupName) return
    activeGroupName.value = groupName
    activeFeedId.value = null  // 清除单个订阅源选择
  }

  function selectEntry(entryId: string) {
    selectedEntryId.value = entryId
  }

  function adjustFeedUnreadCount(feedId: string, delta: number) {
    const feed = feeds.value.find((f) => f.id === feedId)
    if (feed) {
      const next = Math.max(0, (feed.unread_count || 0) + delta)
      feed.unread_count = next
    }
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

  async function requestSummary(entryId: string, language = 'zh') {
    if (summaryCache.value[entryId]) {
      return summaryCache.value[entryId]
    }
    const { data } = await api.post<SummaryResult>('/ai/summary', {
      entry_id: entryId,
      language,
    }, {
      timeout: 90000, // 90 seconds for summary generation
    })
    summaryCache.value[entryId] = data
    return data
  }

  async function requestTitleTranslation(entryId: string, language = 'zh') {
    const { data } = await api.post<{ entry_id: string; title: string; language: string }>('/ai/translate-title', {
      entry_id: entryId,
      language,
    }, {
      timeout: 30000, // 30 seconds for title translation
    })
    return {
      title: data.title,
      language: data.language
    }
  }

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
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      )
      await fetchFeeds()
      return data
    } catch (error) {
      console.error(error)
      errorMessage.value = '导入 OPML 失败'
      throw error
    }
  }

  // 分组管理方法
  function toggleGroupCollapse(groupName: string) {
    if (collapsedGroups.value.has(groupName)) {
      collapsedGroups.value.delete(groupName)
    } else {
      collapsedGroups.value.add(groupName)
    }
    // 保存到localStorage
    localStorage.setItem('collapsedGroups', JSON.stringify([...collapsedGroups.value]))
  }

  function isGroupCollapsed(groupName: string) {
    return collapsedGroups.value.has(groupName)
  }

  function expandAllGroups() {
    collapsedGroups.value.clear()
    localStorage.removeItem('collapsedGroups')
  }

  function collapseAllGroups() {
    collapsedGroups.value = new Set(sortedGroupNames.value)
    localStorage.setItem('collapsedGroups', JSON.stringify([...collapsedGroups.value]))
  }

  function loadCollapsedGroups() {
    const saved = localStorage.getItem('collapsedGroups')
    if (saved) {
      try {
        collapsedGroups.value = new Set(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load collapsed groups:', e)
      }
    }
  }

  // 一键已读接口
  interface MarkAsReadOptions {
    feedId?: string
    groupName?: string
    olderThan?: string  // 标记多少天之前的文章为已读
    timeField?: string
  }

  interface MarkAsReadResult {
    success: boolean
    message: string
    marked_count: number
    feed_counts: Record<string, number>
  }

  function parseOlderThan(olderThan?: string | null): Date | null {
    if (!olderThan) return null
    if (olderThan === 'all' || olderThan === 'current') return null
    const match = olderThan.match(/^(\d+)([hdmy])$/)
    const now = Date.now()
    if (!match) {
      return new Date(now - 30 * 24 * 60 * 60 * 1000)
    }
    const value = Number(match[1])
    const unit = match[2]
    const hourMs = 60 * 60 * 1000
    const dayMs = 24 * hourMs
    let deltaMs = dayMs * 30
    if (unit === 'h') deltaMs = value * hourMs
    if (unit === 'd') deltaMs = value * dayMs
    if (unit === 'm') deltaMs = value * dayMs * 30
    if (unit === 'y') deltaMs = value * dayMs * 365
    return new Date(now - deltaMs)
  }

  function parseEntryDate(value?: string | null): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  function shouldMarkEntryRead(entry: Entry, cutoff: Date | null, timeField: string, feedId?: string) {
    if (feedId && entry.feed_id !== feedId) {
      return false
    }
    if (!cutoff) {
      return true
    }
    const insertedAt = parseEntryDate(entry.inserted_at)
    if (timeField === 'published_at') {
      const publishedAt = parseEntryDate(entry.published_at)
      if (publishedAt) {
        return publishedAt <= cutoff
      }
      return insertedAt ? insertedAt <= cutoff : false
    }
    return insertedAt ? insertedAt <= cutoff : false
  }

  async function markAsRead(options: MarkAsReadOptions = {}): Promise<MarkAsReadResult> {
    try {
      const { data } = await api.post<MarkAsReadResult>('/entries/mark-read', {
        feed_id: options.feedId ?? null,
        group_name: options.groupName ?? null,
        older_than: options.olderThan ?? null,
        time_field: options.timeField ?? 'inserted_at'
      })

      // 更新本地的未读计数
      if (data.feed_counts) {
        Object.entries(data.feed_counts).forEach(([feedId, count]) => {
          adjustFeedUnreadCount(feedId, -count)
        })
      }

      // 更新本地 entries 的已读状态
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
    feeds,
    entries,
    selectedEntry,
    activeFeedId,
    activeGroupName,
    loadingFeeds,
    loadingEntries,
    entriesHasMore,
    entriesLoadingMore,
    addingFeed,
    errorMessage,
    summaryCache,
    // 分组相关属性
    groupedFeeds,
    groupStats,
    sortedGroupNames,
    collapsedGroups,
    // 方法
    fetchFeeds,
    fetchEntries,
    loadMoreEntries,
    addFeed,
    selectFeed,
    selectGroup,
    selectEntry,
    refreshActiveFeed,
    deleteFeed,
    updateFeed,
    toggleEntryState,
    requestSummary,
    requestTitleTranslation,
    exportOpml,
    importOpml,
    // 分组管理方法
    toggleGroupCollapse,
    isGroupCollapsed,
    expandAllGroups,
    collapseAllGroups,
    loadCollapsedGroups,
    // 一键已读方法
    markAsRead,
  }
})
