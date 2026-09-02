import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRepositories } from '../data/repositories'
import { toReaderEntry } from '../data/presenters'
import type { EntryRow } from '../data/models'
import type { ReaderEntry } from '../types'

export const useReaderStore = defineStore('reader', () => {
  const entry = ref<ReaderEntry | null>(null)
  // Raw row kept alongside the view-model so AI actions have the full content.
  const row = ref<EntryRow | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadEntry(id: string) {
    loading.value = true
    error.value = null
    try {
      const repos = await getRepositories()
      const entryRow = await repos.entries.get(id)
      if (!entryRow) {
        entry.value = null
        row.value = null
        error.value = 'Entry not found'
        return
      }
      row.value = entryRow
      const feed = await repos.feeds.get(entryRow.feed_id)
      entry.value = toReaderEntry(entryRow, feed, null)

      if (!entry.value.read) {
        entry.value.read = true
        repos.entries.setRead(id, true).catch(() => {
          if (entry.value?.id === id) entry.value.read = false
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  async function toggleSaved() {
    if (!entry.value) return
    const previous = entry.value.starred
    const id = entry.value.id
    entry.value.starred = !entry.value.starred
    try {
      const repos = await getRepositories()
      await repos.entries.setStarred(id, entry.value.starred)
    } catch (err) {
      if (entry.value?.id === id) entry.value.starred = previous
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  return {
    entry,
    row,
    loading,
    error,
    loadEntry,
    toggleSaved,
  }
})
