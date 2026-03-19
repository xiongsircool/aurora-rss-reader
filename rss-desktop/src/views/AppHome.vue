<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useFeedStore } from '../stores/feedStore'
import { useAIStore } from '../stores/aiStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCollectionsStore } from '../stores/collectionsStore'
import { useTagsStore } from '../stores/tagsStore'
import { useSearchStore } from '../stores/searchStore'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import { useLayoutManager } from '../composables/useLayoutManager'
import { useNotification } from '../composables/useNotification'
import { useTheme } from '../composables/useTheme'
import { useFeedFilter } from '../composables/useFeedFilter'
import { useAppSync } from '../composables/useAppSync'
import { useFeedActions } from '../composables/useFeedActions'
import { useViewMode } from '../composables/useViewMode'
import { useDetailsPanel } from '../composables/useDetailsPanel'
import { useTimelineData } from '../composables/useTimelineData'
import { useFeedManagement } from '../composables/useFeedManagement'
import { useEntryAI } from '../composables/useEntryAI'
import type { AutomationTarget } from '../composables/useSettingsModal'

import Toast from '../components/Toast.vue'
import ConfirmModal from '../components/common/ConfirmModal.vue'
import SidebarPanel from '../components/sidebar/SidebarPanel.vue'
import TimelinePanel from '../components/timeline/TimelinePanel.vue'
import TimelineHeader from '../components/timeline/TimelineHeader.vue'
import DigestView from '../components/tags/DigestView.vue'
import ScopeSummaryView from '../components/summaries/ScopeSummaryView.vue'
import DetailsPanel from '../components/details/DetailsPanel.vue'
import type { Entry } from '../types'

import { defineAsyncComponent } from 'vue'
const SettingsModal = defineAsyncComponent(() => import('../components/SettingsModal.vue'))
const AddToBookmarkGroupModal = defineAsyncComponent(() => import('../components/collections/AddToCollectionModal.vue'))

// === Stores ===
const store = useFeedStore()
const aiStore = useAIStore()
const favoritesStore = useFavoritesStore()
const settingsStore = useSettingsStore()
const collectionsStore = useCollectionsStore()
const tagsStore = useTagsStore()
const searchStore = useSearchStore()
const { t } = useI18n()
const { loadLanguage } = useLanguage()
const SUBSCRIPTION_DATE_RANGE_KEY = 'date-range:feeds'
const FAVORITES_DATE_RANGE_KEY = 'date-range:favorites'
const TAGS_DATE_RANGE_KEY = 'date-range:tags'

