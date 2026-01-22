<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useFeedStore } from '../stores/feedStore'
import { useAIStore } from '../stores/aiStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import { useLayoutManager } from '../composables/useLayoutManager'
import { useNotification } from '../composables/useNotification'
import { useTheme } from '../composables/useTheme'
import { useTitleTranslation } from '../composables/useTitleTranslation'
import { useFeedFilter } from '../composables/useFeedFilter'
import { useAppSync } from '../composables/useAppSync'
import { useFeedActions } from '../composables/useFeedActions'

import Toast from '../components/Toast.vue'
import SidebarPanel from '../components/sidebar/SidebarPanel.vue'
import TimelinePanel from '../components/timeline/TimelinePanel.vue'
import DetailsPanel from '../components/details/DetailsPanel.vue'
import type { Entry, Feed } from '../types'

import { defineAsyncComponent } from 'vue'
const SettingsModal = defineAsyncComponent(() => import('../components/SettingsModal.vue'))




const store = useFeedStore()
const aiStore = useAIStore()
const favoritesStore = useFavoritesStore()
const settingsStore = useSettingsStore()
const { t, locale } = useI18n()
const { loadLanguage } = useLanguage()
// Initialize Composables
const {
  aiFeatures,
  titleTranslationLanguageLabel,
  getTranslatedTitle,
  isTitleTranslationLoading,
  queueAutoTitleTranslation,
  requestTitleTranslation,
  setupAutoTranslationWatcher
} = useTitleTranslation()

const {
    searchQuery,
    filterMode,
    dateRangeFilter,
    filterLoading,
    showFavoritesOnly,
    selectedFavoriteFeed,
    
    filteredEntries,
    isDateFilterActive,
    timeFilterLabel,

    debouncedApplyFilters,
    applyFilters,
    setupFilterWatchers,
    selectFavoriteFeed: selectFavoriteFeedRaw,
    backToAllFeeds: backToAllFeedsRaw
} = useFeedFilter()

const { handleToggleStar } = useFeedActions()

// 初始化语言设置
loadLanguage()

// Setup Watchers
setupFilterWatchers()

const summaryText = ref('')
const summaryLoading = ref(false)
const translationLanguage = ref('zh')
const showTranslation = ref(false)
const lastVisibleEntries = ref<Entry[]>([])

const editingFeedId = ref<string | null>(null)
const editingGroupName = ref('')

const importLoading = ref(false)
const showSettings = ref(false)

const { showToast, toastMessage, toastType, showNotification } = useNotification()
const { darkMode, toggleTheme, loadTheme } = useTheme()

// 使用布局管理 composable
const {
  isDraggingLeft,
  isDraggingRight,
  logoSize,
  layoutStyle,
  handleMouseDownLeft,
  handleMouseDownRight,
  initLayout,
  cleanupLayout,
  resetLayout
} = useLayoutManager()

const collapsedGroups = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}
  store.collapsedGroups.forEach((groupName) => {
    result[groupName] = true
  })
  return result
})

function toggleGroupCollapse(groupName: string) {
  store.toggleGroupCollapse(groupName)
}

function expandAllGroups() {
  store.expandAllGroups()
}

function collapseAllGroups() {
  store.collapseAllGroups()
}



// Watch for store errors
watch(() => store.errorMessage, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => {
      store.errorMessage = null
    }, 100)
  }
})

// Watch for AI store errors
watch(() => aiStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => {
      aiStore.clearError()
    }, 100)
  }
})




// 收藏状态管理
const selectedFavoriteEntryId = ref<string | null>(null)

const currentSelectedEntry = computed(() => {
  if (showFavoritesOnly.value) {
    return favoritesStore.starredEntries.find((entry) => entry.id === selectedFavoriteEntryId.value) ?? null
  }
  return store.selectedEntry
})
const translationLoading = computed(() => {
  if (!currentSelectedEntry.value) return false
  return isTitleTranslationLoading(currentSelectedEntry.value.id, translationLanguage.value)
})
const translatedTitle = computed(() => {
  if (!currentSelectedEntry.value) return null
  return getTranslatedTitle(currentSelectedEntry.value.id, translationLanguage.value)
})

