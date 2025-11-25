import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '../api/client'
import type { Entry, Feed, SummaryResult, TranslationResult } from '../types'

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<Feed[]>([])
  const entries = ref<Entry[]>([])
  const activeFeedId = ref<string | null>(null)
  const activeGroupName = ref<string | null>(null)
  const selectedEntryId = ref<string | null>(null)
  const loadingFeeds = ref(false)
  const loadingEntries = ref(false)
  const addingFeed = ref(false)
  const refreshingGroup = ref(false)
  const summaryCache = ref<Record<string, SummaryResult>>({})
  const translationCache = ref<Record<string, TranslationResult>>({})
  const titleTranslationCache = ref<Record<string, { title: string; language: string }>>({})
  const errorMessage = ref<string | null>(null)
  const collapsedGroups = ref<Set<string>>(new Set())
  const lastFeedFilters = ref<{ dateRange?: string; timeField?: string } | null>(null)
  const lastEntryFilters = ref<{ unreadOnly?: boolean; dateRange?: string; timeField?: string } | null>(null)

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

  async function addFeed(url: string) {
    if (!url) return
    addingFeed.value = true
    try {
      const { data } = await api.post<Feed>('/feeds', { url })
      feeds.value = [data, ...feeds.value]
      activeFeedId.value = data.id
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
      if (groupFeeds.length === 0) {
        console.log(`分组 "${activeGroupName.value}" 没有订阅源`)
        return
      }

      refreshingGroup.value = true
      console.log(`开始刷新分组 "${activeGroupName.value}" 中的 ${groupFeeds.length} 个订阅源...`)

      // 并行刷新所有订阅源，提高效率
      const refreshPromises = groupFeeds.map(feed =>
        api.post(`/feeds/${feed.id}/refresh`).catch(error => {
          console.error(`Failed to refresh feed ${feed.title}:`, error)
          return { feedId: feed.id, success: false, error }
        })
      )

      try {
        const results = await Promise.allSettled(refreshPromises)
        const successCount = results.filter(result =>
          result.status === 'fulfilled'
        ).length

        console.log(`分组 "${activeGroupName.value}" 刷新完成: ${successCount}/${groupFeeds.length} 个订阅源成功`)

        // 保留当前的过滤器状态
        await fetchEntries({
          groupName: activeGroupName.value,
          unreadOnly: lastEntryFilters.value?.unreadOnly,
          dateRange: lastEntryFilters.value?.dateRange,
          timeField: lastEntryFilters.value?.timeField,
        })
        await fetchFeeds()

      } catch (error) {
        console.error('分组刷新失败:', error)
        errorMessage.value = `分组 "${activeGroupName.value}" 刷新失败`
      } finally {
        refreshingGroup.value = false
      }
      return
    }

    // 单个订阅源模式
    if (!activeFeedId.value) return
    await api.post(`/feeds/${activeFeedId.value}/refresh`)
    // 保留当前的过滤器状态
    await fetchEntries({
      unreadOnly: lastEntryFilters.value?.unreadOnly,
      dateRange: lastEntryFilters.value?.dateRange,
      timeField: lastEntryFilters.value?.timeField,
    })
    await fetchFeeds()
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
  }) {
    const targetFeed = options?.feedId ?? activeFeedId.value
    const targetGroup = options?.groupName ?? activeGroupName.value
    
    // 如果既没有feed也没有group，则返回
    if (!targetFeed && !targetGroup) return
    
    loadingEntries.value = true
    try {
      const hasUnreadOnly = options && Object.prototype.hasOwnProperty.call(options, 'unreadOnly')
      const hasDateRange = options && Object.prototype.hasOwnProperty.call(options, 'dateRange')
      const hasTimeField = options && Object.prototype.hasOwnProperty.call(options, 'timeField')
      const mergedFilters = {
        unreadOnly: hasUnreadOnly ? (options?.unreadOnly as boolean) : (lastEntryFilters.value?.unreadOnly ?? false),
        dateRange: hasDateRange ? options?.dateRange : lastEntryFilters.value?.dateRange,
        timeField: hasTimeField ? options?.timeField : lastEntryFilters.value?.timeField,
      }
      lastEntryFilters.value = mergedFilters

      const params: Record<string, string | number | boolean> = { limit: 100 }

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

      const { data } = await api.get<Entry[]>('/entries', { params })
      entries.value = data
      if (data.length > 0) {
        const defaultEntry = data.find((entry) => entry.id === selectedEntryId.value) ?? data[0]
        selectedEntryId.value = defaultEntry.id
      } else {
        selectedEntryId.value = null
      }
    } catch (error) {
      console.error(error)
      errorMessage.value = '加载文章失败'
    } finally {
      loadingEntries.value = false
    }
  }

  function selectFeed(id: string) {
    if (activeFeedId.value === id) return
    activeFeedId.value = id
    activeGroupName.value = null  // 清除分组选择
  }

  function selectGroup(groupName: string) {
    // 总是更新分组选择，即使点击同一分组也重新加载数据
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
    await api.patch<Entry>(`/entries/${entry.id}`, state)
    entry.read = state.read ?? entry.read
    entry.starred = state.starred ?? entry.starred

    if (state.read !== undefined && previousRead !== entry.read) {
      adjustFeedUnreadCount(entry.feed_id, entry.read ? -1 : 1)
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

  async function requestTranslation(entryId: string, language = 'zh') {
    const cacheKey = `${entryId}_${language}`
    if (translationCache.value[cacheKey]) {
      return translationCache.value[cacheKey]
    }
    const { data } = await api.post<TranslationResult>('/ai/translate', {
      entry_id: entryId,
      language,
    }, {
      timeout: 120000, // 2 minutes for translation (multiple AI API calls)
    })
    translationCache.value[cacheKey] = data
    return data
  }

  async function requestTitleTranslation(entryId: string, language = 'zh') {
    const cacheKey = `${entryId}_${language}_title`
    if (titleTranslationCache.value[cacheKey]) {
      return titleTranslationCache.value[cacheKey]
    }
    const { data } = await api.post<{ entry_id: string; title: string; language: string }>('/ai/translate-title', {
      entry_id: entryId,
      language,
    }, {
      timeout: 30000, // 30 seconds for title translation
    })
    titleTranslationCache.value[cacheKey] = {
      title: data.title,
      language: data.language
    }
    return titleTranslationCache.value[cacheKey]
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
        formData
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

  return {
    feeds,
    entries,
    selectedEntry,
    activeFeedId,
    activeGroupName,
    loadingFeeds,
    loadingEntries,
    addingFeed,
    refreshingGroup,
    errorMessage,
    summaryCache,
    translationCache,
    titleTranslationCache,
    // 分组相关属性
    groupedFeeds,
    groupStats,
    sortedGroupNames,
    collapsedGroups,
    // 方法
    fetchFeeds,
    fetchEntries,
    addFeed,
    selectFeed,
    selectGroup,
    selectEntry,
    refreshActiveFeed,
    deleteFeed,
    updateFeed,
    toggleEntryState,
    requestSummary,
    requestTranslation,
    requestTitleTranslation,
    exportOpml,
    importOpml,
    // 分组管理方法
    toggleGroupCollapse,
    isGroupCollapsed,
    expandAllGroups,
    collapseAllGroups,
    loadCollapsedGroups,
  }
})
