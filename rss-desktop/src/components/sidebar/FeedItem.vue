<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Feed, ViewType } from '../../types'
import { VIEW_TYPES, VIEW_TYPE_LABELS } from '../../types'
import { useFeedIcons } from '../../composables/useFeedIcons'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  feed: Feed
  active: boolean
  isEditing: boolean
  editingGroupName: string
  isDateFilterActive: boolean
  timeFilterLabel: string
  availableGroups: string[]
}>()

const emit = defineEmits<{
  (e: 'select', feedId: string): void
  (e: 'start-edit', feedId: string, groupName: string): void
  (e: 'save-edit', feedId: string, groupName: string): void
  (e: 'cancel-edit'): void
  (e: 'delete', feedId: string): void
  (e: 'update:editingGroupName', value: string): void
  (e: 'mark-feed-read', feedId: string): void
  (e: 'change-view-type', feedId: string, viewType: ViewType): void
  (e: 'move-to-group', feedId: string, groupName: string): void
  (e: 'set-custom-title', feedId: string, customTitle: string | null): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 获取显示名称：优先使用 custom_title，否则使用 title 或 url
const displayName = computed(() => {
  return props.feed.custom_title || props.feed.title || props.feed.url
})

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuRef = ref<HTMLElement | null>(null)
const lastContextMenuClick = ref<{ x: number; y: number } | null>(null)
const showViewTypeSubmenu = ref(false)
const showGroupSubmenu = ref(false)
const groupSubmenuRef = ref<HTMLElement | null>(null)
const viewTypeSubmenuRef = ref<HTMLElement | null>(null)

// 图标图片引用
const iconImgRef = ref<HTMLImageElement | null>(null)

// 设置别名状态（子菜单形式）
const showAliasSubmenu = ref(false)
const aliasInputValue = ref('')
const aliasInputRef = ref<HTMLInputElement | null>(null)
const aliasSubmenuRef = ref<HTMLElement | null>(null)
const aliasSubmenuStyle = ref<{ top?: string; bottom?: string }>({})

// 子菜单位置样式
const groupSubmenuStyle = ref<{ top?: string; bottom?: string }>({})
const viewTypeSubmenuStyle = ref<{ top?: string; bottom?: string }>({})

// 全局事件：关闭所有其他菜单
const CLOSE_ALL_MENUS_EVENT = 'feed-context-menu:close-all'

function updateContextMenuPosition() {
  const clickPos = lastContextMenuClick.value
  if (!clickPos) return

  const rect = contextMenuRef.value?.getBoundingClientRect()
  const menuWidth = rect?.width || 220
  const menuHeight = rect?.height || 320
  const padding = 10

  let x = clickPos.x
  let y = clickPos.y

  if (x + menuWidth > window.innerWidth - padding) {
    x = window.innerWidth - menuWidth - padding
  }
  if (y + menuHeight > window.innerHeight - padding) {
    y = window.innerHeight - menuHeight - padding
  }

  x = Math.max(padding, x)
  y = Math.max(padding, y)

  contextMenuPos.value = { x, y }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()

  // 先关闭所有其他菜单
  window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT))

  lastContextMenuClick.value = { x: e.clientX, y: e.clientY }
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
  showViewTypeSubmenu.value = false
  showGroupSubmenu.value = false

  // 延迟显示，确保其他菜单已关闭
  requestAnimationFrame(() => {
    showContextMenu.value = true
    nextTick(() => updateContextMenuPosition())
  })
}

function closeContextMenu() {
  showContextMenu.value = false
  showViewTypeSubmenu.value = false
  showGroupSubmenu.value = false
  showAliasSubmenu.value = false
  lastContextMenuClick.value = null
  aliasInputValue.value = ''
  groupSubmenuStyle.value = {}
  viewTypeSubmenuStyle.value = {}
  aliasSubmenuStyle.value = {}
}

// 打开别名子菜单
function openAliasSubmenu() {
  aliasInputValue.value = props.feed.custom_title || ''
  showAliasSubmenu.value = true
  showViewTypeSubmenu.value = false
  showGroupSubmenu.value = false
  // 自动聚焦输入框
  nextTick(() => {
    updateSubmenuPosition(aliasSubmenuRef.value, aliasSubmenuStyle)
    aliasInputRef.value?.focus()
  })
}

// 保存别名
function saveAlias() {
  const trimmed = aliasInputValue.value.trim()
  emit('set-custom-title', props.feed.id, trimmed || null)
  closeContextMenu()
}

