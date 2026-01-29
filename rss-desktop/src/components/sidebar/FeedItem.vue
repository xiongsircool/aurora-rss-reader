<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
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
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const showViewTypeSubmenu = ref(false)

// 全局事件：关闭所有其他菜单
const CLOSE_ALL_MENUS_EVENT = 'feed-context-menu:close-all'

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()

  // 先关闭所有其他菜单
  window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT))

  // 计算菜单位置，确保不超出视口
  const menuWidth = 200
  const menuHeight = 220
  let x = e.clientX
  let y = e.clientY

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  contextMenuPos.value = { x, y }
  showViewTypeSubmenu.value = false

  // 延迟显示，确保其他菜单已关闭
  requestAnimationFrame(() => {
    showContextMenu.value = true
  })
}

function closeContextMenu() {
  showContextMenu.value = false
  showViewTypeSubmenu.value = false
}

function handleCloseAllMenus() {
  closeContextMenu()
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.feed-context-menu')) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  window.addEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAllMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAllMenus)
})

const { iconSrcFor, handleFeedIconLoad, handleFeedIconError, isFeedIconBroken, isFeedIconLoaded, getFeedColor, getFeedInitial } = useFeedIcons()

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
    class="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[0_6px_14px_rgba(15,17,21,0.05)] transition-all duration-200 my-1 mx-2 group"
    :class="{ 'border-[var(--accent)] bg-[rgba(255,122,24,0.08)] shadow-[0_14px_28px_rgba(255,122,24,0.15)]': active, 'hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_12px_24px_rgba(15,17,21,0.1)] hover:-translate-y-px': !active }"
    @contextmenu="handleContextMenu"
  >
    <button class="flex-1 min-w-0 border-none bg-transparent text-left flex items-center gap-3 p-0 c-[var(--text-primary)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)] outline-offset-2" @click="emit('select', feed.id)">
      <div
        class="w-[34px] h-[34px] rounded-[10px] overflow-hidden inline-flex items-center justify-center shrink-0 bg-[rgba(255,255,255,0.1)] c-white font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-transform duration-200 group-hover:scale-103 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
        :style="{ backgroundColor: getFeedColor(feed.id) }"
        aria-hidden="true"
      >
        <img
          v-show="!isFeedIconBroken(feed) && isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
          :src="iconSrcFor(feed.favicon_url) || undefined"
          :alt="`${feed.title || feed.url} 图标`"
          loading="lazy"
          decoding="async"
          @load="handleFeedIconLoad(feed.id, iconSrcFor(feed.favicon_url))"
          @error="handleFeedIconError(feed.id, iconSrcFor(feed.favicon_url))"
          class="w-[calc(100%-4px)] h-[calc(100%-4px)] object-contain bg-[rgba(255,255,255,0.8)] rounded-lg block p-[2px]"
        />
        <span 
          class="text-[0.78rem] uppercase tracking-wide" 
          v-show="isFeedIconBroken(feed) || !isFeedIconLoaded(iconSrcFor(feed?.favicon_url))"
        >
          {{ getFeedInitial(feed.title || feed.url) }}
        </span>
      </div>
      <div class="flex-1 flex flex-col gap-1 overflow-hidden">
        <span class="font-semibold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{{ feed.title || feed.url }}</span>
        <span class="text-[11px] c-[#8a90a3] whitespace-nowrap overflow-hidden text-ellipsis op-80" v-if="!isEditing">{{ feed.url }}</span>
        <div class="flex items-center gap-2 c-[var(--text-secondary)] text-[11px]" v-if="!isEditing">
          <span class="last-checked" :title="getFeedRefreshTooltip(feed)">
            <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-[var(--border-color)]" :class="{ 'bg-[#2ec4b6]': getFeedRefreshStatus(feed) === 'ok', 'bg-[#ff6b6b]': getFeedRefreshStatus(feed) === 'due', 'bg-[#9aa0a6]': getFeedRefreshStatus(feed) === 'never' }"></span>
            {{ formatLastChecked(feed.last_checked_at) }}
          </span>
        </div>
        <div v-else class="mt-1">
          <input
            :value="editingGroupName"
            @input="emit('update:editingGroupName', ($event.target as HTMLInputElement).value)"
            @click.stop
            placeholder="分组名称"
            class="w-full px-2 py-1 border border-[var(--border-color)] rounded-md text-xs bg-[var(--bg-surface)] c-[var(--text-primary)]"
          />
        </div>
      </div>
      <span
        class="min-w-6 h-6 rounded-full bg-[rgba(15,17,21,0.08)] grid place-items-center text-xs"
        v-if="feed.unread_count"
        :title="isDateFilterActive ? `仅统计${timeFilterLabel}内的未读文章` : '全部未读文章'"
      >
        {{ feed.unread_count }}
      </span>
    </button>
    <div class="flex gap-1.5 shrink-0" @click.stop>
      <button
        v-if="isEditing"
        @click="emit('save-edit', feed.id, editingGroupName)"
        class="border border-[var(--border-color)] bg-[var(--bg-surface)] p-[6px_10px] rounded-lg cursor-pointer text-[13px] transition-all c-[var(--text-primary)] hover:bg-[#34c759] hover:c-white hover:border-[var(--accent)] hover:-translate-y-px"
        title="保存"
      >
        ✓
      </button>
      <button
        v-if="isEditing"
        @click="emit('cancel-edit')"
        class="border border-[var(--border-color)] bg-[var(--bg-surface)] p-[6px_10px] rounded-lg cursor-pointer text-[13px] transition-all c-[var(--text-primary)] hover:bg-[#8e8e93] hover:c-white hover:border-[var(--accent)] hover:-translate-y-px"
        title="取消"
      >
        ✕
      </button>
      <button
        v-if="!isEditing"
        @click="emit('start-edit', feed.id, feed.group_name)"
        class="border border-[var(--border-color)] bg-[var(--bg-surface)] p-[6px_10px] rounded-lg cursor-pointer text-[13px] transition-all c-[var(--text-primary)] hover:bg-[#007aff] hover:c-white hover:border-[var(--accent)] hover:-translate-y-px"
        title="编辑"
      >
        ✎
      </button>
      <button
        @click="emit('delete', feed.id)"
        class="border border-[var(--border-color)] bg-[var(--bg-surface)] p-[6px_10px] rounded-lg cursor-pointer text-[13px] transition-all c-[var(--text-primary)] hover:bg-[#ff3b30] hover:c-white hover:border-[var(--accent)] hover:-translate-y-px"
        title="删除"
      >
        🗑
      </button>
    </div>
  </div>

  <!-- 右键菜单 (使用 Teleport 渲染到 body) -->
  <Teleport to="body">
    <div
      v-if="showContextMenu"
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

      <div class="h-px bg-[var(--border-color)] my-1.5"></div>

      <!-- 更改视图类型 (带子菜单) -->
      <div class="relative">
        <button
          @click="showViewTypeSubmenu = !showViewTypeSubmenu"
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
          class="absolute left-full top-0 ml-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[160px]"
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