function readSavedDateRange(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function writeSavedDateRange(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// === Feed Filter ===
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
  backToAllFeeds: backToAllFeedsRaw,
} = useFeedFilter()

const { handleToggleStar } = useFeedActions()
setupFilterWatchers()

const subscriptionDateRange = ref('30d')
const favoritesDateRange = ref('30d')
const tagsDateRange = ref('30d')
const compactTimelineFilterDensity = computed(
  () => settingsStore.settings.timeline_filter_density === 'compact'
)

// === View Mode ===
const selectedFavoriteEntryId = ref<string | null>(null)
const {
  viewMode,
  activeCollectionId,
  activeTagId,
  activeTagView,
  aiSearchActive,
  aiSearchEnabled,
  selectedUnifiedEntryId,
  ensureFeedsMode,
  handleSelectCollection,
  handleToggleCollections,
  handleSelectTag: handleSelectTagRaw,
  handleSelectTagView: handleSelectTagViewRaw,
  handleToggleTags: handleToggleTagsRaw,
  handleToggleAISearch,
  handleAISearch,
} = useViewMode(showFavoritesOnly, selectedFavoriteEntryId, {
  dateRangeFilter,
  isDateFilterActive,
})

const comboFilterTagIds = ref<string[]>([])
const comboFilterMode = ref<'and' | 'or'>('or')
const comboFilterActive = computed(() => comboFilterTagIds.value.length > 0)
const comboFilterPrevContext = ref<{ activeTagId: string | null; activeTagView: 'tag' | 'pending' | 'untagged' | 'digest' | null } | null>(null)

function clearComboFilterState() {
  comboFilterTagIds.value = []
  comboFilterMode.value = 'or'
  comboFilterPrevContext.value = null
}

async function handleSelectTag(tagId: string) {
  clearComboFilterState()
  await handleSelectTagRaw(tagId)
}

async function handleSelectTagView(view: 'pending' | 'untagged' | 'digest') {
  clearComboFilterState()
  await handleSelectTagViewRaw(view)
}

function handleToggleTags() {
  clearComboFilterState()
  handleToggleTagsRaw()
}

async function handleApplyTagCombo(tagIds: string[], mode: 'and' | 'or') {
  if (!tagIds.length) return
  if (!comboFilterActive.value) {
    comboFilterPrevContext.value = {
      activeTagId: activeTagId.value,
      activeTagView: activeTagView.value,
    }
  }
  comboFilterTagIds.value = tagIds
  comboFilterMode.value = mode
  viewMode.value = 'tag'
  activeCollectionId.value = null
  activeTagId.value = null
  activeTagView.value = 'tag'
  tagsStore.selectTag(null)
  await tagsStore.fetchFilteredEntries(tagIds, mode, true)
}

async function handleClearTagCombo() {
  if (!comboFilterActive.value) return
  const prev = comboFilterPrevContext.value
  clearComboFilterState()

  const tagOptions = {
    dateRange: isDateFilterActive.value ? dateRangeFilter.value : undefined,
    timeField: settingsStore.settings.time_field,
  }

  if (prev?.activeTagView === 'pending') {
    activeTagId.value = null
    activeTagView.value = 'pending'
    tagsStore.setView('pending')
    await tagsStore.fetchPendingEntries(true, tagOptions)
    return
  }

  if (prev?.activeTagView === 'untagged') {
    activeTagId.value = null
    activeTagView.value = 'untagged'
    tagsStore.setView('untagged')
    await tagsStore.fetchUntaggedEntries(true, tagOptions)
    return
  }

  if (prev?.activeTagId) {
    activeTagId.value = prev.activeTagId
    activeTagView.value = 'tag'
    tagsStore.selectTag(prev.activeTagId)
    await tagsStore.fetchEntriesByTag(prev.activeTagId, true, tagOptions)
    return
  }

  activeTagId.value = null
  activeTagView.value = 'pending'
  tagsStore.setView('pending')
  await tagsStore.fetchPendingEntries(true, tagOptions)
}

// === Entry Selection ===
// Store for digest/summary entry selection (entries from digest view that may not be in tagEntriesAsEntry)
const selectedDigestEntry = ref<Entry | null>(null)

const currentSelectedEntry = computed<Entry | null>(() => {
  // Check digest entry first (e.g., when clicking citations in DigestView or ScopeSummaryView)
  if (selectedDigestEntry.value) return selectedDigestEntry.value

  if (viewMode.value === 'collection') {
    if (!selectedUnifiedEntryId.value) return null
    return collectionEntriesAsEntry.value.find(e => e.id === selectedUnifiedEntryId.value) ?? null
  }
  if (viewMode.value === 'tag') {
    if (!selectedUnifiedEntryId.value) return null
    // First check tag timeline entries
    const entry = tagEntriesAsEntry.value.find(e => e.id === selectedUnifiedEntryId.value) ?? null
    if (entry) return entry
    // Fallback: check feed store entries (e.g., entries from DigestView citations)
    return store.selectedEntry?.id === selectedUnifiedEntryId.value ? store.selectedEntry : null
  }
  if (showFavoritesOnly.value) {
    return favoritesStore.starredEntries.find((entry) => entry.id === selectedFavoriteEntryId.value) ?? null
  }
  return store.selectedEntry
})

// === Layout ===
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
  resetLayout,
} = useLayoutManager()

// === Details Panel ===
const {
  isDetailsOpen,
  detailsPresentation,
  showDetailsOverlay,
  showBackToTopButton,
  detailsOverlayStyle,
  openDetails,
  closeDetails,
  unlockBodyScroll,
  scrollToTop,
  setupScrollListeners,
  cleanupScrollListeners,
} = useDetailsPanel(viewportWidth, detailsWidth, currentSelectedEntry)

