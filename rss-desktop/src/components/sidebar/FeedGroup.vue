<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Feed } from '../../types'
import FeedItem from './FeedItem.vue'

defineProps<{
  groupName: string
  feeds: Feed[]
  isActive: boolean
  isCollapsed: boolean
  feedCount: number
  unreadCount: number
  activeFeedId: string | null
  editingFeedId: string | null
  editingGroupName: string
  isDateFilterActive: boolean
  timeFilterLabel: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'group-click', groupName: string): void
  (e: 'toggle-collapse', groupName: string): void
  (e: 'select-feed', feedId: string): void
  (e: 'start-edit', feedId: string, groupName: string): void
  (e: 'save-edit', feedId: string, groupName: string): void
  (e: 'cancel-edit'): void
  (e: 'delete-feed', feedId: string): void
  (e: 'update:editingGroupName', value: string): void
  (e: 'mark-group-read', groupName: string): void
  (e: 'mark-feed-read', feedId: string): void
}>()

</script>

<template>
  <div class="mb-3 rounded-xl overflow-hidden bg-[linear-gradient(180deg,#ffffff,rgba(245,247,252,0.94))] border border-[rgba(15,17,21,0.14)] shadow-[0_8px_18px_rgba(15,17,21,0.08)] transition-all duration-200 hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_10px_24px_rgba(15,17,21,0.1)] dark:bg-[linear-gradient(180deg,rgba(20,23,30,0.92),rgba(14,16,22,0.92))] dark:border-[rgba(255,255,255,0.18)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.45)] dark:hover:border-[rgba(255,138,61,0.5)]">
    <!-- Group Header -->
    <div class="flex items-center relative group">
      <button
        class="flex-1 border-none bg-transparent pl-3 pr-4 py-3 flex items-center gap-2 cursor-pointer transition-colors duration-200 font-semibold c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] dark:hover:bg-[rgba(255,122,24,0.15)] outline-none group/header"
        :class="{ 'bg-[rgba(255,122,24,0.15)]! c-[var(--accent)]! shadow-[inset_0_0_0_1px_rgba(255,122,24,0.3)]': isActive }"
        @click="emit('group-click', groupName)"
      >
        <span
          class="w-5 h-5 -ml-1 flex items-center justify-center c-[var(--text-secondary)] transition-colors duration-200 group-hover/header:c-[var(--accent)]"
          aria-hidden="true"
          @click.stop="emit('toggle-collapse', groupName)"
        >
          <svg
            class="w-3.5 h-3.5 transition-transform duration-200"
            :class="{ '-rotate-90': isCollapsed }"
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
        <span class="flex-1 text-left text-sm">{{ groupName }}</span>
        <span class="text-xs c-[var(--text-secondary)] font-normal">
          {{ t('feeds.feedCount', { count: feedCount }) }}
          <span v-if="unreadCount" class="font-semibold c-[#ff8a3d]">
            • {{ t('feeds.unreadCount', { count: unreadCount }) }}
          </span>
        </span>
      </button>
    </div>

    <!-- Feeds List -->
    <div v-show="!isCollapsed" class="bg-[rgba(245,247,251,0.9)] border-t border-[rgba(15,17,21,0.12)] dark:bg-[rgba(12,14,18,0.65)] dark:border-[rgba(255,255,255,0.14)]">
      <FeedItem
        v-for="feed in feeds"
        :key="feed.id"
        :feed="feed"
        :active="activeFeedId === feed.id"
        :is-editing="editingFeedId === feed.id"
        :editing-group-name="editingGroupName"
        :is-date-filter-active="isDateFilterActive"
        :time-filter-label="timeFilterLabel"
        @select="emit('select-feed', $event)"
        @start-edit="emit('start-edit', $event, feed.group_name)"
        @save-edit="emit('save-edit', $event, editingGroupName)"
        @cancel-edit="emit('cancel-edit')"
        @delete="emit('delete-feed', $event)"
        @update:editing-group-name="emit('update:editingGroupName', $event)"
        @mark-feed-read="emit('mark-feed-read', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
