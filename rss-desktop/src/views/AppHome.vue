<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useFeedStore } from '../stores/feedStore'
import { useAIStore } from '../stores/aiStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../composables/useLanguage'
import Toast from '../components/Toast.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import SettingsModal from '../components/SettingsModal.vue'
import LogoMark from '../components/LogoMark.vue'
import type { Entry, Feed } from '../types'

dayjs.extend(relativeTime)

const store = useFeedStore()
const aiStore = useAIStore()
const favoritesStore = useFavoritesStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const { setLanguage, loadLanguage } = useLanguage()
const aiFeatures = computed(() => aiStore.config.features)

// 初始化语言设置
loadLanguage()

// Computed filtered entries
const filteredEntries = computed(() => {
  let result = currentEntries.value

  if (showFavoritesOnly.value) {
    if (filterMode.value === 'unread') {
      result = result.filter((entry) => !entry.read)
    }
    // 收藏模式下默认所有条目均为收藏，无需再次按star筛选
  } else {
    // Apply filter mode for订阅视图
    if (filterMode.value === 'unread') {
      result = result.filter((entry) => !entry.read)
    } else if (filterMode.value === 'starred') {
      result = result.filter((entry) => entry.starred)
    }
  }

  // 在收藏模式下，如果有选择特定订阅源，进一步筛选
  if (showFavoritesOnly.value && selectedFavoriteFeed.value) {
    result = result.filter((entry) => entry.feed_id === selectedFavoriteFeed.value)
  }

  // Apply search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (entry) =>
        entry.title?.toLowerCase().includes(query) ||
        entry.summary?.toLowerCase().includes(query) ||
        entry.content?.toLowerCase().includes(query) ||
        entry.feed_title?.toLowerCase().includes(query)
    )
  }

  return result
})
const newFeedUrl = ref('')
const summaryText = ref('')
const summaryLoading = ref(false)
const translationLanguage = ref('zh')
const translationLoading = ref(false)
const showTranslation = ref(false)
const translatedContent = ref<{
  title: string | null
  content: string | null
}>({ title: null, content: null })
const titleTranslationLoadingMap = ref<Record<string, boolean>>({})
const titleTranslationLanguageLabel = computed(() =>
  (aiFeatures.value?.translation_language || '').toUpperCase(),
)
const editingFeedId = ref<string | null>(null)
const editingGroupName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const importLoading = ref(false)
const searchQuery = ref('')
const filterMode = ref<'all' | 'unread' | 'starred'>('all')
const dateRangeFilter = ref('30d')
const filterLoading = ref(false)
const isDateFilterActive = computed(
  () => settingsStore.settings.enable_date_filter && dateRangeFilter.value !== 'all'
)
const timeFilterLabel = computed(() => (isDateFilterActive.value ? getTimeRangeText(dateRangeFilter.value) : ''))
const darkMode = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'info'>('info')
const showSettings = ref(false)
const MAX_AUTO_TITLE_TRANSLATIONS = Number.POSITIVE_INFINITY
const NO_SUMMARY_TEXT = computed(() => t('ai.noSummary'))
const FEED_ICON_COLORS = [
  '#FF8A3D',
  '#2EC4B6',
  '#8E6CFF',
  '#34C759',
  '#FF6B6B',
  '#4D9DE0',
  '#FFB5A7',
  '#6B705C'
]

const brokenFeedIcons = ref<Record<string, string>>({})

// 布局状态管理
const DEFAULT_VIEWPORT_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 1440
const DEFAULT_SIDEBAR_RATIO = 0.26
const DEFAULT_DETAILS_RATIO = 0.38
const RESIZER_GUTTER = 6 // 两条分隔线总宽度
const MIN_TIMELINE_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 180
const MIN_DETAILS_WIDTH = 260
const SIDEBAR_RATIO_KEY = 'rss-layout-sidebar-ratio'
const DETAILS_RATIO_KEY = 'rss-layout-details-ratio'
const sidebarRatio = ref(DEFAULT_SIDEBAR_RATIO)
const detailsRatio = ref(DEFAULT_DETAILS_RATIO)
const viewportWidth = ref(DEFAULT_VIEWPORT_WIDTH)
const isDraggingLeft = ref(false)
const isDraggingRight = ref(false)

function getViewport() {
  return viewportWidth.value || DEFAULT_VIEWPORT_WIDTH
}

const sidebarWidth = computed(() => Math.round(getViewport() * sidebarRatio.value))
const detailsWidth = computed(() => Math.round(getViewport() * detailsRatio.value))
const logoSize = computed(() => {
  const width = sidebarWidth.value || MIN_SIDEBAR_WIDTH
  return Math.min(44, Math.max(30, width * 0.12))
})
function minSidebarRatio() {
  return MIN_SIDEBAR_WIDTH / getViewport()
}

function minDetailsRatio() {
  return MIN_DETAILS_WIDTH / getViewport()
}

function minTimelineRatio() {
  return MIN_TIMELINE_WIDTH / getViewport()
}

function refreshViewportWidth() {
  if (typeof window === 'undefined') return
  viewportWidth.value = window.innerWidth
}

const layoutStyle = computed(() => ({
  '--sidebar-width': `${sidebarWidth.value}px`,
  '--details-width': `${detailsWidth.value}px`,
}))

function normalizeRatios() {
  const sidebarMin = minSidebarRatio()
  const detailsMin = minDetailsRatio()
  const timelineMin = minTimelineRatio()
  sidebarRatio.value = Math.max(sidebarRatio.value, sidebarMin)
  detailsRatio.value = Math.max(detailsRatio.value, detailsMin)

  const maxSum = Math.max(0, 1 - timelineMin)
  let currentSum = sidebarRatio.value + detailsRatio.value

  if (maxSum <= 0) {
    const base = sidebarMin + detailsMin || 0.0001
    const scale = base / Math.max(currentSum, 0.0001)
    sidebarRatio.value = sidebarRatio.value * scale
    detailsRatio.value = detailsRatio.value * scale
    return
  }

  if (currentSum > maxSum) {
    const excess = currentSum - maxSum
    const sidebarShare = sidebarRatio.value / currentSum
    const detailsShare = detailsRatio.value / currentSum
    sidebarRatio.value = Math.max(sidebarMin, sidebarRatio.value - excess * sidebarShare)
    detailsRatio.value = Math.max(detailsMin, detailsRatio.value - excess * detailsShare)
    currentSum = sidebarRatio.value + detailsRatio.value
    if (currentSum > maxSum) {
      const scale = maxSum / currentSum
      sidebarRatio.value = Math.max(sidebarMin, sidebarRatio.value * scale)
      detailsRatio.value = Math.max(detailsMin, detailsRatio.value * scale)
    }
  }
}

function handleWindowResize() {
  refreshViewportWidth()
  normalizeRatios()
  saveLayoutSettings()
}

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
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

function getTitleTranslationCacheKey(entryId: string) {
  const language = aiFeatures.value?.translation_language || 'zh'
  return `${entryId}_${language}_title`
}

function getTranslatedTitle(entryId: string) {
  const cacheKey = getTitleTranslationCacheKey(entryId)
  return store.titleTranslationCache[cacheKey]?.title ?? null
}

function isTitleTranslationLoading(entryId: string) {
  const cacheKey = getTitleTranslationCacheKey(entryId)
  return !!titleTranslationLoadingMap.value[cacheKey]
}

