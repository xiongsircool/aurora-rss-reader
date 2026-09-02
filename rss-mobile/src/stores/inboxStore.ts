import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getRepositories } from '../data/repositories'
import { toInboxEntry } from '../data/presenters'
import { refreshAllFeeds } from '../domain/feedFetcher'
import type { FeedRow } from '../data/models'
import type { InboxEntry, InboxFilter } from '../types'

export const useInboxStore = defineStore('inbox', () => {
  const entries = ref<InboxEntry[]>([])
  const filter = ref<InboxFilter>('all')
  const activeGroupName = ref<string | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<string | null>(null)
  const hasMore = ref(false)

  const unreadCount = computed(() => entries.value.filter((entry) => !entry.read).length)
  const savedCount = computed(() => entries.value.filter((entry) => entry.starred).length)

  async function loadEntries(options: { append?: boolean } = {}) {
    const append = options.append === true
    if (append) {
      if (!hasMore.value || loadingMore.value) return
      loadingMore.value = true
    } else {
      loading.value = true
      nextCursor.value = null
      error.value = null
    }

    try {
      const repos = await getRepositories()
      const page = await repos.entries.list({
        filter: filter.value,
        groupName: activeGroupName.value,
        cursor: append ? nextCursor.value : null,
        limit: 30,
      })

      // Resolve feeds once per page to label rows.
      const feeds = await repos.feeds.list()
      const feedById = new Map<string, FeedRow>(feeds.map((f) => [f.id, f]))
      const mapped = page.items.map((row) => toInboxEntry(row, feedById.get(row.feed_id) ?? null))

      entries.value = append ? [...entries.value, ...mapped] : mapped
      nextCursor.value = page.nextCursor
      hasMore.value = page.hasMore
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  async function setFilter(nextFilter: InboxFilter) {
    if (filter.value === nextFilter) return
    filter.value = nextFilter
    await loadEntries()
  }

  async function setGroup(groupName: string | null) {
    activeGroupName.value = groupName
    await loadEntries()
  }

  async function toggleSaved(entryId: string) {
    const entry = entries.value.find((item) => item.id === entryId)
    if (!entry) return
    const previous = entry.starred
    entry.starred = !entry.starred
    try {
      const repos = await getRepositories()
      await repos.entries.setStarred(entryId, entry.starred)
    } catch (err) {
      entry.starred = previous
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function markRead(entryId: string, read = true) {
    const entry = entries.value.find((item) => item.id === entryId)
    if (entry) entry.read = read
    try {
      const repos = await getRepositories()
      await repos.entries.setRead(entryId, read)
    } catch (err) {
      if (entry) entry.read = !read
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function refreshFeeds() {
    syncing.value = true
    error.value = null
    try {
      const repos = await getRepositories()
      await refreshAllFeeds(repos)
      await loadEntries()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      syncing.value = false
    }
  }

  return {
    entries,
    filter,
    activeGroupName,
    loading,
    loadingMore,
    syncing,
    error,
    nextCursor,
    hasMore,
    unreadCount,
    savedCount,
    loadEntries,
    setFilter,
    setGroup,
    toggleSaved,
    markRead,
    refreshFeeds,
  }
})
