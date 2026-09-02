import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getRepositories } from '../data/repositories'
import { toSourceItem } from '../data/presenters'
import { refreshAllFeeds, refreshFeed } from '../domain/feedFetcher'
import type { SourceGroup, SourceItem } from '../types'

export const useSourceStore = defineStore('sources', () => {
  const sources = ref<SourceItem[]>([])
  const groups = ref<SourceGroup[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const totalUnread = computed(() => sources.value.reduce((total, source) => total + source.unread_count, 0))

  async function loadSources() {
    loading.value = true
    error.value = null
    try {
      const repos = await getRepositories()
      const feeds = await repos.feeds.list()
      const items: SourceItem[] = []
      for (const feed of feeds) {
        const unread = await repos.entries.unreadCount(feed.id)
        items.push(toSourceItem(feed, unread))
      }
      sources.value = items

      // Derive group aggregates from the source list.
      const byGroup = new Map<string, SourceGroup>()
      for (const item of items) {
        const g = byGroup.get(item.group_name) ?? { name: item.group_name, count: 0, unread_count: 0 }
        g.count += 1
        g.unread_count += item.unread_count
        byGroup.set(item.group_name, g)
      }
      groups.value = Array.from(byGroup.values()).sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  async function createSource(url: string, groupName = 'default') {
    saving.value = true
    error.value = null
    try {
      const repos = await getRepositories()
      const feed = await repos.feeds.create({ url: url.trim(), group_name: groupName })
      // Fetch immediately so the new source isn't empty.
      await refreshFeed(feed, repos)
      await loadSources()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      saving.value = false
    }
  }

  async function removeSource(id: string) {
    error.value = null
    try {
      const repos = await getRepositories()
      await repos.feeds.remove(id)
      await loadSources()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function syncAll() {
    syncing.value = true
    error.value = null
    try {
      const repos = await getRepositories()
      await refreshAllFeeds(repos)
      await loadSources()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      syncing.value = false
    }
  }

  return {
    sources,
    groups,
    loading,
    saving,
    syncing,
    error,
    totalUnread,
    loadSources,
    createSource,
    removeSource,
    syncAll,
  }
})