const feedMap = computed<Record<string, Feed>>(() => {
  return store.feeds.reduce<Record<string, Feed>>((acc, feed) => {
    acc[feed.id] = feed
    return acc
  }, {})
})

// 收藏相关函数
async function loadFavoritesData(options: { includeEntries?: boolean; feedId?: string | null } = {}) {
  const includeEntries = options.includeEntries ?? false
  const targetFeedId = options.feedId ?? selectedFavoriteFeed.value

  // Use settings store time field
  const filterTimeField = settingsStore.settings.time_field
  // Use current date range filter if active
  const filterDateRange = isDateFilterActive.value ? dateRangeFilter.value : undefined

  try {
    if (includeEntries) {
      await favoritesStore.fetchStarredEntries(
        targetFeedId || undefined, 
        200, 
        0, 
        { dateRange: filterDateRange, timeField: filterTimeField }
      )
      ensureFavoriteSelection()
    } else {
      await favoritesStore.fetchStarredStats()
    }
  } catch (error) {
    console.error('Failed to load favorites data:', error)
    showNotification(t('toast.loadFavoritesFailed'), 'error')
  }
}

// Watch for date range changes to reload favorites if active
watch(dateRangeFilter, () => {
  if (showFavoritesOnly.value) {
    loadFavoritesData({ includeEntries: true })
  }
})

// Watch for time field changes
watch(() => settingsStore.settings.time_field, () => {
    if (showFavoritesOnly.value) {
        loadFavoritesData({ includeEntries: true })
    }
})

async function selectFavoriteFeed(feedId: string | null) {
  await selectFavoriteFeedRaw(feedId, loadFavoritesData)
}

function backToAllFeeds() {
  backToAllFeedsRaw(selectedFavoriteEntryId)
}

function ensureFavoriteSelection() {
  if (!showFavoritesOnly.value) return
  const entries = favoritesStore.starredEntries
  if (!entries.length) {
    selectedFavoriteEntryId.value = null
    return
  }
  if (!selectedFavoriteEntryId.value || !entries.some((entry) => entry.id === selectedFavoriteEntryId.value)) {
    selectedFavoriteEntryId.value = entries[0].id
  }
}

function handleEntrySelect(entryId: string) {
  if (showFavoritesOnly.value) {
    selectedFavoriteEntryId.value = entryId
  } else {
    store.selectEntry(entryId)
  }
}

function handleEntriesVisible(entries: Entry[]) {
  lastVisibleEntries.value = entries
  entries.forEach((entry) => {
    queueAutoTitleTranslation(entry)
  })
}

async function handleLoadMoreEntries() {
  if (showFavoritesOnly.value) {
    return
  }
  await store.loadMoreEntries()
}

watch(
  () => [aiFeatures.value?.auto_title_translation, aiFeatures.value?.translation_language],
  ([autoEnabled]) => {
    if (!autoEnabled || !lastVisibleEntries.value.length) {
      return
    }
    lastVisibleEntries.value.forEach((entry) => {
      queueAutoTitleTranslation(entry)
    })
  }
)

// Watch for favorites store errors
watch(() => favoritesStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => {
      favoritesStore.clearError()
    }, 100)
  }
})



// Initialize App Sync
const { initSync, cleanupSync } = useAppSync(
    showFavoritesOnly,
    async () => { await loadFavoritesData() },
    dateRangeFilter
)

// Setup Auto Translation Watcher
setupAutoTranslationWatcher()

