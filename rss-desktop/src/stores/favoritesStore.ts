import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/client'

export interface StarredEntry {
  id: string
  feed_id: string
  feed_title: string
  title: string
  url: string
  author: string | null
  summary: string | null
  content: string | null
  readability_content?: string | null
  published_at: string | null
  inserted_at: string | null
  read: boolean
  starred: boolean
  translated_title?: string | null
  translated_summary?: string | null
}

export interface StarredStats {
  total_starred: number
  by_feed: Record<string, {
    title: string
    group_name?: string
    starred_count: number
  }>
  by_group: Record<string, number>
}

export const useFavoritesStore = defineStore('favorites', () => {
  const starredEntries = ref<StarredEntry[]>([])
  const starredStats = ref<StarredStats>({
    total_starred: 0,
    by_feed: {},
    by_group: {}
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取收藏文章列表
  async function fetchStarredEntries(feedId?: string, limit = 50, offset = 0, options: { dateRange?: string; timeField?: string } = {}) {
    loading.value = true
    error.value = null

    try {
      const params: any = { limit, offset }
      if (feedId) {
        params.feed_id = feedId
      }

      if (options.dateRange && options.dateRange !== 'all') {
        params.date_range = options.dateRange
      }
      if (options.timeField) {
        params.time_field = options.timeField
      }

      const { data } = await api.get<StarredEntry[]>('/entries/starred', { params })
      starredEntries.value = data

      // 获取统计数据 (Note: Stats API might not support filters, assuming global stats for now or update if needed)
      await fetchStarredStats()

      return data
    } catch (err) {
      console.error('Failed to fetch starred entries:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取收藏统计信息
  async function fetchStarredStats() {
    try {
      const { data } = await api.get<StarredStats>('/entries/starred/stats')
      starredStats.value = data
      return data
    } catch (err) {
      console.error('Failed to fetch starred stats:', err)
      error.value = '获取收藏统计失败'
      throw err
    }
  }

  // 收藏文章
  async function starEntry(entryId: string) {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.post(`/entries/${entryId}/star`)

      // 更新本地状态
      const entryIndex = starredEntries.value.findIndex(entry => entry.id === entryId)
      if (entryIndex === -1) {
        // 如果不在当前列表中，重新获取完整列表
        await fetchStarredEntries()
      }

      // 更新统计
      await fetchStarredStats()

      return data
    } catch (err) {
      console.error('Failed to star entry:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 取消收藏文章
  async function unstarEntry(entryId: string) {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.delete(`/entries/${entryId}/star`)

      // 从本地列表中移除
      const entryIndex = starredEntries.value.findIndex(entry => entry.id === entryId)
      if (entryIndex !== -1) {
        starredEntries.value.splice(entryIndex, 1)
      }

      // 更新统计
      await fetchStarredStats()

      return data
    } catch (err) {
      console.error('Failed to unstar entry:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // 批量收藏
  async function bulkStarEntries(entryIds: string[]) {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.post('/entries/bulk-star', entryIds)

      // 重新获取列表
      await fetchStarredEntries()

      return data
    } catch (err) {
      console.error('Failed to bulk star entries:', err)
      error.value = '批量收藏失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 批量取消收藏
  async function bulkUnstarEntries(entryIds: string[]) {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.post('/entries/bulk-unstar', entryIds)

      // 从本地列表中移除
      starredEntries.value = starredEntries.value.filter(entry => !entryIds.includes(entry.id))

      // 更新统计
      await fetchStarredStats()

      return data
    } catch (err) {
      console.error('Failed to bulk unstar entries:', err)
      error.value = '批量取消收藏失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 计算属性：按分组组织的收藏统计
  const groupedStats = computed(() => {
    const groups: Record<string, {
      total: number
      feeds: Array<{
        id: string
        title: string
        count: number
      }>
    }> = {}

    // 添加"全部收藏"
    groups['all'] = {
      total: starredStats.value.total_starred,
      feeds: []
    }

    // 按分组组织
    Object.entries(starredStats.value.by_group).forEach(([groupName, count]) => {
      groups[groupName] = {
        total: count,
        feeds: []
      }
    })

    // 添加各个订阅源到对应分组
    Object.entries(starredStats.value.by_feed).forEach(([feedId, feedInfo]) => {
      const groupName = feedInfo.group_name || '未分组'

      if (groups[groupName]) {
        groups[groupName].feeds.push({
          id: feedId,
          title: feedInfo.title,
          count: feedInfo.starred_count
        })
      }
    })

    // 对每个分组内的订阅源按标题排序
    Object.values(groups).forEach(group => {
      group.feeds.sort((a, b) => a.title.localeCompare(b.title))
    })

    return groups
  })

  // 计算属性：总收藏数
  const totalStarred = computed(() => starredStats.value.total_starred)

  // 计算属性：是否已收藏
  function isEntryStarred(entryId: string): boolean {
    return starredEntries.value.some(entry => entry.id === entryId)
  }

  // 清除错误
  function clearError() {
    error.value = null
  }

  // 重置状态
  function resetState() {
    starredEntries.value = []
    starredStats.value = {
      total_starred: 0,
      by_feed: {},
      by_group: {}
    }
    loading.value = false
    error.value = null
  }

  return {
    // 状态
    starredEntries,
    starredStats,
    groupedStats,
    totalStarred,
    loading,
    error,

    // 方法
    fetchStarredEntries,
    fetchStarredStats,
    starEntry,
    unstarEntry,
    bulkStarEntries,
    bulkUnstarEntries,
    isEntryStarred,
    clearError,
    resetState
  }
})
