import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

export interface SearchResult {
  id: string
  title: string
  content: string
  feed_id: string
  feed_title: string
  published_at: string | null
  url: string | null
  score: number
  match_type: 'semantic' | 'keyword'
}

export interface SearchResponse {
  query: string
  type: string
  total: number
  results: SearchResult[]
}

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const searchType = ref<'hybrid' | 'semantic' | 'keyword'>('hybrid')
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasSearched = ref(false)

  async function search(searchQuery: string, type: 'hybrid' | 'semantic' | 'keyword' = 'hybrid', limit = 20) {
    if (!searchQuery.trim()) {
      results.value = []
      hasSearched.value = false
      return
    }

    query.value = searchQuery
    searchType.value = type
    loading.value = true
    error.value = null
    hasSearched.value = true

    try {
      const response = await api.post<SearchResponse>('/ai/search', {
        query: searchQuery,
        type,
        limit
      })
      results.value = response.data.results
    } catch (err) {
      console.error('[Search] Error:', err)
      error.value = 'Search failed'
      results.value = []
    } finally {
      loading.value = false
    }
  }

  function clearSearch() {
    query.value = ''
    results.value = []
    error.value = null
    hasSearched.value = false
  }

  return {
    query,
    searchType,
    results,
    loading,
    error,
    hasSearched,
    search,
    clearSearch
  }
})