// 计算子菜单位置，确保不超出视口
function updateSubmenuPosition(submenuEl: HTMLElement | null, styleRef: typeof groupSubmenuStyle) {
  if (!submenuEl) return

  requestAnimationFrame(() => {
    const rect = submenuEl.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    // 如果子菜单底部超出视口
    if (rect.bottom > viewportHeight - 10) {
      // 改为从底部对齐
      styleRef.value = { bottom: '0', top: 'auto' }
    } else {
      styleRef.value = { top: '0', bottom: 'auto' }
    }
  })
}

// 监听子菜单显示状态，自动调整位置
watch(showGroupSubmenu, (show) => {
  if (show) {
    nextTick(() => updateSubmenuPosition(groupSubmenuRef.value, groupSubmenuStyle))
  }
})

watch(showViewTypeSubmenu, (show) => {
  if (show) {
    nextTick(() => updateSubmenuPosition(viewTypeSubmenuRef.value, viewTypeSubmenuStyle))
  }
})

function handleCloseAllMenus() {
  closeContextMenu()
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.feed-context-menu')) {
    closeContextMenu()
  }
}

// Feed 图标相关
const { iconSrcFor, handleFeedIconLoad, handleFeedIconError, isFeedIconBroken, isFeedIconLoaded, getFeedColor, getFeedInitial } = useFeedIcons()

// 检查图标是否有效（非 1x1 占位符）
function checkIconValidity(e?: Event) {
  const img = e ? (e.target as HTMLImageElement) : iconImgRef.value
  if (!img) return
  
  const iconUrl = iconSrcFor(props.feed.favicon_url)
  if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
    // 1x1 占位符，标记为损坏
    handleFeedIconError(props.feed.id, iconUrl)
  } else {
    // 有效图片
    handleFeedIconLoad(props.feed.id, iconUrl)
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  window.addEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAllMenus)
  
  // 检查已缓存加载的图标是否有效
  nextTick(() => {
    const img = iconImgRef.value
    if (img && img.complete) {
      checkIconValidity()
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAllMenus)
})



import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const refreshIntervalMinutes = computed(() => {
  if (!settingsStore.settings.auto_refresh) return null
  return settingsStore.settings.fetch_interval_minutes
})

function formatLastChecked(date?: string | null) {
  if (!date) return '未刷新'
  return dayjs(date).format('MM-DD HH:mm')
}

function getFeedRefreshStatus(_feed: Feed): 'ok' | 'due' | 'never' {
  if (!_feed.last_checked_at) return 'never'
  if (!refreshIntervalMinutes.value) return 'ok'
  const minutes = dayjs().diff(dayjs(_feed.last_checked_at), 'minute')
  return minutes > refreshIntervalMinutes.value ? 'due' : 'ok'
}

function getFeedRefreshTooltip(_feed: Feed): string {
  if (!_feed.last_checked_at) {
    if (!refreshIntervalMinutes.value) return '从未刷新'
    return `从未刷新\n抓取间隔: ${refreshIntervalMinutes.value} 分钟`
  }

  const lastChecked = dayjs(_feed.last_checked_at).format('YYYY-MM-DD HH:mm:ss')
  if (!refreshIntervalMinutes.value) {
    return `最后刷新: ${lastChecked}\n自动刷新已关闭`
  }

  const minutes = dayjs().diff(dayjs(_feed.last_checked_at), 'minute')
  const overdue = Math.max(0, minutes - refreshIntervalMinutes.value)
  const statusText = minutes > refreshIntervalMinutes.value ? `已超时 ${overdue} 分钟` : '正常'
  return `最后刷新: ${lastChecked}\n抓取间隔: ${refreshIntervalMinutes.value} 分钟\n状态: ${statusText}`
}
</script>