async function ensureTitleTranslation(entry: Entry) {
  if (!aiFeatures.value?.auto_title_translation || !entry?.id || !entry.title) {
    return
  }
  const cacheKey = getTitleTranslationCacheKey(entry.id)
  if (store.titleTranslationCache[cacheKey] || titleTranslationLoadingMap.value[cacheKey]) {
    return
  }
  titleTranslationLoadingMap.value[cacheKey] = true
  try {
    await store.requestTitleTranslation(entry.id, aiFeatures.value?.translation_language || 'zh')
  } catch (error) {
    console.error('标题翻译失败:', error)
  } finally {
    delete titleTranslationLoadingMap.value[cacheKey]
  }
}

// 收藏状态管理
const showFavoritesOnly = ref(false)
const selectedFavoriteFeed = ref<string | null>(null)
const selectedFavoriteEntryId = ref<string | null>(null)
const lastActiveFeedId = ref<string | null>(null)

const currentEntries = computed(() => (showFavoritesOnly.value ? favoritesStore.starredEntries : store.entries))

const currentSelectedEntry = computed(() => {
  if (showFavoritesOnly.value) {
    return favoritesStore.starredEntries.find((entry) => entry.id === selectedFavoriteEntryId.value) ?? null
  }
  return store.selectedEntry
})

const timelineLoading = computed(() => (showFavoritesOnly.value ? favoritesStore.loading : store.loadingEntries))

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

  try {
    if (includeEntries) {
      await favoritesStore.fetchStarredEntries(targetFeedId || undefined, 200)
      ensureFavoriteSelection()
    } else {
      await favoritesStore.fetchStarredStats()
    }
  } catch (error) {
    console.error('Failed to load favorites data:', error)
    showNotification(t('toast.loadFavoritesFailed'), 'error')
  }
}

async function selectFavoriteFeed(feedId: string | null) {
  if (!showFavoritesOnly.value) {
    lastActiveFeedId.value = store.activeFeedId
  }
  selectedFavoriteFeed.value = feedId
  showFavoritesOnly.value = true
  // 更新筛选模式
  filterMode.value = 'starred'
  await loadFavoritesData({ includeEntries: true, feedId })
}

function backToAllFeeds() {
  showFavoritesOnly.value = false
  selectedFavoriteFeed.value = null
  selectedFavoriteEntryId.value = null
  filterMode.value = 'all'
  if (lastActiveFeedId.value) {
    store.selectFeed(lastActiveFeedId.value)
  }
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

function isEntryActive(entryId: string) {
  return currentSelectedEntry.value?.id === entryId
}

function handleFeedIconError(feedId: string, failedUrl?: string | null) {
  brokenFeedIcons.value = {
    ...brokenFeedIcons.value,
    [feedId]: failedUrl || '__error__'
  }
}

function shouldShowFeedIcon(feed?: Feed | null) {
  if (!feed?.favicon_url) return false
  const failedUrl = brokenFeedIcons.value[feed.id]
  return failedUrl !== feed.favicon_url
}

function getFeedInitial(text?: string | null) {
  const safe = text?.trim()
  if (!safe) return '订'
  return safe.charAt(0).toUpperCase()
}

function getFeedColor(feedId: string) {
  if (!feedId) return FEED_ICON_COLORS[0]
  let hash = 0
  for (let i = 0; i < feedId.length; i += 1) {
    hash = (hash * 31 + feedId.charCodeAt(i)) >>> 0
  }
  return FEED_ICON_COLORS[hash % FEED_ICON_COLORS.length]
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function stripHtml(value?: string | null) {
  if (!value) return ''
  const temp = document.createElement('div')
  temp.innerHTML = value
  const text = temp.textContent || temp.innerText || ''
  return normalizeWhitespace(text)
}

function getEntryPreview(entry: Entry) {
  const summary = entry.summary?.trim()
  if (summary) return summary
  const fallback = stripHtml(entry.content)
  return fallback || NO_SUMMARY_TEXT
}

// Watch for AI store errors
watch(() => aiStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => {
      aiStore.clearError()
    }, 100)
  }
})

// Watch for favorites store errors
watch(() => favoritesStore.error, (error) => {
  if (error) {
    showNotification(error, 'error')
    setTimeout(() => {
      favoritesStore.clearError()
    }, 100)
  }
})

function toggleTheme() {
  darkMode.value = !darkMode.value
  updateTheme()
}

