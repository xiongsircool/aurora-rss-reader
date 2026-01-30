import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/client'

export interface Collection {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
  entry_count: number
  created_at: string
  updated_at: string
}

export interface CollectionEntry {
  id: string
  feed_id: string
  feed_title?: string
  title: string
  url: string
  summary: string | null
  content: string | null
  published_at: string | null
  inserted_at: string
  read: boolean
  starred: boolean
  added_at: string
  note: string | null
}

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])
  const activeCollectionId = ref<string | null>(null)
  const collectionEntries = ref<CollectionEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeCollection = computed(() =>
    collections.value.find(c => c.id === activeCollectionId.value) || null
  )

  const totalCollections = computed(() => collections.value.length)

  // === Collection CRUD ===

  async function fetchCollections() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/collections')
      collections.value = res.data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch collections'
    } finally {
      loading.value = false
    }
  }

  async function createCollection(name: string, icon?: string, color?: string) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post('/collections', { name, icon, color })
      collections.value.push({ ...res.data, entry_count: 0 })
      return res.data
    } catch (e: any) {
      error.value = e.message || 'Failed to create collection'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateCollection(id: string, data: Partial<Collection>) {
    loading.value = true
    error.value = null
    try {
      const res = await api.put(`/collections/${id}`, data)
      const idx = collections.value.findIndex(c => c.id === id)
      if (idx !== -1) {
        collections.value[idx] = { ...collections.value[idx], ...res.data }
      }
      return res.data
    } catch (e: any) {
      error.value = e.message || 'Failed to update collection'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCollection(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/collections/${id}`)
      collections.value = collections.value.filter(c => c.id !== id)
      if (activeCollectionId.value === id) {
        activeCollectionId.value = null
        collectionEntries.value = []
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete collection'
      throw e
    } finally {
      loading.value = false
    }
  }

  // === Collection Entries ===

  async function fetchCollectionEntries(collectionId: string, limit = 100, offset = 0) {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/collections/${collectionId}/entries`, {
        params: { limit, offset }
      })
      collectionEntries.value = res.data
      activeCollectionId.value = collectionId
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch collection entries'
    } finally {
      loading.value = false
    }
  }

  async function addEntryToCollection(collectionId: string, entryId: string, note?: string) {
    try {
      await api.post(`/collections/${collectionId}/entries`, { entry_id: entryId, note })
      // Update entry count
      const idx = collections.value.findIndex(c => c.id === collectionId)
      if (idx !== -1) {
        collections.value[idx].entry_count++
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to add entry to collection'
      throw e
    }
  }

  async function removeEntryFromCollection(collectionId: string, entryId: string) {
    try {
      await api.delete(`/collections/${collectionId}/entries/${entryId}`)
      // Update local state
      if (activeCollectionId.value === collectionId) {
        collectionEntries.value = collectionEntries.value.filter(e => e.id !== entryId)
      }
      const idx = collections.value.findIndex(c => c.id === collectionId)
      if (idx !== -1 && collections.value[idx].entry_count > 0) {
        collections.value[idx].entry_count--
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to remove entry from collection'
      throw e
    }
  }

  async function getCollectionsForEntry(entryId: string): Promise<Collection[]> {
    try {
      const res = await api.get(`/entries/${entryId}/collections`)
      return res.data
    } catch (e: any) {
      error.value = e.message || 'Failed to get collections for entry'
      return []
    }
  }

  function selectCollection(id: string | null) {
    activeCollectionId.value = id
    if (!id) {
      collectionEntries.value = []
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    collections,
    activeCollectionId,
    collectionEntries,
    loading,
    error,
    activeCollection,
    totalCollections,
    fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    fetchCollectionEntries,
    addEntryToCollection,
    removeEntryFromCollection,
    getCollectionsForEntry,
    selectCollection,
    clearError,
  }
})