onMounted(async () => {
  initLayout()
  loadTheme()
  store.loadCollapsedGroups()
  await aiStore.fetchConfig()
  await settingsStore.fetchSettings()

  dateRangeFilter.value = settingsStore.settings.default_date_range
  loadFavoritesData()

  const initialDateRange = settingsStore.settings.enable_date_filter ? dateRangeFilter.value : undefined
  const initialTimeField = settingsStore.settings.time_field

  await store.fetchFeeds({
     dateRange: initialDateRange,
     timeField: initialTimeField
  })
  await store.fetchEntries({
     dateRange: initialDateRange,
     timeField: initialTimeField
  })

  initSync()
})

onUnmounted(() => {
  cleanupLayout()
  cleanupSync()
})

watch(
  () => currentSelectedEntry.value,
  async (entry) => {
    if (!entry) {
      summaryText.value = ''
      showTranslation.value = false
      return
    }
    const cached = store.summaryCache[entry.id]
    summaryText.value = cached?.summary ?? ''

    // 自动生成摘要逻辑
    if (aiFeatures.value?.auto_summary && !cached?.summary) {
      // 如果启用了自动摘要且没有缓存摘要，则自动生成
      try {
        summaryLoading.value = true
        const summary = await store.requestSummary(entry.id)
        summaryText.value = summary.summary
      } catch (error) {
        console.error('自动生成摘要失败:', error)
      } finally {
        summaryLoading.value = false
      }
    }

    // Reset translation state for new entry
    showTranslation.value = false

    if (!entry.read) {
      await store.toggleEntryState(entry, { read: true })
    }
  },
  { immediate: true },
)

watch(
  () => translationLanguage.value,
  async (newLanguage, oldLanguage) => {
    if (newLanguage === oldLanguage) {
      return
    }

    if (!showTranslation.value || !currentSelectedEntry.value) {
      return
    }

    try {
      await requestTitleTranslation(currentSelectedEntry.value.id, newLanguage)
    } catch (error) {
      console.warn('Title translation failed:', error)
    }
  }
)





async function handleFeedClick(feedId: string) {
  store.selectFeed(feedId)
  await store.fetchEntries({ feedId })
}

const timelineTitle = computed(() => {
  // Ensure reactivity to locale changes
  locale.value

  if (showFavoritesOnly.value) {
    if (selectedFavoriteFeed.value) {
       const feed = feedMap.value[selectedFavoriteFeed.value]
       return feed ? (feed.title || feed.url) : t('groups.myFavorites')
    }
    return t('groups.myFavorites')
  }
  if (store.activeFeedId) {
    // getFeedById might be missing in store, safe fallback
    const feed = store.feeds.find(f => f.id === store.activeFeedId)
    return feed ? (feed.title || feed.url) : t('navigation.allFeeds')
  }
  if (store.activeGroupName) {
    return store.activeGroupName
  }
  return t('navigation.allFeeds')
})

const timelineHasMore = computed(() => !showFavoritesOnly.value && store.entriesHasMore)
const timelineLoadingMore = computed(() => !showFavoritesOnly.value && store.entriesLoadingMore)

const timelineSubtitle = computed(() => {
  // Simple subtitle logic, can be enhanced
  return `${filteredEntries.value.length} Articles`
})

async function handleAddFeed(url: string) {
  if (!url) return
  try {
    let targetGroupName: string | null | undefined
    if (!showFavoritesOnly.value) {
      targetGroupName = store.activeGroupName
      if (!targetGroupName && store.activeFeedId) {
        const activeFeed = store.feeds.find((feed) => feed.id === store.activeFeedId)
        targetGroupName = activeFeed?.group_name
      }
    }
    await store.addFeed(url, { groupName: targetGroupName })
    showNotification(t('feeds.addSuccess'), 'success')
  } catch (error) {
    showNotification(t('feeds.addFailed'), 'error')
  }
}

