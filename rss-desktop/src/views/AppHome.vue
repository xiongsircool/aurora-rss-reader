<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

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
import { useArticleTranslation } from '../composables/useArticleTranslation'

import Toast from '../components/Toast.vue'
import SidebarPanel from '../components/sidebar/SidebarPanel.vue'
import TimelinePanel from '../components/timeline/TimelinePanel.vue'
import DetailsPanel from '../components/details/DetailsPanel.vue'
import type { Entry, Feed } from '../types'

import { defineAsyncComponent } from 'vue'
const SettingsModal = defineAsyncComponent(() => import('../components/SettingsModal.vue'))
const AddToBookmarkGroupModal = defineAsyncComponent(() => import('../components/collections/AddToCollectionModal.vue'))




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
  isTitleTranslationFailed,
  registerAutoRetryHandler,
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

// Setup Watchers
setupFilterWatchers()

const summaryText = ref('')
const summaryLoading = ref(false)
const translationLanguage = ref('zh')
const lastVisibleEntries = ref<Entry[]>([])
const cleanupTitleTranslationAutoRetry = registerAutoRetryHandler((entryId, language) => {
  if (!aiFeatures.value?.auto_title_translation) {
    return
  }
  const entry = lastVisibleEntries.value.find((item) => item.id === entryId)
  if (!entry) {
    return
  }
  queueAutoTitleTranslation(entry, language)
})

const editingFeedId = ref<string | null>(null)
const editingGroupName = ref('')

const importLoading = ref(false)
const showSettings = ref(false)
const showBookmarkGroupModal = ref(false)
const bookmarkGroupEntryId = ref<string | null>(null)

const { showToast, toastMessage, toastType, showNotification } = useNotification()
const { darkMode, toggleTheme, loadTheme } = useTheme()

// 使用布局管理 composable
const {
  isDraggingLeft,
  isDraggingRight,
  logoSize,
  detailsWidth,
  viewportWidth,
  layoutStyle,
  handleMouseDownLeft,
  handleMouseDownRight,
  initLayout,
  cleanupLayout,
  resetLayout
} = useLayoutManager()

type DetailsPanelMode = 'docked' | 'click'
type DetailsPresentation = 'docked' | 'drawer' | 'fullscreen'

const DETAILS_FULLSCREEN_BREAKPOINT = 960
const DETAILS_DRAWER_BREAKPOINT = 1200

const detailsPanelMode = computed<DetailsPanelMode>(() => {
  return settingsStore.settings.details_panel_mode === 'click' ? 'click' : 'docked'
})

const detailsPresentation = computed<DetailsPresentation>(() => {
  const width = viewportWidth.value
  if (width <= DETAILS_FULLSCREEN_BREAKPOINT) {
    return 'fullscreen'
  }
  if (width <= DETAILS_DRAWER_BREAKPOINT) {
    return 'drawer'
  }
  return detailsPanelMode.value === 'click' ? 'drawer' : 'docked'
})

const isDetailsOpen = ref(false)
const timelineScroller = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

const isSingleColumn = computed(() => viewportWidth.value <= DETAILS_FULLSCREEN_BREAKPOINT)

let previousBodyOverflow = ''
let previousBodyPaddingRight = ''
let bodyScrollLocked = false

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

const showDetailsOverlay = computed(() => {
  if (detailsPresentation.value === 'docked') {
    return false
  }
  return isDetailsOpen.value && !!currentSelectedEntry.value
})

const showBackToTopButton = computed(() => {
  return isSingleColumn.value && showBackToTop.value && !showDetailsOverlay.value
})

const detailsOverlayWidth = computed(() => {
  if (detailsPresentation.value === 'fullscreen') {
    return '100vw'
  }
  const maxWidth = Math.min(detailsWidth.value, Math.round(viewportWidth.value * 0.92))
  return `${maxWidth}px`
})

const detailsOverlayStyle = computed(() => ({
  width: detailsOverlayWidth.value,
  '--details-width': detailsOverlayWidth.value,
}))

function getContentTextLength(html?: string | null): number {
  if (!html) return 0
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const text = doc.body?.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim().length
}

function selectTranslationContent(entry: Entry | null): string | null {
  if (!entry) return null
  const candidates = [
    { value: entry.readability_content, priority: 3 },
    { value: entry.content, priority: 2 },
    { value: entry.summary, priority: 1 },
  ]

  let best: { value: string; length: number; priority: number } | null = null

  for (const candidate of candidates) {
    if (!candidate.value) continue
    const length = getContentTextLength(candidate.value)
    if (!best || length > best.length || (length === best.length && candidate.priority > best.priority)) {
      best = { value: candidate.value, length, priority: candidate.priority }
    }
  }

  if (best && best.length > 0) {
    return best.value
  }

  return entry.readability_content ?? entry.content ?? entry.summary ?? null
}

