/**
 * View Mode Composable
 *
 * Manages the top-level navigation state: which view is active
 * (feeds / favorites / collection / tag) and AI search toggle.
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useCollectionsStore } from '../stores/collectionsStore'
import { useTagsStore } from '../stores/tagsStore'
import { useSearchStore } from '../stores/searchStore'
import { useAIStore } from '../stores/aiStore'
import { useSettingsStore } from '../stores/settingsStore'

export type ViewMode = 'feeds' | 'favorites' | 'collection' | 'tag'

export function useViewMode(
  showFavoritesOnly: Ref<boolean>,
  selectedFavoriteEntryId: Ref<string | null>,
  filterContext?: {
    dateRangeFilter: Ref<string>
    isDateFilterActive: Ref<boolean>
  },
) {
  const collectionsStore = useCollectionsStore()
  const tagsStore = useTagsStore()
  const searchStore = useSearchStore()
  const aiStore = useAIStore()
  const settingsStore = useSettingsStore()

  const viewMode = ref<ViewMode>('feeds')
  const activeCollectionId = ref<string | null>(null)
  const activeTagId = ref<string | null>(null)
  const activeTagView = ref<'tag' | 'pending' | 'untagged' | 'digest' | null>(null)
  const aiSearchActive = ref(false)
  const selectedUnifiedEntryId = ref<string | null>(null)

  const aiSearchEnabled = computed(() => {
    const config = aiStore.config
    return !!(config?.embedding?.api_key || config?.embedding?.base_url)
  })

  function getTagFilterOptions() {
    const dateRange = filterContext?.isDateFilterActive.value
      ? filterContext.dateRangeFilter.value
      : undefined
    return {
      dateRange,
      timeField: settingsStore.settings.time_field,
    }
  }

  // === View Mode Sync ===
  watch(viewMode, (mode) => {
    if (mode === 'favorites') {
      showFavoritesOnly.value = true
    } else {
      showFavoritesOnly.value = false
    }
  })

  watch(showFavoritesOnly, (val) => {
    if (val && viewMode.value !== 'favorites') {
      viewMode.value = 'favorites'
    } else if (!val && viewMode.value === 'favorites') {
      viewMode.value = 'feeds'
    }
  })

  // Clear selected entry when switching view modes
  watch(viewMode, () => {
    selectedFavoriteEntryId.value = null
  })

  /** Reset to the feeds view, clearing collection/tag selections. */
  function resetToFeeds() {
    viewMode.value = 'feeds'
    activeCollectionId.value = null
    activeTagId.value = null
    activeTagView.value = null
    selectedUnifiedEntryId.value = null
  }

  /** Switch to feeds mode if not already there (used by feed/group click). */
  function ensureFeedsMode() {
    if (viewMode.value !== 'feeds') {
      resetToFeeds()
    }
  }

  // === Collection Mode ===
  async function handleSelectCollection(collectionId: string) {
    viewMode.value = 'collection'
    activeCollectionId.value = collectionId
    activeTagId.value = null
    activeTagView.value = null
    collectionsStore.selectCollection(collectionId)
    await collectionsStore.fetchCollectionEntries(collectionId)
  }

  function handleToggleCollections() {
    if (viewMode.value === 'collection') {
      viewMode.value = 'feeds'
      activeCollectionId.value = null
    } else {
      viewMode.value = 'collection'
      activeTagId.value = null
      activeTagView.value = null
      if (collectionsStore.activeCollectionId) {
        activeCollectionId.value = collectionsStore.activeCollectionId
      }
    }
  }

  // === Tag Mode ===
  async function handleSelectTag(tagId: string) {
    viewMode.value = 'tag'
    activeTagId.value = tagId
    activeTagView.value = 'tag'
    activeCollectionId.value = null
    tagsStore.selectTag(tagId)
    await tagsStore.fetchEntriesByTag(tagId, true, getTagFilterOptions())
  }

  async function handleSelectTagView(view: 'pending' | 'untagged' | 'digest') {
    viewMode.value = 'tag'
    activeTagId.value = null
    activeTagView.value = view
    activeCollectionId.value = null
    if (view === 'digest') {
      // Digest view: no extra fetch, DigestView loads its own data
      return
    }
    tagsStore.setView(view)
    if (view === 'pending') {
      await tagsStore.fetchPendingEntries(true, getTagFilterOptions())
    } else {
      await tagsStore.fetchUntaggedEntries(true, getTagFilterOptions())
    }
  }

  function handleToggleTags() {
    if (viewMode.value === 'tag') {
      viewMode.value = 'feeds'
      activeTagId.value = null
      activeTagView.value = null
    } else {
      viewMode.value = 'tag'
      activeCollectionId.value = null
      activeTagView.value = 'pending'
      tagsStore.fetchTags()
      tagsStore.fetchStats()
      tagsStore.fetchPendingEntries(true, getTagFilterOptions())
    }
  }

  // === AI Search ===
  function handleToggleAISearch() {
    aiSearchActive.value = !aiSearchActive.value
    if (!aiSearchActive.value) {
      searchStore.clearSearch()
    }
  }

  async function handleAISearch(query: string) {
    if (!query.trim()) return
    await searchStore.search(query, searchStore.searchType)
  }

  return {
    viewMode,
    activeCollectionId,
    activeTagId,
    activeTagView,
    aiSearchActive,
    aiSearchEnabled,
    selectedUnifiedEntryId,

    resetToFeeds,
    ensureFeedsMode,
    handleSelectCollection,
    handleToggleCollections,
    handleSelectTag,
    handleSelectTagView,
    handleToggleTags,
    handleToggleAISearch,
    handleAISearch,
  }
}