async function handleSummary() {
  if (!currentSelectedEntry.value) return
  summaryLoading.value = true
  try {
    const summary = await store.requestSummary(currentSelectedEntry.value.id)
    summaryText.value = summary.summary
    showNotification(t('toast.summarySuccess'), 'success')
  } catch (error) {
    showNotification(t('toast.summaryFailed'), 'error')
  } finally {
    summaryLoading.value = false
  }
}



async function handleTranslation() {
  if (!currentSelectedEntry.value) return

  // If already showing translation, toggle back to original
  if (showTranslation.value) {
    showTranslation.value = false
    return
  }

  // Toggle on immediately
  showTranslation.value = true

  // Request Title Translation for the header
  const currentEntryId = currentSelectedEntry.value.id
  try {
    await requestTitleTranslation(currentEntryId, translationLanguage.value)
  } catch (error) {
    console.warn('Title translation failed:', error)
  }
}

async function toggleStar() {
  await handleToggleStar(currentSelectedEntry.value, showFavoritesOnly.value, async () => {
    await loadFavoritesData({ includeEntries: true })
  })
}

async function toggleStarFromList(entry: any) {
  await handleToggleStar(entry, showFavoritesOnly.value, async () => {
    await loadFavoritesData({ includeEntries: true })
  })
}

