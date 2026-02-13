/**
 * Timeline Data Composable
 *
 * Provides the unified entries list, loading/hasMore state,
 * and timeline header strings for the TimelinePanel component.
 */

import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../stores/feedStore'
import { useCollectionsStore } from '../stores/collectionsStore'
import { useTagsStore } from '../stores/tagsStore'
import { useSearchStore } from '../stores/searchStore'
import { collectionEntryToEntry, tagEntryToEntry, searchResultToEntry } from '../utils/entryAdapter'
import type { Entry, Feed } from '../types'
import type { ViewMode } from './useViewMode'

export function useTimelineData(options: {
  viewMode: Ref<ViewMode>
  aiSearchActive: Ref<boolean>
  showFavoritesOnly: Ref<boolean>
  selectedFavoriteFeed: Ref<string | null>
  activeTagId: Ref<string | null>
  activeTagView: Ref<'tag' | 'pending' | 'untagged' | null>
  filteredEntries: Ref<Entry[]>
}) {
  const {
    viewMode,
    aiSearchActive,
    showFavoritesOnly,
    selectedFavoriteFeed,
    activeTagId,
    activeTagView,
    filteredEntries,
  } = options

  const store = useFeedStore()
  const collectionsStore = useCollectionsStore()
  const tagsStore = useTagsStore()
  const searchStore = useSearchStore()
  const { t, locale } = useI18n()

  // === Entry adapters ===
  const collectionEntriesAsEntry = computed<Entry[]>(() =>
    collectionsStore.collectionEntries.map(collectionEntryToEntry),
  )
  const tagEntriesAsEntry = computed<Entry[]>(() =>
    tagsStore.entries.map(tagEntryToEntry),
  )
  const searchEntriesAsEntry = computed<Entry[]>(() =>
    searchStore.results.map(searchResultToEntry),
  )

  // === Feed map ===
  const feedMap = computed<Record<string, Feed>>(() => {
    return store.feeds.reduce<Record<string, Feed>>((acc, feed) => {
      acc[feed.id] = feed
      return acc
    }, {})
  })

  // === Unified entries ===
  const unifiedEntries = computed<Entry[]>(() => {
    if (aiSearchActive.value && searchStore.hasSearched) {
      return searchEntriesAsEntry.value
    }
    switch (viewMode.value) {
      case 'collection':
        return collectionEntriesAsEntry.value
      case 'tag':
        return tagEntriesAsEntry.value
      default:
        return filteredEntries.value
    }
  })

  const unifiedLoading = computed(() => {
    if (aiSearchActive.value && searchStore.loading) return true
    switch (viewMode.value) {
      case 'collection':
        return collectionsStore.loading
      case 'tag':
        return tagsStore.loading
      default:
        return store.loadingEntries
    }
  })

  // === Timeline header ===
  const timelineTitle = computed(() => {
    // Ensure reactivity to locale changes
    locale.value

    if (aiSearchActive.value && searchStore.hasSearched) {
      return t('search.resultsCount', { count: searchStore.results.length })
    }
    if (viewMode.value === 'collection') {
      const collection = collectionsStore.activeCollection
      return collection ? collection.name : t('collections.title')
    }
    if (viewMode.value === 'tag') {
      if (activeTagView.value === 'pending') return t('tags.pending')
      if (activeTagView.value === 'untagged') return t('tags.untagged')
      const tag = tagsStore.selectedTag
      return tag ? tag.name : t('tags.title')
    }
    if (showFavoritesOnly.value) {
      if (selectedFavoriteFeed.value) {
        const feed = feedMap.value[selectedFavoriteFeed.value]
        return feed ? (feed.title || feed.url) : t('groups.myFavorites')
      }
      return t('groups.myFavorites')
    }
    if (store.activeFeedId) {
      const feed = store.feeds.find(f => f.id === store.activeFeedId)
      return feed ? (feed.title || feed.url) : t('navigation.allFeeds')
    }
    if (store.activeGroupName) {
      return store.activeGroupName
    }
    return t('navigation.allFeeds')
  })

  const timelineSubtitle = computed(() => {
    return `${unifiedEntries.value.length} Articles`
  })

  const timelineHasMore = computed(() => {
    if (viewMode.value === 'collection') return false
    if (viewMode.value === 'tag') return tagsStore.hasMore
    return (!showFavoritesOnly.value && store.entriesHasMore === true) || false
  })

  const timelineLoadingMore = computed(() => {
    if (viewMode.value === 'collection') return false
    if (viewMode.value === 'tag') return false
    return (!showFavoritesOnly.value && store.entriesLoadingMore === true) || false
  })

  const timelineViewType = computed(() => {
    if (!store.activeFeedId && !store.activeGroupName) {
      return store.activeViewType
    }
    if (store.activeFeedId) {
      const feed = store.feeds.find(f => f.id === store.activeFeedId)
      return feed?.view_type || 'articles'
    }
    if (store.activeGroupName) {
      return store.activeViewType
    }
    return 'articles'
  })

  // === Load more ===
  async function handleLoadMoreEntries() {
    if (viewMode.value === 'tag' && tagsStore.hasMore) {
      if (activeTagView.value === 'pending') {
        await tagsStore.fetchPendingEntries()
      } else if (activeTagView.value === 'untagged') {
        await tagsStore.fetchUntaggedEntries()
      } else if (activeTagId.value) {
        await tagsStore.fetchEntriesByTag(activeTagId.value)
      }
      return
    }
    if (viewMode.value === 'collection' || showFavoritesOnly.value) {
      return
    }
    await store.loadMoreEntries()
  }

  return {
    feedMap,
    collectionEntriesAsEntry,
    tagEntriesAsEntry,
    searchEntriesAsEntry,
    unifiedEntries,
    unifiedLoading,
    timelineTitle,
    timelineSubtitle,
    timelineHasMore,
    timelineLoadingMore,
    timelineViewType,
    handleLoadMoreEntries,
  }
}