<template>
  <div
    class="flex items-center gap-2.5 px-2.5 py-2 mb-1 rounded-lg cursor-pointer transition-all duration-200 group relative select-none"
    :class="{ 
      'bg-gradient-to-b from-[rgba(255,122,24,0.18)] via-[rgba(255,122,24,0.12)] to-[rgba(255,122,24,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.05),0_2px_8px_rgba(255,122,24,0.2)] c-[var(--accent)] border border-[rgba(255,122,24,0.3)]': active, 
      'bg-gradient-to-b from-white via-[#fafafa] to-[#f5f5f5] dark:from-[rgba(255,255,255,0.06)] dark:via-[rgba(255,255,255,0.04)] dark:to-[rgba(255,255,255,0.02)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_3px_8px_rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.12)] text-[var(--text-primary)]': !active 
    }"
    @click="emit('select', feed.id)"
    @contextmenu="handleContextMenu"
  >
    <!-- Icon -->
    <div
      class="w-5.5 h-5.5 rounded-md overflow-hidden shrink-0 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
      :style="{ 
        backgroundColor: (!isFeedIconBroken(feed) && isFeedIconLoaded(iconSrcFor(feed?.favicon_url))) 
          ? (active ? 'rgba(255,122,24,0.1)' : 'transparent') 
          : getFeedColor(feed.id) 
      }"
      aria-hidden="true"
    >
      <img
        ref="iconImgRef"
        v-show="!isFeedIconBroken(feed) && isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
        :src="iconSrcFor(feed.favicon_url) || undefined"
        :alt="`${feed.title || feed.url} 图标`"
        loading="lazy"
        decoding="async"
        @load="checkIconValidity"
        @error="handleFeedIconError(feed.id, iconSrcFor(feed.favicon_url))"
        class="w-full h-full object-contain"
      />
      <span
        class="text-[10px] uppercase text-white font-bold leading-none"
        v-show="isFeedIconBroken(feed) || !isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
      >
        {{ getFeedInitial(displayName) }}
      </span>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex items-center justify-between">
        <span class="text-[13px] truncate font-medium leading-tight">{{ displayName }}</span>
        <span
          v-if="feed.unread_count && !isEditing"
          class="min-w-[1.25rem] h-4 px-1 rounded-full bg-[rgba(15,17,21,0.08)] dark:bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[10px] font-medium transition-colors"
          :class="{ 'bg-[var(--accent)] text-white': active }"
          :title="isDateFilterActive ? `仅统计${timeFilterLabel}内的未读文章` : '全部未读文章'"
        >
          {{ feed.unread_count }}
        </span>
      </div>
      
      <!-- Editing Input -->
      <div v-if="isEditing" class="mt-1" @click.stop>
        <input
          :value="editingGroupName"
          @input="emit('update:editingGroupName', ($event.target as HTMLInputElement).value)"
          placeholder="分组名称"
          class="w-full px-1.5 py-0.5 border border-[var(--active-border)] rounded text-xs bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
          @keyup.enter="emit('save-edit', feed.id, editingGroupName)"
          @keyup.esc="emit('cancel-edit')"
        />
      </div>
    </div>

    <!-- Hover Actions (Absolute positioned to save space/layout shift) -->
    <div 
      v-if="!isEditing"
      class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface)] pl-2 shadow-[-10px_0_10px_-5px_var(--bg-surface)]"
      :class="{ 'bg-transparent shadow-none': active }"
      @click.stop
    >
      <button
        @click="emit('start-edit', feed.id, feed.group_name)"
        class="p-1 rounded hover:bg-[rgba(0,0,0,0.05)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title="编辑"
      >
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
      <button
        @click="emit('delete', feed.id)"
        class="p-1 rounded hover:bg-[rgba(255,59,48,0.1)] text-[var(--text-secondary)] hover:text-[#ff3b30] transition-colors"
        title="删除"
      >
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>

    <!-- Edit Actions -->
    <div v-else class="flex gap-1 ml-2" @click.stop>
      <button
        @click="emit('save-edit', feed.id, editingGroupName)"
        class="p-1 rounded hover:bg-[rgba(52,199,89,0.1)] text-[#34c759]"
        title="保存"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button
        @click="emit('cancel-edit')"
        class="p-1 rounded hover:bg-[rgba(142,142,147,0.1)] text-[#8e8e93]"
        title="取消"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>

  <!-- 右键菜单 (使用 Teleport 渲染到 body) -->
  <Teleport to="body">
    <div
      v-if="showContextMenu"
      ref="contextMenuRef"
      class="feed-context-menu fixed z-[9999] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[200px]"
      :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }"
    >
      <!-- 标记已读 -->
      <button
        @click="emit('mark-feed-read', feed.id); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>{{ t('articles.markAsRead') }}</span>
      </button>

      <!-- 编辑分组 -->
      <button
        @click="emit('start-edit', feed.id, feed.group_name); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>{{ t('feeds.editTitle') }}</span>
      </button>

      <!-- 设置别名 (带子菜单) -->
      <div class="relative">
        <button
          @click="openAliasSubmenu"
          class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
          <span class="flex-1">{{ t('feeds.setAlias') }}</span>
          <span v-if="feed.custom_title" class="text-[11px] c-[var(--text-tertiary)] max-w-16 truncate mr-1">{{ feed.custom_title }}</span>
          <svg class="w-3 h-3 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- 别名输入子菜单 -->
        <div
          v-if="showAliasSubmenu"
          ref="aliasSubmenuRef"
          class="absolute left-full ml-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] p-3 min-w-[220px]"
          :style="aliasSubmenuStyle"
          @click.stop
        >
          <div class="flex flex-col gap-2">
            <input
              ref="aliasInputRef"
              v-model="aliasInputValue"
              :placeholder="feed.title || feed.url"
              class="w-full px-2.5 py-2 border-2 border-[var(--accent)] rounded-lg text-[13px] bg-white dark:bg-[#1a1d24] c-[var(--text-primary)] focus:outline-none shadow-[0_0_0_3px_rgba(255,122,24,0.2)]"
              @keyup.enter="saveAlias"
              @keyup.escape="showAliasSubmenu = false"
            />
            <div class="flex justify-between items-center">
              <p class="text-[11px] c-[var(--text-tertiary)]">{{ t('feeds.aliasHint') }}</p>
              <button
                @click="saveAlias"
                class="px-3 py-1.5 bg-[var(--accent)] c-white rounded-lg text-[12px] font-medium hover:op-90 shadow-sm"
              >
                {{ t('common.save') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="h-px bg-[var(--border-color)] my-1.5"></div>

      <!-- 更改视图类型 (带子菜单) -->
      <div class="relative">
        <button
          @click="showViewTypeSubmenu = !showViewTypeSubmenu; showGroupSubmenu = false; showAliasSubmenu = false"
          class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span class="flex-1">{{ t('feeds.changeViewType') }}</span>
          <span class="text-[11px] c-[var(--text-tertiary)] mr-1">{{ VIEW_TYPE_LABELS[feed.view_type] }}</span>
          <svg class="w-3 h-3 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- 视图类型子菜单 -->
        <div
          v-if="showViewTypeSubmenu"
          ref="viewTypeSubmenuRef"
          class="absolute left-full ml-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[160px]"
          :style="viewTypeSubmenuStyle"
        >
          <button
            v-for="vt in VIEW_TYPES"
            :key="vt"
            @click="emit('change-view-type', feed.id, vt); closeContextMenu()"
            class="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
            :class="{ 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]! font-medium': feed.view_type === vt }"
          >
            <svg v-if="vt === 'articles'" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <svg v-else-if="vt === 'social'" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <svg v-else-if="vt === 'pictures'" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <svg v-else-if="vt === 'videos'" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
            <svg v-else-if="vt === 'audio'" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
            <svg v-else class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>{{ VIEW_TYPE_LABELS[vt] }}</span>
            <svg v-if="feed.view_type === vt" class="w-4 h-4 ml-auto c-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 移动到分组 (带子菜单) -->
      <div class="relative">
        <button
          @click="showGroupSubmenu = !showGroupSubmenu; showViewTypeSubmenu = false; showAliasSubmenu = false"
          class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="flex-1">{{ t('feeds.moveToGroup') }}</span>
          <span class="text-[11px] c-[var(--text-tertiary)] mr-1 max-w-20 truncate">{{ feed.group_name || t('feeds.ungrouped') }}</span>
          <svg class="w-3 h-3 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- 分组子菜单 -->
        <div
          v-if="showGroupSubmenu"
          ref="groupSubmenuRef"
          class="absolute left-full ml-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[160px] max-h-[240px] overflow-y-auto"
          :style="groupSubmenuStyle"
        >
          <button
            v-for="group in availableGroups"
            :key="group"
            @click="emit('move-to-group', feed.id, group); closeContextMenu()"
            class="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
            :class="{ 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]! font-medium': feed.group_name === group }"
          >
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="flex-1 truncate">{{ group }}</span>
            <svg v-if="feed.group_name === group" class="w-4 h-4 shrink-0 c-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="h-px bg-[var(--border-color)] my-1.5"></div>

      <!-- 删除订阅 -->
      <button
        @click="emit('delete', feed.id); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,59,48,0.1)] transition-colors c-[#ff3b30]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>{{ t('feeds.deleteTitle') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
