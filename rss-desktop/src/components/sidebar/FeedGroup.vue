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
  <div class="mb-2 rounded-xl overflow-hidden bg-[rgba(255,255,255,0.3)] border border-[rgba(15,17,21,0.08)] transition-all duration-200 hover:bg-[rgba(255,255,255,0.5)] dark:bg-[rgba(15,17,21,0.4)] dark:border-[rgba(255,255,255,0.08)] dark:hover:bg-[rgba(15,17,21,0.6)]">
    <!-- Group Header -->
    <div class="flex items-center relative group">
      <button
        class="flex-1 border-none bg-transparent px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors duration-200 font-semibold c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] dark:hover:bg-[rgba(255,122,24,0.15)] outline-none group/header"
        :class="{ 'bg-[rgba(255,122,24,0.15)]! c-[var(--accent)]! shadow-[inset_0_0_0_1px_rgba(255,122,24,0.3)]': isActive }"
        @click="emit('group-click', groupName)"
      >
        <span
          class="w-5 h-5 flex items-center justify-center c-[var(--text-secondary)] transition-colors duration-200 group-hover/header:c-[var(--accent)]"
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
            <span v-if="isDateFilterActive" class="text-xs c-[var(--text-secondary)] ml-1 font-normal">({{ timeFilterLabel }})</span>
          </span>
        </span>
      </button>
      <!-- Mark Group as Read Button -->
      <button 
        v-if="unreadCount > 0"
        class="w-7 h-7 border-none bg-[rgba(52,199,89,0.15)] c-[#34c759] rounded-md cursor-pointer flex items-center justify-center transition-all duration-200 mr-2 opacity-0 hover:bg-[#34c759] hover:c-white hover:scale-105 group-hover:opacity-100 dark:bg-[rgba(52,199,89,0.2)]"
        @click.stop="emit('mark-group-read', groupName)"
        :title="t('articles.markGroupAsRead')"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      </button>
    </div>

    <!-- Feeds List -->
    <div v-show="!isCollapsed" class="bg-[rgba(255,255,255,0.2)] border-t border-[rgba(15,17,21,0.05)] dark:bg-[rgba(15,17,21,0.3)] dark:border-current dark:border-op-5">
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