// Close details when switching view modes
watch(viewMode, () => { isDetailsOpen.value = false })
watch([viewMode, showFavoritesOnly], ([mode, favoritesOnly]) => {
  if (mode !== 'feeds' || favoritesOnly) {
    feedDetailMode.value = 'articles'
  }
})

// === Timeline Data ===
const {
  collectionEntriesAsEntry,
  tagEntriesAsEntry,
  unifiedEntries,
  unifiedLoading,
  timelineTitle,
  timelineSubtitle,
  timelineHasMore,
  timelineLoadingMore,
  timelineViewType,
  handleLoadMoreEntries,
} = useTimelineData({
  viewMode,
  aiSearchActive,
  showFavoritesOnly,
  selectedFavoriteFeed,
  activeTagId,
  activeTagView,
  filteredEntries,
  dateRangeFilter,
  isDateFilterActive,
  comboFilterActive,
  comboFilterTagIds,
  comboFilterMode,
})

// === Feed Management ===
const {
  confirmShow,
  confirmOptions,
  handleConfirm,
  handleCancel,
  editingFeedId,
  editingGroupName,
  importLoading,
  handleAddFeed,
  handleDeleteFeed,
  startEditFeed,
  saveEditFeed,
  cancelEdit,
  handleExportOpml,
  handleImportOpml,
  reloadFeeds,
  handleMarkAllAsRead,
  handleMarkGroupAsRead,
  handleMarkFeedAsRead,
  handleSelectViewType,
  handleChangeViewType,
  handleMoveToGroup,
  handleSetCustomTitle,
} = useFeedManagement({
  showFavoritesOnly,
  filterMode,
  dateRangeFilter,
  isDateFilterActive,
  applyFilters,
  debouncedApplyFilters,
})

// === Notification & Theme ===
const { showToast, toastMessage, toastType, showNotification } = useNotification()
const { darkMode, toggleTheme, loadTheme } = useTheme()
const showSettings = ref(false)
const settingsInitialCategory = ref<'general' | 'display' | 'sync' | 'intelligence'>('general')
const settingsAutomationTarget = ref<AutomationTarget | null>(null)
const feedDetailMode = ref<'articles' | 'summary'>('articles')
const showBookmarkGroupModal = ref(false)
const bookmarkGroupEntryId = ref<string | null>(null)

function openGeneralSettings() {
  settingsInitialCategory.value = 'general'
  settingsAutomationTarget.value = null
  showSettings.value = true
}

function openTagSettings() {
  settingsInitialCategory.value = 'intelligence'
  settingsAutomationTarget.value = null
  showSettings.value = true
}

function openScopedAutomationSettings(target: AutomationTarget) {
  settingsInitialCategory.value = 'intelligence'
  settingsAutomationTarget.value = target
  showSettings.value = true
}

function closeSettingsModal() {
  showSettings.value = false
  settingsInitialCategory.value = 'general'
  settingsAutomationTarget.value = null
}

function resolveQuickRerunWindow() {
  const now = Date.now()
  let range = isDateFilterActive.value ? dateRangeFilter.value : settingsStore.settings.default_date_range
  if (!range || range === 'all') {
    range = settingsStore.settings.default_date_range || '30d'
  }

  const day = 24 * 60 * 60 * 1000
  const dayMap: Record<string, number> = {
    '1d': 1,
    '3d': 3,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  }
  const fallbackDays = 30
  const days = dayMap[range] || fallbackDays
  const from = new Date(now - days * day).toISOString()
  const to = new Date(now).toISOString()
  return { from, to, effectiveRange: range }
}