function updateTheme() {
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

function saveLayoutSettings() {
  localStorage.setItem(SIDEBAR_RATIO_KEY, sidebarRatio.value.toString())
  localStorage.setItem(DETAILS_RATIO_KEY, detailsRatio.value.toString())
}

function loadLayoutSettings() {
  if (typeof window === 'undefined') return
  refreshViewportWidth()
  const savedSidebarRatio = localStorage.getItem(SIDEBAR_RATIO_KEY)
  const savedDetailsRatio = localStorage.getItem(DETAILS_RATIO_KEY)

  if (savedSidebarRatio) {
    const ratio = parseFloat(savedSidebarRatio)
    if (!Number.isNaN(ratio)) {
      sidebarRatio.value = ratio
    }
  }
  if (savedDetailsRatio) {
    const ratio = parseFloat(savedDetailsRatio)
    if (!Number.isNaN(ratio)) {
      detailsRatio.value = ratio
    }
  }

  normalizeRatios()
}

function resetLayout() {
  sidebarRatio.value = DEFAULT_SIDEBAR_RATIO
  detailsRatio.value = DEFAULT_DETAILS_RATIO
  normalizeRatios()
  saveLayoutSettings()
  showNotification(t('toast.layoutReset'), 'info')
}

function setSidebarRatioFromClientX(clientX: number) {
  refreshViewportWidth()
  const viewport = getViewport()
  const ratio = clientX / viewport
  sidebarRatio.value = ratio
  normalizeRatios()
  saveLayoutSettings()
}

function setDetailsRatioFromClientX(clientX: number) {
  refreshViewportWidth()
  const viewport = getViewport()
  const ratio = (viewport - clientX) / viewport
  detailsRatio.value = ratio
  normalizeRatios()
  saveLayoutSettings()
}

// 拖拽处理函数
function handleMouseDownLeft(event: MouseEvent) {
  isDraggingLeft.value = true
  event.preventDefault()
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleMouseDownRight(event: MouseEvent) {
  isDraggingRight.value = true
  event.preventDefault()
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleMouseMove(event: MouseEvent) {
  if (isDraggingLeft.value) {
    setSidebarRatioFromClientX(event.clientX)
  } else if (isDraggingRight.value) {
    setDetailsRatioFromClientX(event.clientX)
  }
}

function handleMouseUp() {
  if (isDraggingLeft.value || isDraggingRight.value) {
    isDraggingLeft.value = false
    isDraggingRight.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

onMounted(async () => {
  refreshViewportWidth()
  const savedTheme = localStorage.getItem('theme')
  darkMode.value = savedTheme === 'dark'
  updateTheme()

  // 加载分组折叠状态
  store.loadCollapsedGroups()

  // 加载布局设置
  loadLayoutSettings()
  normalizeRatios()

  // 加载AI配置
  await aiStore.fetchConfig()

  // 加载用户设置
  await settingsStore.fetchSettings()

  // 初始化时间过滤器为设置中的默认值
  dateRangeFilter.value = settingsStore.settings.default_date_range

  // 加载收藏数据
  loadFavoritesData()

  // 添加全局事件监听器
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('resize', handleWindowResize)

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
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('resize', handleWindowResize)
})

watch(
  () => currentSelectedEntry.value,
  async (entry) => {
    if (!entry) {
      summaryText.value = ''
      showTranslation.value = false
      translatedContent.value = { title: null, content: null }
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
        // 可选：显示通知让用户知道摘要已自动生成
        // showNotification('摘要已自动生成', 'success')
      } catch (error) {
        console.error('自动生成摘要失败:', error)
        // 不显示错误通知，避免干扰用户体验
      } finally {
        summaryLoading.value = false
      }
    }

    // Check if translation exists
    const cacheKey = `${entry.id}_${translationLanguage.value}`
    const cachedTranslation = store.translationCache[cacheKey]
    if (cachedTranslation) {
      translatedContent.value = {
        title: cachedTranslation.title,
        content: cachedTranslation.content,
      }
    } else {
      translatedContent.value = { title: null, content: null }
    }

    if (!entry.read) {
      await store.toggleEntryState(entry, { read: true })
    }
  },
  { immediate: true },
)

watch(
  () => ({
    entries: filteredEntries.value,
    language: aiFeatures.value?.translation_language,
    auto: aiFeatures.value?.auto_title_translation,
  }),
  ({ entries, auto }) => {
    if (!auto) {
      titleTranslationLoadingMap.value = {}
      return
    }
    const topEntries = (entries || []).slice(0, MAX_AUTO_TITLE_TRANSLATIONS) as Entry[]
    topEntries.forEach((entry) => {
      ensureTitleTranslation(entry)
    })
  },
  { immediate: true },
)

// 防抖函数
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 应用过滤器的实际函数
async function applyFilters(options: { refreshFeeds?: boolean } = {}) {
  const filterDateRange = settingsStore.settings.enable_date_filter ? dateRangeFilter.value : undefined
  const filterTimeField = settingsStore.settings.time_field

  const promises: Promise<unknown>[] = []

  if (options.refreshFeeds) {
    promises.push(
      store.fetchFeeds({
        dateRange: filterDateRange,
        timeField: filterTimeField
      })
    )
  }

  if (showFavoritesOnly.value) {
    if (promises.length) {
      await Promise.all(promises)
    }
    return
  }

  // 如果既没有选择feed也没有选择分组，则返回
  if (!store.activeFeedId && !store.activeGroupName) {
    if (promises.length) {
      await Promise.all(promises)
    }
    return
  }

  filterLoading.value = true
  promises.push(
    store.fetchEntries({
      feedId: store.activeFeedId || undefined,
      groupName: store.activeGroupName || undefined,
      unreadOnly: filterMode.value === 'unread',
      dateRange: filterDateRange,
      timeField: filterTimeField
    })
  )

  try {
    await Promise.all(promises)
  } finally {
    filterLoading.value = false
  }
}

// 防抖的过滤器应用函数
const debouncedApplyFilters = debounce(applyFilters, 300)

// 监听activeFeedId或activeGroupName变化
watch(
  () => [store.activeFeedId, store.activeGroupName],
  async () => {
    if ((store.activeFeedId || store.activeGroupName) && !showFavoritesOnly.value) {
      await applyFilters()
    }
  }
)

// 监听过滤模式和时间范围变化（使用防抖）
watch(filterMode, () => {
  debouncedApplyFilters()
})

watch(dateRangeFilter, () => {
  debouncedApplyFilters({ refreshFeeds: true })
})

function formatDate(date?: string | null) {
  if (!date) return '未知时间'
  return dayjs(date).fromNow()
}

function getTimeRangeText(dateRange: string): string {
  const rangeMap: Record<string, string> = {
    '1d': '最近1天',
    '7d': '最近1周',
    '30d': '最近1个月',
    '90d': '最近3个月',
    '180d': '最近6个月',
    '365d': '最近1年',
    'all': '全部时间'
  }
  return rangeMap[dateRange] || dateRange
}

async function handleAddFeed() {
  if (!newFeedUrl.value) return
  try {
    await store.addFeed(newFeedUrl.value)
    newFeedUrl.value = ''
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
    showNotification('摘要生成成功', 'success')
  } catch (error) {
    showNotification('摘要生成失败，请检查 API 配置', 'error')
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
  
  // If translation already cached, just show it
  const cacheKey = `${currentSelectedEntry.value.id}_${translationLanguage.value}`
  if (store.translationCache[cacheKey]) {
    const cached = store.translationCache[cacheKey]
    translatedContent.value = {
      title: cached.title,
      content: cached.content,
    }
    showTranslation.value = true
    return
  }
  
  // Otherwise, request translation
  translationLoading.value = true
  try {
    const translation = await store.requestTranslation(
      currentSelectedEntry.value.id,
      translationLanguage.value
    )
    translatedContent.value = {
      title: translation.title,
      content: translation.content,
    }
    showTranslation.value = true
    showNotification('翻译成功', 'success')
  } catch (error) {
    console.error('Translation failed:', error)
    showNotification('翻译失败，请检查 API 配置', 'error')
  } finally {
    translationLoading.value = false
  }
}

async function toggleStar() {
  if (!currentSelectedEntry.value) return

  try {
    const entryId = currentSelectedEntry.value.id
    const willBeStarred = !currentSelectedEntry.value.starred

    if (willBeStarred) {
      await favoritesStore.starEntry(entryId)
      showNotification('已添加到收藏', 'success')
    } else {
      await favoritesStore.unstarEntry(entryId)
      showNotification('已从收藏中移除', 'success')
    }

    // 更新store中的entry状态
    await store.toggleEntryState(currentSelectedEntry.value, { starred: willBeStarred })

    // 如果在收藏模式，重新加载收藏数据
    if (showFavoritesOnly.value) {
      await loadFavoritesData({ includeEntries: true })
    }
  } catch (error) {
    console.error('Failed to toggle star:', error)
    showNotification('操作失败，请重试', 'error')
  }
}

async function toggleStarFromList(entry: any) {
  try {
    const willBeStarred = !entry.starred

    if (willBeStarred) {
      await favoritesStore.starEntry(entry.id)
      showNotification('已添加到收藏', 'success')
    } else {
      await favoritesStore.unstarEntry(entry.id)
      showNotification('已从收藏中移除', 'success')
    }

    // 更新store中的entry状态
    await store.toggleEntryState(entry, { starred: willBeStarred })

    // 如果在收藏模式，重新加载收藏数据
    if (showFavoritesOnly.value) {
      await loadFavoritesData({ includeEntries: true })
    }
  } catch (error) {
    console.error('Failed to toggle star from list:', error)
    showNotification('操作失败，请重试', 'error')
  }
}

function openExternal(url?: string | null) {
  if (url) {
    window.open(url, '_blank')
  }
}

async function handleGroupClick(groupName: string) {
  // 点击分组标题时，选中该分组并加载其文章
  store.selectGroup(groupName)
  await store.fetchEntries({ groupName })
}

async function handleDeleteFeed(feedId: string) {
  if (confirm('确定要删除这个订阅吗？')) {
    try {
      await store.deleteFeed(feedId)
      showNotification('订阅已删除', 'success')
    } catch (error) {
      showNotification('删除失败', 'error')
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
    showNotification('订阅已更新', 'success')
  } catch (error) {
    showNotification('更新失败', 'error')
  }
}

function cancelEdit() {
  editingFeedId.value = null
}

async function handleExportOpml() {
  try {
    await store.exportOpml()
    showNotification('OPML 导出成功', 'success')
  } catch (error) {
    showNotification('导出失败，请重试', 'error')
  }
}

function triggerImportOpml() {
  fileInput.value?.click()
}

async function handleImportOpml(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importLoading.value = true
  try {
    const result = await store.importOpml(file)
    showNotification(
      `导入成功 ${result.imported} 个，跳过 ${result.skipped} 个`,
      'success'
    )
  } catch (error) {
    showNotification('导入失败，请检查文件格式', 'error')
  } finally {
    importLoading.value = false
    if (target) target.value = ''
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
  <div class="app-shell" :style="layoutStyle">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <header class="sidebar__header">
        <div class="brand">
          <LogoMark class="brand__icon" :size="logoSize" />
          <div>
            <h1>Aurora Feeds</h1>
            <p class="muted">{{ t('common.local') }} {{ t('common.private') }} · {{ t('common.ai') }} {{ t('common.smart') }} {{ t('common.reading') }} {{ t('common.platform') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button @click="toggleTheme" class="theme-toggle" :title="darkMode ? t('layout.themeToggleTitle') : t('layout.themeToggleTitleDark')">
            <svg
              v-if="darkMode"
              class="icon icon-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
              <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
              <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
            </svg>
            <svg
              v-else
              class="icon icon-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8z"
              />
            </svg>
          </button>
          <button @click="showSettings = true" class="settings-btn" :title="t('layout.settingsTitle')">
            <svg
              class="icon icon-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l-.01.08a2 2 0 1 1-3.32 0l-.01-.08a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1 1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.08.01a2 2 0 1 1 0-3.32l.08-.01a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1 .33 1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82l.01-.08a2 2 0 1 1 3.32 0l.01.08a1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1 .65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.82.33l.08-.01a2 2 0 1 1 0 3.32l-.08.01a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.6 1z"
              />
            </svg>
          </button>
          <button @click="resetLayout" class="layout-reset-btn" :title="t('layout.resetLayoutTitle')">
            <svg
              class="icon icon-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M3 10h18" />
            </svg>
          </button>
        </div>
      </header>

      <form class="add-feed" @submit.prevent="handleAddFeed">
        <input v-model.trim="newFeedUrl" :placeholder="t('feeds.addPlaceholder')" />
        <button type="submit" :disabled="store.addingFeed">
          {{ store.addingFeed ? t('feeds.adding') : t('feeds.addFeed') }}
        </button>
      </form>

      <div class="opml-actions">
        <button @click="handleExportOpml" class="opml-btn">{{ t('opml.export') }}</button>
        <button @click="triggerImportOpml" :disabled="importLoading" class="opml-btn">
          {{ importLoading ? t('toast.importing') : t('opml.import') }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".opml,.xml"
          @change="handleImportOpml"
          style="display: none"
        />
      </div>

      <!-- 收藏目录 -->
      <div class="favorites-section" v-if="favoritesStore.starredStats.total_starred > 0">
        <div class="favorites-header">
          <button
            :class="['favorites-toggle', { active: showFavoritesOnly }]"
            @click="showFavoritesOnly ? backToAllFeeds() : selectFavoriteFeed(null)"
          >
            <span class="favorites-icon" aria-hidden="true">
              <svg class="icon icon-18" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 3.5l2.7 5.61 6.3.92-4.55 4.44 1.08 6.28L12 17.77l-5.53 2.98 1.08-6.28L3 10.03l6.3-.92L12 3.5z"
                />
              </svg>
            </span>
            <span class="favorites-title">{{ t('groups.myFavorites') }}</span>
            <span class="favorites-count">{{ favoritesStore.starredStats.total_starred }}</span>
          </button>
        </div>

        <!-- 收藏分组列表 -->
        <div v-show="showFavoritesOnly" class="favorites-list">
          <!-- 全部收藏 -->
          <div class="favorites-group">
            <button
              :class="['favorites-item', { active: !selectedFavoriteFeed }]"
              @click="selectFavoriteFeed(null)"
            >
              <span class="favorites-item-icon" aria-hidden="true">
                <svg class="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h6a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z" />
                  <path d="M14 4h6v14a2 2 0 0 1-2 2h-4V6a2 2 0 0 0-2-2z" />
                </svg>
              </span>
              <span class="favorites-item-title">{{ t('navigation.allFavorites') }}</span>
              <span class="favorites-item-count">{{ favoritesStore.starredStats.total_starred }}</span>
            </button>
          </div>

          <!-- 按分组显示收藏 -->
          <template v-for="(group, groupName) in favoritesStore.groupedStats" :key="groupName">
            <div class="favorites-group" v-if="groupName !== 'all' && group.total > 0">
              <div class="favorites-group-header">
                <span class="favorites-group-name">{{ groupName }}</span>
                <span class="favorites-group-count">{{ group.total }}</span>
              </div>

              <!-- 该分组下的订阅源 -->
              <div class="favorites-group-feeds">
                <button
                  v-for="feed in group.feeds"
                  :key="feed.id"
                  :class="['favorites-feed-item', { active: selectedFavoriteFeed === feed.id }]"
                  @click="selectFavoriteFeed(feed.id)"
                >
                  <span
                    class="favorites-feed-icon feed-icon"
                    :style="{ backgroundColor: getFeedColor(feed.id) }"
                    aria-hidden="true"
                  >
                    <img
                      v-if="shouldShowFeedIcon(feedMap[feed.id])"
                      :src="feedMap[feed.id]?.favicon_url || undefined"
                      :alt="`${feed.title} 图标`"
                      loading="lazy"
                      decoding="async"
                      @error="handleFeedIconError(feed.id, feedMap[feed.id]?.favicon_url)"
                    />
                    <span class="feed-icon__initial" v-else>
                      {{ getFeedInitial(feed.title) }}
                    </span>
                  </span>
                  <span class="favorites-feed-title">{{ feed.title }}</span>
                  <span class="favorites-feed-count">{{ feed.count }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="feed-list" v-show="!showFavoritesOnly">
        <!-- 分组控制按钮 -->
        <div class="group-controls" v-if="store.sortedGroupNames.length > 1">
          <button @click="store.expandAllGroups" class="group-control-btn" :title="t('feeds.groupControlTitle')">
            {{ t('common.expandAll') }}
          </button>
          <button @click="store.collapseAllGroups" class="group-control-btn" :title="t('feeds.groupControlCollapseTitle')">
            {{ t('common.collapseAll') }}
          </button>
        </div>

        <!-- 分组列表 -->
        <template v-for="groupName in store.sortedGroupNames" :key="groupName">
          <div class="feed-group">
            <!-- 分组标题 -->
            <div class="group-header-wrapper">
              <button
                class="group-header"
                :class="{ active: store.activeGroupName === groupName }"
                @click="handleGroupClick(groupName)"
              >
                <span
                  class="group-toggle"
                  :class="{ collapsed: store.isGroupCollapsed(groupName) }"
                  aria-hidden="true"
                  @click.stop="store.toggleGroupCollapse(groupName)"
                >
                  <svg
                    class="chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
                <span class="group-name">{{ groupName }}</span>
                <span class="group-stats">
                  {{ store.groupStats[groupName]?.feedCount || 0 }} 订阅
                  <span v-if="store.groupStats[groupName]?.unreadCount" class="unread-count">
                    • {{ store.groupStats[groupName].unreadCount }} 未读
                    <span v-if="isDateFilterActive" class="time-filter-hint">({{ timeFilterLabel }})</span>
                  </span>
                </span>
              </button>
            </div>

            <!-- Feeds列表 -->
            <div
              v-show="!store.isGroupCollapsed(groupName)"
              class="group-feeds"
            >
            <div
              v-for="feed in store.groupedFeeds[groupName]"
              :key="feed.id"
              :class="['feed-item-wrapper', { active: store.activeFeedId === feed.id }]"
            >
              <button
                class="feed-item-main"
                @click="store.selectFeed(feed.id)"
              >
                <div
                  class="feed-item__icon feed-icon"
                  :style="{ backgroundColor: getFeedColor(feed.id) }"
                  aria-hidden="true"
                >
                  <img
                    v-if="shouldShowFeedIcon(feed)"
                    :src="feed.favicon_url || undefined"
                    :alt="`${feed.title || feed.url} 图标`"
                    loading="lazy"
                    decoding="async"
                    @error="handleFeedIconError(feed.id, feed.favicon_url)"
                  />
                  <span v-else class="feed-icon__initial">{{ getFeedInitial(feed.title || feed.url) }}</span>
                </div>
                <div class="feed-item__info">
                  <span class="feed-item__title">{{ feed.title || feed.url }}</span>
                  <span class="feed-item__url" v-if="editingFeedId !== feed.id">
                    {{ feed.url }}
                  </span>
                  <div v-else class="feed-item__edit">
                    <input
                      v-model="editingGroupName"
                      @click.stop
                      placeholder="分组名称"
                      class="group-input"
                    />
                  </div>
                </div>
                <span
                  class="feed-item__badge"
                  v-if="feed.unread_count"
                  :title="isDateFilterActive ? `仅统计${timeFilterLabel}内的未读文章` : '全部未读文章'"
                >
                  {{ feed.unread_count }}
                </span>
              </button>
              <div class="feed-item__actions" @click.stop>
                <button
                  v-if="editingFeedId === feed.id"
                  @click="saveEditFeed(feed.id)"
                    class="action-btn save"
                    title="保存"
                  >
                    ✓
                  </button>
                  <button
                    v-if="editingFeedId === feed.id"
                    @click="cancelEdit"
                    class="action-btn cancel"
                    title="取消"
                  >
                    ✕
                  </button>
                  <button
                    v-if="editingFeedId !== feed.id"
                    @click="startEditFeed(feed.id, feed.group_name)"
                    class="action-btn edit"
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    @click="handleDeleteFeed(feed.id)"
                    class="action-btn delete"
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- 左侧分隔器 -->
    <div
      class="resizer resizer-left"
      :class="{ active: isDraggingLeft }"
      @mousedown="handleMouseDownLeft"
      title="拖拽调整侧边栏宽度"
    ></div>

    <!-- 时间线 -->
    <main class="timeline">
      <header class="timeline__header">
        <div>
          <h2 v-if="showFavoritesOnly">
            {{ selectedFavoriteFeed ?
               store.feeds.find((f) => f.id === selectedFavoriteFeed)?.title + ' 的收藏' || '收藏' :
               '全部收藏'
            }}
          </h2>
          <h2 v-else-if="store.activeGroupName">
            {{ store.activeGroupName }} 分组
          </h2>
          <h2 v-else>
            {{ store.feeds.find((f) => f.id === store.activeFeedId)?.title || '最新条目' }}
          </h2>
          <p class="muted">
            共 {{ filteredEntries.length }}
            <span v-if="showFavoritesOnly"> / {{ favoritesStore.starredStats.total_starred }} 篇收藏</span>
            <span v-else> / {{ store.entries.length }} 篇文章</span>
          </p>
        </div>
        <div class="timeline__actions">
          <button
            class="timeline-action-btn"
            @click="showFavoritesOnly ? loadFavoritesData({ includeEntries: true }) : store.refreshActiveFeed()"
          >
            <span class="timeline-action-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M4 4v6h6"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <path
                  d="M20 20v-6h-6"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <path
                  d="M20 10a8 8 0 0 0-13.66-4.66L4 8"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <path
                  d="M4 14a8 8 0 0 0 13.66 4.66L20 16"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <span>{{ showFavoritesOnly ? t('navigation.refreshFavorites') : t('navigation.refreshSubscription') }}</span>
          </button>
          <button
            v-if="showFavoritesOnly"
            @click="backToAllFeeds"
            class="timeline-action-btn timeline-action-btn--ghost"
          >
            <span class="timeline-action-btn__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M8 5l-5 7 5 7"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <path
                  d="M21 12H4"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <span>{{ t('navigation.backToSubscription') }}</span>
          </button>
        </div>
      </header>

      <div class="timeline__controls">
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('articles.searchPlaceholder')"
          class="search-input"
        />
        <div class="filter-buttons">
          <button
            :class="['filter-btn', { active: filterMode === 'all' }]"
            @click="filterMode = 'all'"
          >
            {{ t('navigation.all') }}
          </button>
          <button
            :class="['filter-btn', { active: filterMode === 'unread' }]"
            @click="filterMode = 'unread'"
          >
            {{ t('navigation.unread') }}
          </button>
          <button
            :class="['filter-btn', { active: filterMode === 'starred' }]"
            @click="filterMode = 'starred'"
          >
            {{ t('navigation.favorites') }}
          </button>
        </div>

        <!-- 时间过滤器 -->
        <div class="date-filter" v-if="settingsStore.settings.enable_date_filter">
          <label>{{ t('common.timeRange') }}</label>
          <select
            v-model="dateRangeFilter"
            class="date-select"
            :disabled="filterLoading"
          >
            <option value="1d">{{ t('time.last1Day') }}</option>
            <option value="7d">{{ t('time.last1Week') }}</option>
            <option value="30d">{{ t('time.last1Month') }}</option>
            <option value="90d">{{ t('time.last3Months') }}</option>
            <option value="180d">{{ t('time.last6Months') }}</option>
            <option value="365d">{{ t('time.last1Year') }}</option>
            <option value="all">{{ t('time.allTime') }}</option>
          </select>
          <div class="filter-stats" :class="{ 'filter-stats--loading': filterLoading }">
            <div class="filter-stats__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M12 4v6l4 2"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <path
                  d="M4.5 6.5A9 9 0 1 1 6 19.5"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-opacity="0.15" stroke-width="0.6" fill="none" />
              </svg>
            </div>
            <div class="filter-stats__content">
              <p class="filter-stats__title">
                <template v-if="filterLoading">{{ t('filters.dataUpdating') }}</template>
                <template v-else>{{ t('filters.displayingCount', { count: filteredEntries.length }) }}</template>
              </p>
              <p class="filter-stats__meta" v-if="filterLoading">
                {{ t('filters.filteringData') }}
              </p>
              <p class="filter-stats__meta" v-else>
                <template v-if="isDateFilterActive">
                  <span>{{ timeFilterLabel }}</span>
                  <span class="filter-stats__separator">·</span>
                  <span>{{ t('filters.dateFilterNote') }}</span>
                </template>
                <template v-else>
                  <span>{{ t('filters.allTimeRange') }}</span>
                </template>
              </p>
            </div>
          </div>
        </div>
      </div>

      <section class="timeline__list">
        <LoadingSpinner v-if="timelineLoading" message="加载中..." />
        
        <template v-else>
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            :class="['entry-card', { active: isEntryActive(entry.id), unread: !entry.read }]"
          >
            <button class="entry-card__main" @click="handleEntrySelect(entry.id)">
              <div class="entry-card__title">{{ entry.title || '未命名文章' }}</div>
              <div
                v-if="aiFeatures.auto_title_translation && (getTranslatedTitle(entry.id) || isTitleTranslationLoading(entry.id))"
                class="entry-card__translated-title"
              >
                <span class="translation-label">{{ t('articles.translationLabel', { language: titleTranslationLanguageLabel }) }}</span>
                <template v-if="getTranslatedTitle(entry.id)">
                  {{ getTranslatedTitle(entry.id) }}
                </template>
                <span v-else class="loading-indicator">{{ t('articles.translatingTitle') }}</span>
              </div>
              <div class="entry-card__meta">
                <span>{{ entry.feed_title }}</span>
                <span>{{ t('articles.timeSeparator') }}</span>
                <span>{{ formatDate(entry.published_at) }}</span>
              </div>
              <p class="entry-card__summary">
                {{ getEntryPreview(entry) }}
              </p>
            </button>
            <button
              class="entry-card__star"
              @click.stop="toggleStarFromList(entry)"
              :title="entry.starred ? '取消收藏' : '收藏'"
            >
              {{ entry.starred ? '★' : '☆' }}
            </button>
          </div>

          <div class="empty" v-if="!filteredEntries.length">
            {{ searchQuery ? t('feeds.noArticlesSearch') : t('feeds.noArticlesAdd') }}
          </div>
        </template>
      </section>
    </main>

    <!-- 右侧分隔器 -->
    <div
      class="resizer resizer-right"
      :class="{ active: isDraggingRight }"
      @mousedown="handleMouseDownRight"
      :title="t('layout.rightResizeTitle')"
    ></div>

    <!-- 详情栏 -->
    <section class="details">
      <div v-if="currentSelectedEntry" class="details__content">
        <div class="details__header">
          <p class="muted">{{ currentSelectedEntry.feed_title }}</p>
          <h2>{{ showTranslation && translatedContent.title ? translatedContent.title : currentSelectedEntry.title }}</h2>
          <p class="muted">
            {{ currentSelectedEntry.author || t('feeds.authorUnknown') }} {{ t('articles.timeSeparator') }}
            {{ formatDate(currentSelectedEntry.published_at) }}
          </p>
        </div>

        <div class="details__actions">
          <button @click="openExternal(currentSelectedEntry.url)">{{ t('feeds.openOriginal') }}</button>
          <button @click="toggleStar">
            {{ currentSelectedEntry.starred ? t('articles.cancelFavorite') : t('articles.addFavorite') }}
          </button>
          <button @click="handleTranslation" :disabled="translationLoading">
            {{ translationLoading ? t('ai.translating') : (showTranslation ? t('articles.showOriginal') : t('ai.translate')) }}
          </button>
          <select v-model="translationLanguage" class="lang-select">
            <option value="zh">{{ t('languages.zh') }}</option>
            <option value="en">{{ t('languages.en') }}</option>
            <option value="ja">{{ t('languages.ja') }}</option>
            <option value="ko">{{ t('languages.ko') }}</option>
          </select>
        </div>

        <div class="summary-card summary-card--inline">
          <div class="summary-card__content">
            <p class="summary-card__label">{{ t('ai.summaryLabel') }}</p>
            <p v-if="summaryText" class="summary-card__text">{{ summaryText }}</p>
            <p v-else class="summary-card__placeholder">
              {{ t('ai.summaryDescription') }}
            </p>
          </div>
          <button
            class="summary-card__action"
            @click="handleSummary"
            :disabled="summaryLoading"
          >
            {{ summaryLoading ? t('ai.generating') : (summaryText ? t('ai.regenerateButton') : t('ai.generateButton')) }}
          </button>
        </div>

        <article 
          class="details__body" 
          v-html="showTranslation && translatedContent.content ? translatedContent.content : currentSelectedEntry.content"
        ></article>
      </div>
      <div v-else class="empty">
        {{ t('articles.selectArticle') }}
      </div>
    </section>
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
  overflow-x: hidden;
  overflow-y: auto;
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

.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  padding: 24px 16px;
  background: var(--bg-surface);
  flex-shrink: 0;
  min-width: 180px;
  box-sizing: border-box;
  max-height: 100vh;
  overflow-y: auto;
  min-height: 0;
  width: var(--sidebar-width);
}

.sidebar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: flex-start;
  gap: clamp(8px, 1vw, 14px);
  flex: 1;
}

.brand__icon {
  flex-shrink: 0;
}

.sidebar__header h1 {
  font-size: clamp(16px, 1.6vw, 20px);
  margin-bottom: 4px;
  line-height: 1.2;
}

.brand p {
  font-size: clamp(11px, 1.2vw, 13px);
  line-height: 1.4;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-self: flex-start;
  margin-top: -4px;
}

.icon {
  width: 16px;
  height: 16px;
  display: block;
}

.icon-16 {
  width: 16px;
  height: 16px;
}

.icon-18 {
  width: 18px;
  height: 18px;
}

.icon-20 {
  width: 20px;
  height: 20px;
}

.theme-toggle,
.settings-btn,
.layout-reset-btn {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
  color: var(--text-primary);
}

.theme-toggle:hover,
.settings-btn:hover,
.layout-reset-btn:hover {
  background: rgba(255, 122, 24, 0.1);
  color: var(--accent);
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.add-feed {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}

.add-feed input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.add-feed input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.add-feed button {
  border: none;
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #fff;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
}

.opml-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.opml-btn {
  flex: 1;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.opml-btn:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: var(--accent);
}

.opml-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feed-list {
  flex: 1;
}

.group-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.group-control-btn {
  border: 1px solid rgba(15, 17, 21, 0.1);
  background: transparent;
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-control-btn:hover {
  background: rgba(255, 122, 24, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 122, 24, 0.2);
}

.feed-group {
  margin-bottom: 8px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(15, 17, 21, 0.08);
  transition: all 0.2s;
}

.feed-group:hover {
  background: rgba(255, 255, 255, 0.5);
}

.group-header {
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-weight: 600;
  color: var(--text-primary);
}

.group-header:hover {
  background: rgba(255, 122, 24, 0.1);
}

.group-header.active {
  background: rgba(255, 122, 24, 0.15);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(255, 122, 24, 0.3);
}

.group-toggle {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.group-toggle.collapsed .chevron-icon {
  transform: rotate(-90deg);
}

.group-header:hover .group-toggle {
  color: var(--accent);
}

.group-name {
  flex: 1;
  text-align: left;
  font-size: 14px;
}

.group-stats {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: normal;
}

.unread-count {
  color: #ff8a3d;
  font-weight: 600;
}

.time-filter-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.group-feeds {
  background: rgba(255, 255, 255, 0.2);
  border-top: 1px solid rgba(15, 17, 21, 0.05);
}

.group-feeds .feed-item-wrapper {
  margin: 4px 8px;
}

.group-feeds .feed-item__title {
  font-weight: 500;
  font-size: 13px;
}

.group-feeds .feed-item__url {
  font-size: 11px;
  opacity: 0.8;
}

.feed-item-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  box-shadow: 0 6px 14px rgba(15, 17, 21, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.feed-item-wrapper:hover {
  border-color: rgba(255, 122, 24, 0.4);
  box-shadow: 0 12px 24px rgba(15, 17, 21, 0.1);
  transform: translateY(-1px);
}

.feed-item-wrapper.active {
  border-color: var(--accent);
  background: rgba(255, 122, 24, 0.08);
  box-shadow: 0 14px 28px rgba(255, 122, 24, 0.15);
}

.feed-item-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  color: var(--text-primary);
  cursor: pointer;
}

.feed-item-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.feed-icon {
  --feed-icon-size: 32px;
  --feed-icon-padding: 4px;
  width: var(--feed-icon-size);
  height: var(--feed-icon-size);
  border-radius: 10px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feed-item-wrapper:hover .feed-icon {
  transform: scale(1.03);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.feed-icon img {
  width: calc(100% - var(--feed-icon-padding));
  height: calc(100% - var(--feed-icon-padding));
  object-fit: contain;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  display: block;
  padding: calc(var(--feed-icon-padding) / 2);
}

.feed-icon__initial {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.feed-item__icon {
  --feed-icon-size: 34px;
}

.feed-item__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
  color: var(--text-primary);
}

.action-btn:hover {
  border-color: var(--accent);
  background: rgba(255, 122, 24, 0.15);
  color: var(--accent);
  transform: translateY(-1px);
}

.action-btn.delete:hover {
  background: #ff3b30;
  color: white;
}

.action-btn.edit:hover {
  background: #007aff;
  color: white;
}

.action-btn.save:hover {
  background: #34c759;
  color: white;
}

.action-btn.cancel:hover {
  background: #8e8e93;
  color: white;
}

.feed-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.feed-item__title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-item__url {
  font-size: 12px;
  color: #8a90a3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-item__edit {
  margin-top: 4px;
}

.group-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.feed-item__badge {
  min-width: 24px;
  height: 24px;
  border-radius: 12px;
  background: rgba(15, 17, 21, 0.08);
  display: grid;
  place-items: center;
  font-size: 12px;
}

.timeline {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  background: var(--bg-base);
  flex: 1 1 auto;
  min-width: 260px;
  width: auto;
  box-sizing: border-box;
  max-height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(16px, 2vw, 24px);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-wrap: wrap;
}

.timeline__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.timeline-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 999px;
  padding: clamp(8px, 1.1vw, 10px) clamp(14px, 1.8vw, 18px) clamp(8px, 1.1vw, 10px) clamp(10px, 1.3vw, 12px);
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #fff;
  font-size: clamp(12px, 0.95vw, 13px);
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.timeline-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(255, 122, 24, 0.45);
}

.timeline-action-btn:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(255, 122, 24, 0.3);
}

.timeline-action-btn__icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timeline-action-btn__icon svg {
  width: 16px;
  height: 16px;
  color: #fff;
}

.timeline-action-btn--ghost {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  box-shadow: 0 4px 14px rgba(15, 17, 21, 0.1);
  border: 1px solid rgba(15, 17, 21, 0.08);
  padding-right: 16px;
}

.timeline-action-btn--ghost .timeline-action-btn__icon {
  background: rgba(15, 17, 21, 0.08);
}

.timeline-action-btn--ghost:hover {
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 17, 21, 0.15);
}

.timeline-action-btn--ghost:active {
  box-shadow: 0 4px 12px rgba(15, 17, 21, 0.12);
}

.timeline__controls {
  padding: clamp(12px, 1.8vw, 20px) clamp(16px, 2vw, 24px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 0 0 auto;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.filter-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-surface);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  color: var(--text-primary);
}

.filter-btn:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: var(--accent);
  color: var(--accent);
}

.filter-btn.active {
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 8px 18px rgba(255, 122, 24, 0.25);
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.date-filter label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.date-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.date-select:hover {
  border-color: var(--accent);
}

.date-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.date-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-secondary);
}

.filter-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 122, 24, 0.08), rgba(0, 122, 255, 0.08));
  box-shadow: 0 4px 20px rgba(15, 17, 21, 0.08);
  margin-left: auto;
  min-width: 220px;
}

.filter-stats__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ff7a18, #ffbe30);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(255, 122, 24, 0.35);
}

.filter-stats__icon svg {
  width: 22px;
  height: 22px;
}

.filter-stats__content {
  flex: 1;
}

.filter-stats__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.filter-stats__meta {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-stats__separator {
  color: rgba(15, 17, 21, 0.3);
}

.filter-stats--loading .filter-stats__icon {
  animation: filterStatsSpin 1.2s linear infinite;
}

@keyframes filterStatsSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-indicator {
  color: var(--text-secondary) !important;
  font-weight: normal !important;
  animation: pulse 1.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}

.timeline__list {
  flex: 1 1 auto;
  padding: clamp(12px, 1.5vw, 16px);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1vw, 14px);
  overflow-y: auto;
  min-height: 0;
}

.entry-card {
  border: 1px solid var(--border-color);
  text-align: left;
  padding: clamp(12px, 1.5vw, 16px);
  border-radius: 16px;
  background: var(--bg-surface);
  display: flex;
  align-items: flex-start;
  gap: clamp(10px, 0.8vw, 14px);
  color: var(--text-primary);
  box-shadow: 0 4px 14px rgba(15, 17, 21, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.entry-card:hover {
  border-color: rgba(255, 122, 24, 0.4);
  box-shadow: 0 14px 28px rgba(15, 17, 21, 0.12);
  transform: translateY(-2px);
}

.entry-card__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  color: inherit;
  font: inherit;
}

.entry-card__star {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  color: #ffbe30;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.entry-card__star:hover {
  background: rgba(255, 190, 48, 0.1);
  transform: scale(1.1);
}

.entry-card.unread {
  border-color: var(--accent);
}

.entry-card.active {
  border-color: var(--accent);
  box-shadow: 0 14px 32px rgba(255, 122, 24, 0.2);
  background: rgba(255, 122, 24, 0.06);
}

.entry-card__title {
  font-weight: 600;
}

.entry-card__meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 6px;
  align-items: center;
}

.star-badge {
  color: #ffbe30;
  font-size: 14px;
}

.entry-card__summary {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: clamp(4.2em, 6vw, 6.3em);
}

.details {
  background: var(--bg-surface);
  padding: 24px;
  flex-shrink: 0;
  min-width: 280px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  min-height: 0;
  overflow: hidden;
  width: var(--details-width);
  /* 最大宽度由JavaScript动态控制，最大可达50%屏幕宽度 */
}

.details__header {
  margin-bottom: 12px;
}

.details__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 246, 248, 0.9));
  border: 1px solid rgba(15, 17, 21, 0.08);
  box-shadow: 0 6px 18px rgba(15, 17, 21, 0.08);
  margin-bottom: 14px;
}

.details__actions button,
.details__actions .lang-select {
  height: clamp(28px, 3.2vw, 34px);
  padding: 0 clamp(10px, 1.3vw, 14px);
  border-radius: 999px;
  border: 1px solid rgba(15, 17, 21, 0.12);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text-primary);
  font-weight: 500;
  font-size: clamp(0.72rem, 1vw, 0.8rem);
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  flex: 0 1 auto;
  min-width: 68px;
  white-space: nowrap;
}

.details__actions button:hover,
.details__actions .lang-select:hover {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.25);
}

.details__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.04);
  border-color: transparent;
  box-shadow: none;
}

