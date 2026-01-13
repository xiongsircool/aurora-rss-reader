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
}>()

</script>

<template>
  <div class="feed-group">
    <!-- Group Header -->
    <div class="group-header-wrapper">
      <button
        class="group-header"
        :class="{ active: isActive }"
        @click="emit('group-click', groupName)"
      >
        <span
          class="group-toggle"
          :class="{ collapsed: isCollapsed }"
          aria-hidden="true"
          @click.stop="emit('toggle-collapse', groupName)"
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
          {{ t('feeds.feedCount', { count: feedCount }) }}
          <span v-if="unreadCount" class="unread-count">
            • {{ t('feeds.unreadCount', { count: unreadCount }) }}
            <span v-if="isDateFilterActive" class="time-filter-hint">({{ timeFilterLabel }})</span>
          </span>
        </span>
      </button>
    </div>

    <!-- Feeds List -->
    <div v-show="!isCollapsed" class="group-feeds">
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
      />
    </div>
  </div>
</template>

<style scoped>
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

.group-header-wrapper {
  /* wrapper for potential future enhancements */
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
</style>