async function handleQuickRerunTagging(payload: { scope: 'feed' | 'tag' | 'group'; feedId?: string; tagId?: string; groupName?: string; label: string }) {
  if (tagsStore.rerunTask.running) {
    showNotification(t('tags.quickRerunRunning'), 'info')
    return
  }

  const { from, to, effectiveRange } = resolveQuickRerunWindow()
  let feedIds: string[] | undefined
  if (payload.scope === 'feed' && payload.feedId) {
    feedIds = [payload.feedId]
  } else if (payload.scope === 'group' && payload.groupName !== undefined) {
    feedIds = store.feeds
      .filter((feed) => (feed.group_name || '') === payload.groupName && feed.ai_tagging_enabled !== 0)
      .map((feed) => feed.id)
  }

  if (payload.scope === 'group' && (!feedIds || feedIds.length === 0)) {
    showNotification(t('tags.quickRerunEmptyScope'), 'info')
    return
  }

  showNotification(
    t('tags.quickRerunStarted', { label: payload.label, range: effectiveRange }),
    'info',
  )

  try {
    const result = await tagsStore.runRangeRerunTask({
      from,
      to,
      mode: 'missing',
      limit: 100,
      feedIds,
    })
    showNotification(
      t('tags.quickRerunFinished', {
        total: result.summary.total,
        tagged: result.summary.tagged,
      }),
      'success',
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    showNotification(t('tags.quickRerunFailed', { error: message }), 'error')
  }
}

// === Group collapse ===
const collapsedGroups = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}
  store.collapsedGroups.forEach((groupName) => { result[groupName] = true })
  return result
})

function toggleGroupCollapse(groupName: string) { store.toggleGroupCollapse(groupName) }
function expandAllGroups() { store.expandAllGroups() }
function collapseAllGroups() { store.collapseAllGroups() }

// === Store error watchers ===
watch(() => store.errorMessage, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => { store.errorMessage = null }, 100)
  }
})

watch(() => aiStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => { aiStore.clearError() }, 100)
  }
})

watch(() => favoritesStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => { favoritesStore.clearError() }, 100)
  }
})

const {
  aiFeatures,
  titleTranslationLanguageLabel,
  translatedTitle,
  translationLanguage,
  summaryText,
  summaryLoading,
  fullTextTranslationProgress,
  fullTextTranslationBlocks,
  isFullTextTranslating,
  showFullTextTranslation,
  getFullTextTranslation,
  isFullTextBlockLoading,
  isFullTextBlockFailed,
  getTranslatedTitle,
  isTitleTranslationLoading,
  isTitleTranslationFailed,
  handleEntriesVisible,
  handleFullTextTranslation,
  handleSummary,
  cleanup: cleanupEntryAI,
} = useEntryAI(currentSelectedEntry, {
  notify: showNotification,
  t,
})

// === Favorites ===
async function loadFavoritesData(options: { includeEntries?: boolean; feedId?: string | null } = {}) {
  const includeEntries = options.includeEntries ?? false
  const targetFeedId = options.feedId ?? selectedFavoriteFeed.value
  const filterTimeField = settingsStore.settings.time_field
  const filterDateRange = isDateFilterActive.value ? dateRangeFilter.value : undefined
  try {
    if (includeEntries) {
      await favoritesStore.fetchStarredEntries(
        targetFeedId || undefined, 200, 0,
        { dateRange: filterDateRange, timeField: filterTimeField },
      )
      ensureFavoriteSelection()
    } else {
      await favoritesStore.fetchStarredStats()
    }
  } catch {
    showNotification(t('toast.loadFavoritesFailed'), 'error')
  }
}

// When entering favorites mode, load starred entries
watch(showFavoritesOnly, async (val) => {
  if (val) {
    await loadFavoritesData({ includeEntries: true })
  }
})

watch(dateRangeFilter, () => {
  if (showFavoritesOnly.value) loadFavoritesData({ includeEntries: true })
  if (comboFilterActive.value) {
    tagsStore.fetchFilteredEntries(comboFilterTagIds.value, comboFilterMode.value, true)
    return
  }
  if (viewMode.value === 'tag') {
    const tagOptions = {
      dateRange: isDateFilterActive.value ? dateRangeFilter.value : undefined,
      timeField: settingsStore.settings.time_field,
    }
    if (activeTagView.value === 'pending') tagsStore.fetchPendingEntries(true, tagOptions)
    else if (activeTagView.value === 'untagged') tagsStore.fetchUntaggedEntries(true, tagOptions)
    else if (activeTagId.value) tagsStore.fetchEntriesByTag(activeTagId.value, true, tagOptions)
  }
})

watch(dateRangeFilter, (val) => {
  if (viewMode.value === 'tag') {
    tagsDateRange.value = val
    writeSavedDateRange(TAGS_DATE_RANGE_KEY, val)
    return
  }
  if (viewMode.value === 'favorites') {
    favoritesDateRange.value = val
    writeSavedDateRange(FAVORITES_DATE_RANGE_KEY, val)
    return
  }
  subscriptionDateRange.value = val
  writeSavedDateRange(SUBSCRIPTION_DATE_RANGE_KEY, val)
})

