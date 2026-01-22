<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Feed } from '../../types'
import { useFeedIcons } from '../../composables/useFeedIcons'
import { useSettingsStore } from '../../stores/settingsStore'

defineProps<{
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
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

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
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