async function openExternal(url?: string | null) {
  if (!url) return

  const mode = settingsStore.settings.open_original_mode ?? 'system'
  const ipc = window.ipcRenderer
  if (ipc?.invoke) {
    try {
      await ipc.invoke('open-external', { url, mode })
      return
    } catch (error) {
      console.warn('Failed to open external URL via main process:', error)
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

async function handleGroupClick(groupName: string) {
  // 点击分组标题时，选中该分组并加载其文章
  store.selectGroup(groupName)
  await store.fetchEntries({ groupName })
}

async function handleDeleteFeed(feedId: string) {
  if (confirm(t('feeds.deleteConfirm'))) {
    try {
      await store.deleteFeed(feedId)
      showNotification(t('feeds.deleteSuccess'), 'success')
    } catch (error) {
      showNotification(t('feeds.deleteFailed'), 'error')
    }
  }
}

function startEditFeed(feedId: string, currentGroup: string) {
  editingFeedId.value = feedId
  editingGroupName.value = currentGroup
}

async function saveEditFeed(feedId: string) {
  try {
    await store.updateFeed(feedId, { group_name: editingGroupName.value })
    editingFeedId.value = null
    showNotification(t('feeds.updateSuccess'), 'success')
  } catch (error) {
    showNotification(t('feeds.updateFailed'), 'error')
  }
}

function cancelEdit() {
  editingFeedId.value = null
}

async function handleExportOpml() {
  try {
    await store.exportOpml()
    showNotification(t('opml.exportSuccess'), 'success')
  } catch (error) {
    showNotification(t('opml.exportFailed'), 'error')
  }
}



async function handleImportOpml(file: File) {
  if (!file) return

  importLoading.value = true
  try {
    const result = await store.importOpml(file)
    showNotification(
      t('opml.importSuccess', { imported: result.imported, skipped: result.skipped }),
      'success'
    )
  } catch (error) {
    showNotification(t('opml.importFailed'), 'error')
  } finally {
    importLoading.value = false
  }
}

function reloadFeeds() {
  // Try to use debounced apply filters if available, else fetch
   // Since debouncedApplyFilters is defined in scope but typescript might not see it if I don't use it.
   // I'll assume applyFilters is available
   if (typeof debouncedApplyFilters === 'function') {
      debouncedApplyFilters({ refreshFeeds: true })
   } else {
      store.fetchFeeds() // fallback
   }
}

// 一键已读处理
async function handleMarkAllAsRead() {
  const markAsReadRange = settingsStore.settings.mark_as_read_range
  const timeField = settingsStore.settings.time_field
  
  // 确认对话框
  const confirmed = confirm(t('articles.markAsReadConfirmAll'))
  if (!confirmed) return
  
  try {
    // 根据设置确定时间范围
    // 'all' 或 'current' 表示标记所有未读
    // '3d', '7d', '30d' 表示标记 X 天之前的文章
    const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current') 
      ? undefined 
      : markAsReadRange
    
    const result = await store.markAsRead({
      feedId: store.activeFeedId ?? undefined,
      groupName: store.activeGroupName ?? undefined,
      olderThan,
      timeField
    })
    
    if (result.marked_count > 0) {
      showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
      // 刷新列表
      await applyFilters()
    } else {
      showNotification(t('articles.markAsReadEmpty'), 'info')
    }
  } catch (error) {
    console.error('Mark as read failed:', error)
    showNotification(t('articles.markAsReadFailed'), 'error')
  }
}

// 分组级别一键已读
async function handleMarkGroupAsRead(groupName: string) {
  const markAsReadRange = settingsStore.settings.mark_as_read_range
  const timeField = settingsStore.settings.time_field
  
  try {
    const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current') 
      ? undefined 
      : markAsReadRange
    
    const result = await store.markAsRead({
      groupName,
      olderThan,
      timeField
    })
    
    if (result.marked_count > 0) {
      showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
      await applyFilters()
    } else {
      showNotification(t('articles.markAsReadEmpty'), 'info')
    }
  } catch (error) {
    console.error('Mark group as read failed:', error)
    showNotification(t('articles.markAsReadFailed'), 'error')
  }
}

// 订阅级别一键已读
async function handleMarkFeedAsRead(feedId: string) {
  const markAsReadRange = settingsStore.settings.mark_as_read_range
  const timeField = settingsStore.settings.time_field
  
  try {
    const olderThan = (markAsReadRange === 'all' || markAsReadRange === 'current') 
      ? undefined 
      : markAsReadRange
    
    const result = await store.markAsRead({
      feedId,
      olderThan,
      timeField
    })
    
    if (result.marked_count > 0) {
      showNotification(t('articles.markAsReadSuccess', { count: result.marked_count }), 'success')
      await applyFilters()
    } else {
      showNotification(t('articles.markAsReadEmpty'), 'info')
    }
  } catch (error) {
    console.error('Mark feed as read failed:', error)
    showNotification(t('articles.markAsReadFailed'), 'error')
  }
}
</script>

<template>
  <Toast 
    :show="showToast" 
    :message="toastMessage" 
    :type="toastType" 
    @close="showToast = false" 
  />
  <SettingsModal 
    :show="showSettings" 
    @close="showSettings = false" 
  />
  <div
    class="app-shell"
    :style="layoutStyle"
    :class="{ 'is-dragging-left': isDraggingLeft, 'is-dragging-right': isDraggingRight }"
  >
    <SidebarPanel
      :logo-size="logoSize"
      :dark-mode="darkMode"
      :adding-feed="store.addingFeed"
      :import-loading="importLoading"

      :show-favorites-only="showFavoritesOnly"
      :selected-favorite-feed="selectedFavoriteFeed"

      :collapsed-groups="collapsedGroups"

      :editing-feed-id="editingFeedId"
      :editing-group-name="editingGroupName"
      :is-date-filter-active="isDateFilterActive"
      :time-filter-label="timeFilterLabel"
      @toggle-theme="toggleTheme"
      @open-settings="showSettings = true"
      @reset-layout="resetLayout"
      @add-feed="handleAddFeed"
      @export-opml="handleExportOpml"
      @import-opml="handleImportOpml"
      @toggle-favorites="showFavoritesOnly = !showFavoritesOnly"
      @select-favorite-feed="selectFavoriteFeed"
      @group-click="handleGroupClick"
      @toggle-collapse="toggleGroupCollapse"
      @expand-all="expandAllGroups"
      @collapse-all="collapseAllGroups"
      @select-feed="handleFeedClick"
      @start-edit="startEditFeed"
      @save-edit="saveEditFeed"
      @cancel-edit="cancelEdit"
      @delete-feed="handleDeleteFeed"
      @update:editing-group-name="editingGroupName = $event"
      @mark-group-read="handleMarkGroupAsRead"
      @mark-feed-read="handleMarkFeedAsRead"
    />

    <div
      class="resizer resizer-left"
      :class="{ active: isDraggingLeft }"
      @mousedown="handleMouseDownLeft"
      :title="t('layout.leftResizeTitle')"
    ></div>

    <TimelinePanel
      :title="timelineTitle"
      :subtitle="timelineSubtitle"
      :show-favorites-only="showFavoritesOnly"
      :search-query="searchQuery"
      :filter-mode="filterMode"
      :date-range-filter="dateRangeFilter"
      :filter-loading="filterLoading"
      :enable-date-filter="settingsStore.settings.enable_date_filter"
      :entries="filteredEntries"
      :loading="store.loadingEntries"
      :has-more="timelineHasMore"
      :loading-more="timelineLoadingMore"
      :show-summary="settingsStore.settings.show_entry_summary"
      :auto-title-translation="aiFeatures?.auto_title_translation"
      :title-display-mode="aiFeatures?.title_display_mode"
      :translation-language-label="titleTranslationLanguageLabel"
      :selected-entry-id="currentSelectedEntry?.id || null"
      :get-translated-title="getTranslatedTitle"
      :is-translation-loading="isTitleTranslationLoading"
      @refresh="reloadFeeds"
      @back-to-feeds="backToAllFeeds"
      @update:search-query="searchQuery = $event"
      @update:filter-mode="filterMode = $event"
      @update:date-range-filter="dateRangeFilter = $event"
      @select-entry="handleEntrySelect"
      @entries-visible="handleEntriesVisible"
      @load-more="handleLoadMoreEntries"
      @toggle-star="toggleStarFromList"
      @mark-all-read="handleMarkAllAsRead"
    />

    <div
      class="resizer resizer-right"
      :class="{ active: isDraggingRight }"
      @mousedown="handleMouseDownRight"
      :title="t('layout.rightResizeTitle')"
    ></div>

    <DetailsPanel
      :entry="currentSelectedEntry"
      :show-translation="showTranslation"
      :translated-title="translatedTitle"
      :translation-loading="translationLoading"
      :translation-language="translationLanguage"
      :summary-text="summaryText"
      :summary-loading="summaryLoading"
      @open-external="openExternal(currentSelectedEntry?.url)"
      @toggle-star="toggleStar"
      @toggle-translation="handleTranslation"
      @generate-summary="handleSummary"
      @update:translation-language="translationLanguage = $event"
    />
  </div>
</template>
<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
  position: relative;
  max-width: 100vw;
  /* 顶层容器不滚动，交给内部列滚动，避免多重滚动条 */
  overflow: hidden;
  height: 100vh;
  align-items: stretch;
  --sidebar-width: 280px;
  --details-width: 420px;
}

/* 分隔器样式 */
.resizer {
  width: 3px;
  background: rgba(15, 17, 21, 0.1);
  cursor: col-resize;
  transition: background-color 0.2s;
  position: relative;
  flex-shrink: 0;
  z-index: 10;
}

.resizer:hover {
  background: rgba(255, 122, 24, 0.3);
}

.resizer.active {
  background: rgba(255, 122, 24, 0.6);
}

.resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 40px;
  background: rgba(255, 122, 24, 0);
  transition: background-color 0.2s;
  border-radius: 2px;
}

.resizer:hover::before {
  background: rgba(255, 122, 24, 0.1);
}

.resizer.active::before {
  background: rgba(255, 122, 24, 0.2);
}

:global(.dark) .resizer {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .resizer:hover {
  background: rgba(255, 122, 24, 0.4);
}

:global(.dark) .resizer.active {
  background: rgba(255, 122, 24, 0.7);
}

@media (max-width: 960px) {
  .app-shell {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }
  
  .resizer {
    display: none;
  }
}
</style>