// 全文翻译相关状态
const currentEntryId = computed(() => currentSelectedEntry.value?.id ?? null)
const currentEntryContent = computed(() => selectTranslationContent(currentSelectedEntry.value ?? null))

const {
  progress: fullTextTranslationProgress,
  blocks: fullTextTranslationBlocks,
  isTranslating: isFullTextTranslating,
  showTranslation: showFullTextTranslation,
  translatableBlocks: fullTextTranslatableBlocks,
  getTranslation: getFullTextTranslation,
  isBlockLoading: isFullTextBlockLoading,
  isBlockFailed: isFullTextBlockFailed,
  toggleTranslation: toggleFullTextTranslationRaw,
} = useArticleTranslation(currentEntryId, currentEntryContent, translationLanguage)

// 翻译后的标题
const translatedTitle = computed(() => {
  if (!currentSelectedEntry.value) return null
  return getTranslatedTitle(currentSelectedEntry.value.id, translationLanguage.value)
})


// 全文翻译（包含标题翻译）
async function handleFullTextTranslation() {
  const wasShowing = showFullTextTranslation.value
  toggleFullTextTranslationRaw()

  // 如果是开启翻译，同时翻译标题
  if (!wasShowing && currentSelectedEntry.value) {
    await nextTick()
    if (fullTextTranslatableBlocks.value.length === 0) {
      showNotification(t('toast.translationNoText'), 'info')
    }

    try {
      await requestTitleTranslation(currentSelectedEntry.value.id, translationLanguage.value)
    } catch (error) {
      console.warn('Title translation failed:', error)
    }
  }
}

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

function openDetails() {
  if (detailsPresentation.value === 'docked') {
    return
  }
  isDetailsOpen.value = true
}

function closeDetails() {
  isDetailsOpen.value = false
}

function lockBodyScroll() {
  if (bodyScrollLocked || typeof document === 'undefined') return
  const body = document.body
  const root = document.documentElement
  if (!body || !root) return
  previousBodyOverflow = body.style.overflow
  previousBodyPaddingRight = body.style.paddingRight
  const scrollbarWidth = window.innerWidth - root.clientWidth
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
  body.style.overflow = 'hidden'
  bodyScrollLocked = true
}

