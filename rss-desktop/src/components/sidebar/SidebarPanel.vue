<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Feed } from '../../types'
import SidebarHeader from './SidebarHeader.vue'
import AddFeedForm from './AddFeedForm.vue'
import OpmlActions from './OpmlActions.vue'
import FavoritesSection from './FavoritesSection.vue'
import FeedGroup from './FeedGroup.vue'

interface FeedStat {
  id: string
  title: string
  count: number
}

interface GroupStat {
  total: number
  feeds: FeedStat[]
}

interface FeedGroupStats {
  feedCount: number
  unreadCount: number
}

const props = defineProps<{
  // Header props
  logoSize: number
  darkMode: boolean
  
  // Feed management
  addingFeed: boolean
  importLoading: boolean
  
  // Favorites
  totalStarred: number
  groupedStats: Record<string, GroupStat>
  showFavoritesOnly: boolean
  selectedFavoriteFeed: string | null
  feedMap: Record<string, Feed>
  
  // Feed list
  sortedGroupNames: string[]
  groupedFeeds: Record<string, Feed[]>
  groupStats: Record<string, FeedGroupStats>
  collapsedGroups: Record<string, boolean>
  activeFeedId: string | null
  activeGroupName: string | null
  editingFeedId: string | null
  editingGroupName: string
  isDateFilterActive: boolean
  timeFilterLabel: string
}>()

const emit = defineEmits<{
  // Header events
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'reset-layout'): void
  
  // Feed management
  (e: 'add-feed', url: string): void
  (e: 'export-opml'): void
  (e: 'import-opml', file: File): void
  
  // Favorites
  (e: 'toggle-favorites'): void
  (e: 'select-favorite-feed', feedId: string | null): void
  
  // Feed groups
  (e: 'group-click', groupName: string): void
  (e: 'toggle-collapse', groupName: string): void
  (e: 'expand-all'): void
  (e: 'collapse-all'): void
  
  // Feed items
  (e: 'select-feed', feedId: string): void
  (e: 'start-edit', feedId: string, groupName: string): void
  (e: 'save-edit', feedId: string, groupName: string): void
  (e: 'cancel-edit'): void
  (e: 'delete-feed', feedId: string): void
  (e: 'update:editingGroupName', value: string): void
  
  // Mark as read
  (e: 'mark-group-read', groupName: string): void
  (e: 'mark-feed-read', feedId: string): void
}>()

const { t } = useI18n()

function isGroupCollapsed(groupName: string): boolean {
  return !!props.collapsedGroups[groupName]
}
</script>

<template>
  <aside class="sidebar">
    <SidebarHeader
      :logo-size="logoSize"
      :dark-mode="darkMode"
      @toggle-theme="emit('toggle-theme')"
      @open-settings="emit('open-settings')"
      @reset-layout="emit('reset-layout')"
    />
    
    <AddFeedForm
      :adding-feed="addingFeed"
      @add-feed="emit('add-feed', $event)"
    />
    
    <OpmlActions
      :import-loading="importLoading"
      @export="emit('export-opml')"
      @import="emit('import-opml', $event)"
    />
    
    <FavoritesSection
      :total-starred="totalStarred"
      :grouped-stats="groupedStats"
      :show-favorites-only="showFavoritesOnly"
      :selected-favorite-feed="selectedFavoriteFeed"
      :feed-map="feedMap"
      @toggle-favorites="emit('toggle-favorites')"
      @select-feed="emit('select-favorite-feed', $event)"
    />
    
    <div class="feed-list" v-show="!showFavoritesOnly">
      <!-- Group controls -->
      <div class="group-controls" v-if="sortedGroupNames.length > 1">
        <button @click="emit('expand-all')" class="group-control-btn" :title="t('feeds.groupControlTitle')">
          {{ t('common.expandAll') }}
        </button>
        <button @click="emit('collapse-all')" class="group-control-btn" :title="t('feeds.groupControlCollapseTitle')">
          {{ t('common.collapseAll') }}
        </button>
      </div>

      <!-- Feed groups -->
      <FeedGroup
        v-for="groupName in sortedGroupNames"
        :key="groupName"
        :group-name="groupName"
        :feeds="groupedFeeds[groupName] || []"
        :is-active="activeGroupName === groupName"
        :is-collapsed="isGroupCollapsed(groupName)"
        :feed-count="groupStats[groupName]?.feedCount || 0"
        :unread-count="groupStats[groupName]?.unreadCount || 0"
        :active-feed-id="activeFeedId"
        :editing-feed-id="editingFeedId"
        :editing-group-name="editingGroupName"
        :is-date-filter-active="isDateFilterActive"
        :time-filter-label="timeFilterLabel"
        @group-click="emit('group-click', $event)"
        @toggle-collapse="emit('toggle-collapse', $event)"
        @select-feed="emit('select-feed', $event)"
        @start-edit="emit('start-edit', $event, groupName)"
        @save-edit="emit('save-edit', $event, editingGroupName)"
        @cancel-edit="emit('cancel-edit')"
        @delete-feed="emit('delete-feed', $event)"
        @update:editing-group-name="emit('update:editingGroupName', $event)"
        @mark-group-read="emit('mark-group-read', $event)"
        @mark-feed-read="emit('mark-feed-read', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
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
  width: var(--sidebar-width, 280px);
  transition: width 160ms ease;
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

.sidebar::-webkit-scrollbar { width: 8px; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.sidebar:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .sidebar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .sidebar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }

:global(.dark) .group-control-btn {
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark) .group-control-btn:hover {
  background: rgba(255, 122, 24, 0.15);
  border-color: rgba(255, 122, 24, 0.3);
}

@media (max-width: 960px) {
  .sidebar {
    width: 100% !important;
    height: auto;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    overflow: visible;
  }
}
</style>