watch(viewMode, (mode) => {
  if (mode === 'tag') {
    dateRangeFilter.value = tagsDateRange.value
    return
  }
  if (mode === 'favorites') {
    dateRangeFilter.value = favoritesDateRange.value
    return
  }
  dateRangeFilter.value = subscriptionDateRange.value
})
watch(() => settingsStore.settings.time_field, () => {
  if (showFavoritesOnly.value) loadFavoritesData({ includeEntries: true })
  if (comboFilterActive.value) {
    tagsStore.fetchFilteredEntries(comboFilterTagIds.value, comboFilterMode.value, true)
    return
  }
  if (viewMode.value === 'tag') {
    const tagOptions = {
      dateRange: isDateFilterActive.value ? dateRangeFilter.value : undefined,
      timeField: settingsStore.settings.time_field,
    }
    if (activeTagView.value === 'pending') tagsStore.fetchPendingEntries(true, tagOptions)
    else if (activeTagView.value === 'untagged') tagsStore.fetchUntaggedEntries(true, tagOptions)
    else if (activeTagId.value) tagsStore.fetchEntriesByTag(activeTagId.value, true, tagOptions)
  }
})

async function selectFavoriteFeed(feedId: string | null) {
  await selectFavoriteFeedRaw(feedId, loadFavoritesData)
}

function backToAllFeeds() {
  feedDetailMode.value = 'articles'
  if (viewMode.value === 'collection' || viewMode.value === 'tag') {
    viewMode.value = 'feeds'
    activeCollectionId.value = null
    activeTagId.value = null
    activeTagView.value = null
    selectedUnifiedEntryId.value = null
    return
  }
  backToAllFeedsRaw(selectedFavoriteEntryId)
}

function ensureFavoriteSelection() {
  if (!showFavoritesOnly.value) return
  const entries = favoritesStore.starredEntries
  if (!entries.length) { selectedFavoriteEntryId.value = null; return }
  if (!selectedFavoriteEntryId.value || !entries.some(e => e.id === selectedFavoriteEntryId.value)) {
    selectedFavoriteEntryId.value = entries[0].id
  }
}

// === Star / Read / Context menu ===
async function toggleStar() {
  await handleToggleStar(currentSelectedEntry.value, showFavoritesOnly.value, async () => {
    await loadFavoritesData({ includeEntries: true })
  })
}

async function toggleStarFromList(entry: Entry) {
  await handleToggleStar(entry, showFavoritesOnly.value, async () => {
    await loadFavoritesData({ includeEntries: true })
  })
}

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
  if (entry.url) window.open(entry.url, '_blank')
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
      const result = await ipc.invoke('open-external', { url: normalizedUrl, mode }) as { success?: boolean }
      if (result?.success) return
    } catch { /* fallback */ }
  }
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
}

// === Feed / Group clicks ===
async function handleFeedClick(feedId: string) {
  ensureFeedsMode()
  store.selectFeed(feedId)
  await store.fetchEntries({ feedId })
}

async function handleGroupClick(groupName: string) {
  ensureFeedsMode()
  store.selectGroup(groupName)
  await store.fetchEntries({ groupName })
}

async function handleGroupRowClick(groupName: string) {
  ensureFeedsMode()
  store.toggleGroupCollapse(groupName)
  store.selectGroup(groupName)
  await store.fetchEntries({ groupName })
}

const currentScopeSummaryTarget = computed<{ scope_type: 'feed' | 'group'; scope_id: string; label: string } | null>(() => {
  if (viewMode.value !== 'feeds' || showFavoritesOnly.value) return null
  if (store.activeFeedId) {
    const feed = store.feeds.find((item) => item.id === store.activeFeedId)
    if (!feed) return null
    return {
      scope_type: 'feed',
      scope_id: feed.id,
      label: feed.custom_title || feed.title || feed.url,
    }
  }
  if (store.activeGroupName) {
    return {
      scope_type: 'group',
      scope_id: store.activeGroupName,
      label: store.activeGroupName,
    }
  }
  return null
})