.details__actions button:focus-visible,
.details__actions .lang-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.details__actions .lang-select {
  appearance: none;
  padding-right: 28px;
  min-width: 78px;
  text-align: left;
  background-color: rgba(255, 255, 255, 0.8);
  background-image: linear-gradient(45deg, transparent 50%, rgba(15, 17, 21, 0.45) 50%), linear-gradient(135deg, rgba(15, 17, 21, 0.45) 50%, transparent 50%);
  background-position: calc(100% - 13px) 11px, calc(100% - 9px) 11px;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.details__body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.details__body :deep(p) {
  margin-bottom: 1em;
}

.details__body :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  border-radius: 10px;
}

.details__body :deep(table) {
  width: 100%;
  overflow-x: auto;
  display: block;
}

.details__body :deep(pre),
.details__body :deep(code) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 18px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(15, 17, 21, 0.08);
  background: linear-gradient(135deg, rgba(255, 138, 61, 0.08), rgba(255, 138, 61, 0.02));
}

.summary-card--inline {
  box-shadow: 0 10px 30px rgba(15, 17, 21, 0.08);
}

.summary-card__content {
  flex: 1;
}

.summary-card__label {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(15, 17, 21, 0.55);
  margin-bottom: 2px;
  font-weight: 600;
}

.summary-card__text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

