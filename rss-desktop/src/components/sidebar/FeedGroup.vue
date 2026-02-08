<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Feed, ViewType } from '../../types'
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
  availableGroups: string[]
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'group-click', groupName: string): void
  (e: 'toggle-collapse', groupName: string): void
  (e: 'group-row-click', groupName: string): void
  (e: 'select-feed', feedId: string): void
  (e: 'start-edit', feedId: string, groupName: string): void
  (e: 'save-edit', feedId: string, groupName: string): void
  (e: 'cancel-edit'): void
  (e: 'delete-feed', feedId: string): void
  (e: 'update:editingGroupName', value: string): void
  (e: 'mark-group-read', groupName: string): void
  (e: 'mark-feed-read', feedId: string): void
  (e: 'change-view-type', feedId: string, viewType: ViewType): void
  (e: 'move-to-group', feedId: string, groupName: string): void
  (e: 'set-custom-title', feedId: string, customTitle: string | null): void
  (e: 'delete-group', groupName: string): void
}>()

</script>

<template>
  <!-- Group Container -->
  <div class="mb-1">
    <!-- Group Header -->
    <div class="flex items-center relative group mb-0.5">
      <button
        class="flex-1 w-full px-2 py-2 flex items-center gap-2 cursor-pointer select-none transition-all duration-200 rounded-lg outline-none group/header"
        :class="{ 
          'bg-gradient-to-b from-[rgba(255,122,24,0.1)] via-[rgba(255,122,24,0.06)] to-[rgba(255,122,24,0.1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_4px_rgba(255,122,24,0.1)] text-[var(--text-primary)] font-semibold': !isCollapsed, 
          'bg-gradient-to-b from-[rgba(0,0,0,0.01)] to-[rgba(0,0,0,0.025)] dark:from-[rgba(255,255,255,0.03)] dark:to-[rgba(255,255,255,0.015)] text-[var(--text-secondary)] hover:from-[rgba(0,0,0,0.02)] hover:to-[rgba(0,0,0,0.04)]': isCollapsed 
        }"
        @click="emit('group-row-click', groupName)"
      >
        <!-- Expand/Collapse Arrow (LEFT) -->
        <span
          class="w-4 h-4 flex items-center justify-center transition-transform duration-200"
          :class="{ '-rotate-90': isCollapsed }"
          aria-hidden="true"
        >
          <svg
            class="w-3.5 h-3.5"
            :class="isCollapsed ? 'c-[var(--text-tertiary)]' : 'c-[var(--accent)]'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        
        <!-- Group Name -->
        <span class="flex-1 text-left text-[13px] truncate">{{ groupName }}</span>
        
        <!-- Unread Count Badge -->
        <span class="flex items-center">
          <span v-if="unreadCount" class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-gradient-to-b from-[var(--accent)] to-[#e56a10] text-white flex items-center justify-center text-[10px] font-semibold shadow-[0_1px_3px_rgba(255,122,24,0.3)]">
            {{ unreadCount }}
          </span>
        </span>
      </button>
      
      <!-- Allow deleting empty custom groups -->
      <button 
        v-if="feedCount === 0"
        @click.stop="emit('delete-group', groupName)"
        class="absolute right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[rgba(255,59,48,0.1)] transition-all duration-200 c-[var(--text-secondary)] hover:c-[#ff3b30] z-10"
        :title="t('groups.deleteGroup')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>

    <!-- Feeds List -->
    <div v-show="!isCollapsed" class="flex flex-col pl-1.5">
      <FeedItem
        v-for="feed in feeds"
        :key="feed.id"
        :feed="feed"
        :active="activeFeedId === feed.id"
        :is-editing="editingFeedId === feed.id"
        :editing-group-name="editingGroupName"
        :is-date-filter-active="isDateFilterActive"
        :time-filter-label="timeFilterLabel"
        :available-groups="availableGroups"
        @select="emit('select-feed', $event)"
        @start-edit="emit('start-edit', $event, feed.group_name)"
        @save-edit="emit('save-edit', $event, editingGroupName)"
        @cancel-edit="emit('cancel-edit')"
        @delete="emit('delete-feed', $event)"
        @update:editing-group-name="emit('update:editingGroupName', $event)"
        @mark-feed-read="emit('mark-feed-read', $event)"
        @change-view-type="(feedId, viewType) => emit('change-view-type', feedId, viewType)"
        @move-to-group="(feedId, groupName) => emit('move-to-group', feedId, groupName)"
        @set-custom-title="(feedId, customTitle) => emit('set-custom-title', feedId, customTitle)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