watch(currentScopeSummaryTarget, (target) => {
  if (!target) {
    feedDetailMode.value = 'articles'
  }
})

function handleToggleFeedDetailMode(mode: 'articles' | 'summary') {
  feedDetailMode.value = mode
}

async function handleScopeSummaryEntrySelect(entryId: string) {
  // 直接选择文章并在右侧显示详情，不切换视图模式
  store.selectEntry(entryId)
  openDetails()
}

// === Entry selection & visible entries ===
function handleEntrySelect(entryId: string) {
  if (viewMode.value === 'collection' || viewMode.value === 'tag') {
    selectedUnifiedEntryId.value = entryId
    // Also select in feedStore so currentSelectedEntry can find it as fallback
    store.selectEntry(entryId)
  } else if (showFavoritesOnly.value) {
    selectedFavoriteEntryId.value = entryId
  } else {
    store.selectEntry(entryId)
  }
  openDetails()
}

// === App Sync ===
const { initSync, cleanupSync } = useAppSync(
  showFavoritesOnly,
  async () => { await loadFavoritesData() },
  dateRangeFilter,
)

// === Lifecycle ===
onMounted(async () => {
  initLayout()
  loadTheme()
  store.loadCollapsedGroups()
  store.loadCustomGroups()
  try { await settingsStore.fetchSettings() } catch { /* continue with defaults */ }
  await loadLanguage()
  await Promise.all([
    aiStore.fetchConfig(),
    aiStore.fetchAutomationRules(),
  ])

  const defaultRange = settingsStore.settings.default_date_range
  subscriptionDateRange.value = readSavedDateRange(SUBSCRIPTION_DATE_RANGE_KEY) || defaultRange
  favoritesDateRange.value = readSavedDateRange(FAVORITES_DATE_RANGE_KEY) || defaultRange
  tagsDateRange.value = readSavedDateRange(TAGS_DATE_RANGE_KEY) || defaultRange
  dateRangeFilter.value = subscriptionDateRange.value
  loadFavoritesData()

  const initialDateRange = settingsStore.settings.enable_date_filter ? dateRangeFilter.value : undefined
  const initialTimeField = settingsStore.settings.time_field

  await store.fetchFeeds({ dateRange: initialDateRange, timeField: initialTimeField })
  await store.fetchEntries({ dateRange: initialDateRange, timeField: initialTimeField })

  collectionsStore.fetchCollections()
  tagsStore.fetchTags()
  tagsStore.fetchStats()
  initSync()
})

onMounted(() => {
  nextTick(() => setupScrollListeners())
})

onUnmounted(() => {
  cleanupEntryAI()
  cleanupLayout()
  cleanupSync()
  unlockBodyScroll()
  cleanupScrollListeners()
})
</script>