function unlockBodyScroll() {
  if (!bodyScrollLocked || typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  body.style.overflow = previousBodyOverflow
  body.style.paddingRight = previousBodyPaddingRight
  bodyScrollLocked = false
}

function updateBackToTopVisibility() {
  if (typeof window === 'undefined') return
  const windowTop = window.scrollY || 0
  const scrollerTop = timelineScroller.value?.scrollTop ?? 0
  showBackToTop.value = Math.max(windowTop, scrollerTop) > 320
}

function scrollToTop() {
  timelineScroller.value?.scrollTo({ top: 0, behavior: 'smooth' })
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleEntrySelect(entryId: string) {
  if (showFavoritesOnly.value) {
    selectedFavoriteEntryId.value = entryId
  } else {
    store.selectEntry(entryId)
  }
  openDetails()
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

watch(detailsPresentation, (presentation) => {
  if (presentation === 'docked') {
    isDetailsOpen.value = false
  }
})

watch(
  () => currentSelectedEntry.value,
  (entry) => {
    if (!entry) {
      isDetailsOpen.value = false
    }
  }
)

watch(
  () => showDetailsOverlay.value,
  (visible) => {
    if (visible) {
      lockBodyScroll()
    } else {
      unlockBodyScroll()
    }
  },
  { immediate: true }
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

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
  nextTick(() => {
    timelineScroller.value = document.querySelector('.timeline__list') as HTMLElement | null
    timelineScroller.value?.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
    updateBackToTopVisibility()
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', updateBackToTopVisibility)
  }
  timelineScroller.value?.removeEventListener('scroll', updateBackToTopVisibility)
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
  try {
    await settingsStore.fetchSettings()
  } catch (error) {
    // Continue with defaults/local storage when settings fetch fails.
  }
  await loadLanguage()
  await aiStore.fetchConfig()

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
  cleanupTitleTranslationAutoRetry()
  cleanupLayout()
  cleanupSync()
  unlockBodyScroll()
})

watch(
  () => currentSelectedEntry.value,
  async (entry) => {
    if (!entry) {
      summaryText.value = ''
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

    if (!currentSelectedEntry.value) {
      return
    }

    if (!showFullTextTranslation.value) {
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

const timelineHasMore = computed(() => (!showFavoritesOnly.value && store.entriesHasMore === true) || false)
const timelineLoadingMore = computed(() => (!showFavoritesOnly.value && store.entriesLoadingMore === true) || false)

const timelineSubtitle = computed(() => {
  // Simple subtitle logic, can be enhanced
  return `${filteredEntries.value.length} Articles`
})

// Get current view type from store (used for view type filtering mode)
const timelineViewType = computed(() => {
  // When filtering by view type (no specific feed/group selected)
  if (!store.activeFeedId && !store.activeGroupName) {
    return store.activeViewType
  }
  // When viewing a specific feed, use that feed's view type
  if (store.activeFeedId) {
    const feed = store.feeds.find(f => f.id === store.activeFeedId)
    return feed?.view_type || 'articles'
  }
  // When viewing a group, keep the current active view type
  if (store.activeGroupName) {
    return store.activeViewType
  }
  // Default to articles
  return 'articles'
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

// Right-click menu handlers
function handleAddToBookmarkGroup(entry: Entry) {
  bookmarkGroupEntryId.value = entry.id
  showBookmarkGroupModal.value = true
}

async function handleToggleReadFromList(entry: Entry) {
  await store.toggleEntryState(entry, { read: !entry.read })
}

function handleCopyLink(entry: Entry) {
  if (entry.url) {
    navigator.clipboard.writeText(entry.url)
    showNotification(t('articles.linkCopied'), 'success')
  }
}

function handleOpenExternal(entry: Entry) {
  if (entry.url) {
    window.open(entry.url, '_blank')
  }
}

function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return `https://${trimmed}`
}

async function openExternal(url?: string | null) {
  if (!url) return

  const normalizedUrl = normalizeExternalUrl(url)
  if (!normalizedUrl) return

  const mode = settingsStore.settings.open_original_mode ?? 'system'
  const ipc = window.ipcRenderer

  if (ipc?.invoke) {
    try {
      const result = await ipc.invoke('open-external', { url: normalizedUrl, mode }) as { success?: boolean; error?: string }
      if (result?.success) {
        return
      }
    } catch (error) {
      // Fallback to window.open on error
    }
  }

  // Fallback to window.open
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
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

// 切换视图类型
async function handleSelectViewType(viewType: string) {
  store.selectViewType(viewType as any)
  await store.fetchEntries({
    viewType: viewType as any,
    unreadOnly: filterMode.value === 'unread',
    dateRange: dateRangeFilter.value,
    timeField: settingsStore.settings.time_field,
  })
}

// 修改订阅源的视图类型
async function handleChangeViewType(feedId: string, viewType: string) {
  try {
    await store.updateFeedViewType(feedId, viewType as any)
    showNotification(t('feeds.viewTypeChanged'), 'success')
  } catch (error) {
    console.error('Change view type failed:', error)
    showNotification(t('feeds.viewTypeChangeFailed'), 'error')
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
  <AddToBookmarkGroupModal
    v-if="bookmarkGroupEntryId"
    :show="showBookmarkGroupModal"
    :entry-id="bookmarkGroupEntryId"
    @close="showBookmarkGroupModal = false; bookmarkGroupEntryId = null"
    @added="showNotification(t('collections.addSuccess'), 'success')"
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
      @select-view-type="handleSelectViewType"
      @change-view-type="handleChangeViewType"
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
      :view-type="timelineViewType"
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
      :is-translation-failed="isTitleTranslationFailed"
      @refresh="reloadFeeds"
      @back-to-feeds="backToAllFeeds"
      @update:search-query="searchQuery = $event"
      @update:filter-mode="filterMode = $event"
      @update:date-range-filter="dateRangeFilter = $event"
      @select-entry="handleEntrySelect"
      @entries-visible="handleEntriesVisible"
      @load-more="handleLoadMoreEntries"
      @toggle-star="toggleStarFromList"
      @toggle-read="handleToggleReadFromList"
      @add-to-bookmark-group="handleAddToBookmarkGroup"
      @copy-link="handleCopyLink"
      @open-external="handleOpenExternal"
      @mark-all-read="handleMarkAllAsRead"
    />

    <div
      v-if="detailsPresentation === 'docked'"
      class="resizer resizer-right"
      :class="{ active: isDraggingRight }"
      @mousedown="handleMouseDownRight"
      :title="t('layout.rightResizeTitle')"
    ></div>

    <DetailsPanel
      v-if="detailsPresentation === 'docked'"
      :entry="currentSelectedEntry"
      :translated-title="translatedTitle"
      :translation-language="translationLanguage"
      :summary-text="summaryText"
      :summary-loading="summaryLoading"
      :full-text-translation-blocks="fullTextTranslationBlocks"
      :is-full-text-translating="isFullTextTranslating"
      :show-full-text-translation="showFullTextTranslation"
      :full-text-translation-progress="fullTextTranslationProgress"
      :get-full-text-translation="getFullTextTranslation"
      :is-full-text-block-loading="isFullTextBlockLoading"
      :is-full-text-block-failed="isFullTextBlockFailed"
      @open-external="openExternal(currentSelectedEntry?.url)"
      @toggle-star="toggleStar"
      @generate-summary="handleSummary"
      @update:translation-language="translationLanguage = $event"
      @toggle-full-text-translation="handleFullTextTranslation"
    />
  </div>

  <Teleport to="body">
    <div v-if="showDetailsOverlay" class="details-overlay" @click="closeDetails">
      <div class="details-overlay__backdrop"></div>
      <div
        class="details-overlay__panel"
        :class="{ 'is-fullscreen': detailsPresentation === 'fullscreen' }"
        :style="detailsOverlayStyle"
        @click.stop
        @wheel.stop
        @touchmove.stop
      >
        <div class="details-overlay__toolbar">
          <button class="details-overlay__close" type="button" @click="closeDetails">
            {{ detailsPresentation === 'fullscreen' ? t('common.back') : t('common.close') }}
          </button>
        </div>
        <div class="details-overlay__content">
          <DetailsPanel
            in-overlay
            :entry="currentSelectedEntry"
            :translated-title="translatedTitle"
            :translation-language="translationLanguage"
            :summary-text="summaryText"
            :summary-loading="summaryLoading"
            :full-text-translation-blocks="fullTextTranslationBlocks"
            :is-full-text-translating="isFullTextTranslating"
            :show-full-text-translation="showFullTextTranslation"
            :full-text-translation-progress="fullTextTranslationProgress"
            :get-full-text-translation="getFullTextTranslation"
            :is-full-text-block-loading="isFullTextBlockLoading"
            :is-full-text-block-failed="isFullTextBlockFailed"
            @open-external="openExternal(currentSelectedEntry?.url)"
            @toggle-star="toggleStar"
            @generate-summary="handleSummary"
            @update:translation-language="translationLanguage = $event"
            @toggle-full-text-translation="handleFullTextTranslation"
          />
        </div>
      </div>
    </div>
  </Teleport>

  <button
    v-if="showBackToTopButton"
    class="back-to-top"
    type="button"
    :title="t('common.backToTop')"
    :aria-label="t('common.backToTop')"
    @click="scrollToTop"
  >
    <svg class="back-to-top__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5l-7 7 1.4 1.4L11 8.8V19h2V8.8l4.6 4.6L19 12z"
        fill="currentColor"
      />
    </svg>
  </button>
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

.details-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
  overscroll-behavior: contain;
}

.details-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 12, 18, 0.35);
  backdrop-filter: blur(4px);
}

.details-overlay__panel {
  position: relative;
  height: 100%;
  max-width: 100vw;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  box-shadow: -12px 0 30px rgba(15, 17, 21, 0.2);
  z-index: 1;
  animation: details-slide-in 0.22s ease-out;
}

.details-overlay__panel.is-fullscreen {
  border-left: none;
  box-shadow: none;
}

.details-overlay__toolbar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.details-overlay__close {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 999px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.details-overlay__close:hover {
  background: rgba(255, 122, 24, 0.15);
}

.details-overlay__content {
  flex: 1;
  min-height: 0;
}

.back-to-top {
  position: fixed;
  right: 20px;
  bottom: 24px;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  display: grid;
  place-items: center;
  box-shadow: 0 10px 24px rgba(15, 17, 21, 0.18);
  z-index: 1100;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.back-to-top:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(15, 17, 21, 0.22);
  background: rgba(255, 122, 24, 0.1);
}

.back-to-top__icon {
  width: 20px;
  height: 20px;
}

@keyframes details-slide-in {
  from {
    transform: translateX(12%);
    opacity: 0.6;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
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