.summary-card__placeholder {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.summary-card__action {
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  background: #ff8a3d;
  color: #fff;
  font-weight: 500;
  font-size: 0.75rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  align-self: flex-start;
}

.summary-card__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.summary-card__action:not(:disabled):hover {
  box-shadow: 0 8px 20px rgba(255, 138, 61, 0.35);
  transform: translateY(-1px);
}

.empty {
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
}

@media (max-width: 960px) {
  .app-shell {
    flex-direction: column;
    min-height: 100vh;
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .sidebar {
    width: 100% !important;
    height: auto;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    overflow: visible;
  }

  .resizer {
    display: none;
  }

  .timeline {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    min-width: auto;
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .details {
    width: 100% !important;
    max-width: none;
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .details__actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .details__actions button,
  .details__actions .lang-select {
    flex: 1 1 calc(50% - 10px);
    text-align: center;
  }
}

@media (max-width: 560px) {
  .details__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .details__actions button,
  .details__actions .lang-select {
    flex: 1 1 auto;
    width: 100%;
  }
}

/* 翻译标题样式 */
.entry-card__translated-title {
  margin-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.translation-label {
  display: inline-flex;
  align-items: center;
  height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid rgba(255, 122, 24, 0.35);
  background: rgba(255, 122, 24, 0.14);
  color: #ff7a18;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
}

.loading-indicator {
  display: inline-block;
  margin-left: 0.5rem;
  color: var(--primary-color);
  font-style: italic;
  font-size: 0.8rem;
}

/* 深色模式样式 */
:global(.dark) .resizer {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .entry-card__translated-title {
  color: rgba(255, 255, 255, 0.75);
}

:global(.dark) .translation-label {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffe4d3;
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.2);
}

:global(.dark) .resizer:hover {
  background: rgba(255, 122, 24, 0.4);
}

:global(.dark) .resizer.active {
  background: rgba(255, 122, 24, 0.7);
}

:global(.dark) .feed-group {
  background: rgba(15, 17, 21, 0.4);
  border-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .feed-group:hover {
  background: rgba(15, 17, 21, 0.6);
}

:global(.dark) .group-header:hover {
  background: rgba(255, 122, 24, 0.15);
}

:global(.dark) .group-feeds {
  background: rgba(15, 17, 21, 0.3);
  border-top-color: rgba(255, 255, 255, 0.05);
}

:global(.dark) .details__actions {
  background: rgba(19, 22, 29, 0.75);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

:global(.dark) .details__actions button,
:global(.dark) .details__actions .lang-select {
  background: rgba(24, 27, 34, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  color: #f5f6fa;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}

:global(.dark) .details__actions button:hover,
:global(.dark) .details__actions .lang-select:hover {
  background: var(--accent);
  color: #151515;
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(255, 122, 24, 0.3);
}

:global(.dark) .details__actions button:disabled {
  background: rgba(24, 27, 34, 0.6);
  color: rgba(255, 255, 255, 0.5);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: none;
}

:global(.dark) .details__actions .lang-select {
  background-color: rgba(24, 27, 34, 0.9) !important;
  background-image: linear-gradient(45deg, transparent 50%, rgba(245, 246, 250, 0.7) 50%), linear-gradient(135deg, rgba(245, 246, 250, 0.7) 50%, transparent 50%) !important;
  color: #f5f6fa !important;
}

:global(.dark) .favorites-title {
  color: rgba(255, 255, 255, 0.95);
}
:global(.dark) .group-feeds .feed-item-wrapper:hover {
  background: rgba(255, 255, 255, 0.05);
}

:global(.dark) .group-control-btn {
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

:global(.dark) .group-control-btn:hover {
  background: rgba(255, 122, 24, 0.15);
  color: var(--text-primary);
  border-color: rgba(255, 122, 24, 0.3);
}

:global(.dark) .theme-toggle,
:global(.dark) .settings-btn,
:global(.dark) .layout-reset-btn {
  color: rgba(255, 255, 255, 0.9);
}

:global(.dark) .theme-toggle:hover,
:global(.dark) .settings-btn:hover,
:global(.dark) .layout-reset-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffe5d0;
}

/* 收藏目录样式 */
.favorites-section {
  margin: 16px 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 0;
}

.favorites-header {
  margin-bottom: 8px;
}

.favorites-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.favorites-toggle:hover {
  background: rgba(255, 122, 24, 0.1);
  border-color: rgba(255, 122, 24, 0.2);
}

.favorites-toggle.active {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
  color: var(--accent);
}

.favorites-icon {
  font-size: 0;
  line-height: 0;
  display: flex;
  align-items: center;
}

.favorites-title {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.favorites-count {
  font-size: 12px;
  background: var(--accent);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.favorites-list {
  margin-left: 12px;
}

.favorites-group {
  margin-bottom: 12px;
}

.favorites-group:last-child {
  margin-bottom: 0;
}

.favorites-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.favorites-group-name {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.favorites-group-count {
  background: rgba(255, 122, 24, 0.2);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 11px;
}

.favorites-item,
.favorites-feed-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.favorites-item:hover,
.favorites-feed-item:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: rgba(255, 122, 24, 0.15);
}

.favorites-item.active,
.favorites-feed-item.active {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
  color: var(--accent);
}

.favorites-item-icon {
  font-size: 0;
  line-height: 0;
  display: flex;
  align-items: center;
  opacity: 0.8;
}

.favorites-feed-icon {
  --feed-icon-size: 26px;
  opacity: 1;
}

.favorites-item-title,
.favorites-feed-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorites-item-count,
.favorites-feed-count {
  font-size: 11px;
  background: rgba(255, 122, 24, 0.15);
  color: var(--accent);
  padding: 1px 4px;
  border-radius: 6px;
  font-weight: 500;
}

.favorites-group-feeds {
  margin-left: 16px;
}

/* 深色模式收藏样式 */
:global(.dark) .favorites-section {
  border-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .favorites-toggle {
  color: var(--text-primary);
}

:global(.dark) .favorites-toggle:hover {
  background: rgba(255, 122, 24, 0.2);
  border-color: rgba(255, 122, 24, 0.4);
}

:global(.dark) .favorites-toggle.active {
  background: rgba(255, 122, 24, 0.25);
  border-color: rgba(255, 122, 24, 0.5);
}

:global(.dark) .favorites-group-header {
  color: var(--text-secondary);
}

:global(.dark) .favorites-item,
:global(.dark) .favorites-feed-item {
  color: var(--text-primary);
}

:global(.dark) .favorites-item:hover,
:global(.dark) .favorites-feed-item:hover {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
}

:global(.dark) .favorites-item.active,
:global(.dark) .favorites-feed-item.active {
  background: rgba(255, 122, 24, 0.25);
  border-color: rgba(255, 122, 24, 0.5);
}

:global(.dark) .timeline-action-btn {
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.25);
}

:global(.dark) .timeline-action-btn--ghost {
  background: rgba(15, 17, 21, 0.8);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

:global(.dark) .timeline-action-btn--ghost .timeline-action-btn__icon {
  background: rgba(255, 255, 255, 0.08);
}
</style>