<template>
  <Toast
    :show="showToast"
    :message="toastMessage"
    :type="toastType"
    @close="showToast = false"
  />
  <ConfirmModal
    :show="confirmShow"
    :title="confirmOptions.title || ''"
    :message="confirmOptions.message"
    :confirm-text="confirmOptions.confirmText"
    :cancel-text="confirmOptions.cancelText"
    :danger="confirmOptions.danger"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
  <SettingsModal
    :show="showSettings"
    :initial-category="settingsInitialCategory"
    :initial-automation-target="settingsAutomationTarget"
    @notify="showNotification"
    @close="closeSettingsModal"
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
      :view-mode="viewMode"
      :active-collection-id="activeCollectionId"
      :active-tag-id="activeTagId"
      :active-tag-view="activeTagView"
      :collapsed-groups="collapsedGroups"
      :editing-feed-id="editingFeedId"
      :editing-group-name="editingGroupName"
      :is-date-filter-active="isDateFilterActive"
      :time-filter-label="timeFilterLabel"
      @toggle-theme="toggleTheme"
      @open-settings="openGeneralSettings"
      @reset-layout="resetLayout"
      @add-feed="handleAddFeed"
      @export-opml="handleExportOpml"
      @import-opml="handleImportOpml"
      @toggle-favorites="showFavoritesOnly = !showFavoritesOnly"
      @select-favorite-feed="selectFavoriteFeed"
      @toggle-collections="handleToggleCollections"
      @select-collection="handleSelectCollection"
      @toggle-tags="handleToggleTags"
      @select-tag="handleSelectTag"
      @select-tag-view="handleSelectTagView"
      @open-tag-settings="openTagSettings"
      @group-click="handleGroupClick"
      @toggle-collapse="toggleGroupCollapse"
      @group-row-click="handleGroupRowClick"
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
      @move-to-group="handleMoveToGroup"
      @set-custom-title="handleSetCustomTitle"
      @quick-rerun-tagging="handleQuickRerunTagging"
      @open-automation-settings="openScopedAutomationSettings"
    />

    <div
      class="resizer resizer-left"
      :class="{ active: isDraggingLeft }"
      @mousedown="handleMouseDownLeft"
      :title="t('layout.leftResizeTitle')"
    ></div>

    <template v-if="currentScopeSummaryTarget && feedDetailMode === 'summary'">
      <main class="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-base)] flex-1 min-w-260px w-auto box-border max-h-screen min-h-0 overflow-hidden">
        <div class="flex-1 overflow-y-auto" :class="compactTimelineFilterDensity ? 'p-3 pt-2' : 'p-4'">
          <ScopeSummaryView
            :scope-type="currentScopeSummaryTarget.scope_type"
            :scope-id="currentScopeSummaryTarget.scope_id"
            :scope-label="currentScopeSummaryTarget.label"
            @back="handleToggleFeedDetailMode('articles')"
            @select-entry="handleScopeSummaryEntrySelect"
            @notify="showNotification"
          />
        </div>
      </main>
    </template>

    <!-- Digest view (tag mode: 今日/本周 简报) -->
    <template v-else-if="viewMode === 'tag' && activeTagView === 'digest'">
      <main class="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-base)] flex-1 min-w-260px w-auto box-border max-h-screen min-h-0 overflow-hidden">
        <TimelineHeader
          v-if="!compactTimelineFilterDensity"
          :title="timelineTitle"
          :subtitle="timelineSubtitle"
          :show-favorites-only="false"
          :can-mark-all-read="false"
          @refresh="reloadFeeds"
          @back-to-feeds="backToAllFeeds"
        />
        <div class="flex-1 overflow-y-auto" :class="compactTimelineFilterDensity ? 'p-3 pt-2' : 'p-4'">
          <DigestView
            @select-entry="handleEntrySelect"
            @select-tag="handleSelectTag"
          />
        </div>
      </main>
    </template>

    <TimelinePanel
      v-else
      :title="timelineTitle"
      :subtitle="timelineSubtitle"
      :show-favorites-only="showFavoritesOnly"
      :view-mode="viewMode"
      :scope-summary-target="currentScopeSummaryTarget"
      :scope-summary-active="feedDetailMode === 'summary'"
      :active-tag-id="activeTagId"
      :active-tag-name="tagsStore.selectedTag?.name || undefined"
      :active-tag-view="activeTagView"
      :tag-stats="{
        pending: tagsStore.stats.pending,
        analyzed: tagsStore.stats.analyzed,
        withoutTags: tagsStore.stats.withoutTags
      }"
      :combo-filter-active="comboFilterActive"
      :combo-filter-tag-ids="comboFilterTagIds"
      :combo-filter-mode="comboFilterMode"
      :available-tags="tagsStore.tags"
      :view-type="timelineViewType"
      :search-query="searchQuery"
      :filter-mode="filterMode"
      :date-range-filter="dateRangeFilter"
      :filter-loading="filterLoading"
      :enable-date-filter="settingsStore.settings.enable_date_filter"
      :filter-density="settingsStore.settings.timeline_filter_density"
      :entries="unifiedEntries"
      :loading="unifiedLoading"
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
      :ai-search-enabled="aiSearchEnabled"
      :ai-search-active="aiSearchActive"
      :ai-search-loading="searchStore.loading"
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
      @toggle-ai-search="handleToggleAISearch"
      @ai-search="handleAISearch"
      @apply-tag-combo="handleApplyTagCombo"
      @clear-tag-combo="handleClearTagCombo"
      @toggle-scope-summary="handleToggleFeedDetailMode"
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
  overflow: hidden;
  height: 100vh;
  align-items: stretch;
  --sidebar-width: 280px;
  --details-width: 420px;
}

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
