<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../../stores/feedStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import type { Feed, ViewType } from '../../types'
import SidebarHeader from './SidebarHeader.vue'
import AddFeedForm from './AddFeedForm.vue'
import OpmlActions from './OpmlActions.vue'
import FavoritesSection from './FavoritesSection.vue'
import FeedGroup from './FeedGroup.vue'
import ViewTypeNav from './ViewTypeNav.vue'

const props = defineProps<{
  // Header props
  logoSize: number
  darkMode: boolean
  
  // Feed management
  addingFeed: boolean
  importLoading: boolean
  
  // Favorites
  showFavoritesOnly: boolean
  selectedFavoriteFeed: string | null
  
  // Feed list
  collapsedGroups: Record<string, boolean>
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

  // View type
  (e: 'select-view-type', viewType: string): void
  (e: 'change-view-type', feedId: string, viewType: ViewType): void
}>()

const { t } = useI18n()
const feedStore = useFeedStore()
const favoritesStore = useFavoritesStore()

const feedMap = computed<Record<string, Feed>>(() => {
  return feedStore.feeds.reduce<Record<string, Feed>>((acc, feed) => {
    acc[feed.id] = feed
    return acc
  }, {})
})

function isGroupCollapsed(groupName: string): boolean {
  return !!props.collapsedGroups[groupName]
}
</script>

<template>
  <aside class="flex flex-col border-r border-[var(--border-color)] p-[24px_16px] bg-[var(--bg-surface)] shrink-0 min-w-180px box-border max-h-screen overflow-y-auto min-h-0 w-[var(--sidebar-width,280px)] transition-[width] duration-160 ease-out sidebar lt-md:w-full! lt-md:h-auto lt-md:max-h-none lt-md:border-r-0 lt-md:border-b lt-md:overflow-visible">
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
      :total-starred="favoritesStore.totalStarred"
      :grouped-stats="favoritesStore.groupedStats"
      :show-favorites-only="showFavoritesOnly"
      :selected-favorite-feed="selectedFavoriteFeed"
      :feed-map="feedMap"
      @toggle-favorites="emit('toggle-favorites')"
      @select-feed="emit('select-favorite-feed', $event)"
    />

    <!-- View Type Navigation -->
    <ViewTypeNav
      v-show="!showFavoritesOnly"
      @select="emit('select-view-type', $event)"
    />

    <div class="flex-1" v-show="!showFavoritesOnly">
      <!-- Group controls -->
      <div class="flex gap-1.5 mb-2 px-1" v-if="feedStore.sortedGroupNames.length > 1">
        <button @click="emit('expand-all')" class="border border-[rgba(15,17,21,0.1)] dark:border-[rgba(255,255,255,0.1)] bg-transparent c-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:c-[var(--text-primary)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]" :title="t('feeds.groupControlTitle')">
          {{ t('common.expandAll') }}
        </button>
        <button @click="emit('collapse-all')" class="border border-[rgba(15,17,21,0.1)] dark:border-[rgba(255,255,255,0.1)] bg-transparent c-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:c-[var(--text-primary)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]" :title="t('feeds.groupControlCollapseTitle')">
          {{ t('common.collapseAll') }}
        </button>
      </div>

      <!-- Feed groups -->
      <FeedGroup
        v-for="groupName in feedStore.sortedGroupNames"
        :key="groupName"
        :group-name="groupName"
        :feeds="feedStore.groupedFeeds[groupName] || []"
        :is-active="feedStore.activeGroupName === groupName"
        :is-collapsed="isGroupCollapsed(groupName)"
        :feed-count="feedStore.groupStats[groupName]?.feedCount || 0"
        :unread-count="feedStore.groupStats[groupName]?.unreadCount || 0"
        :active-feed-id="feedStore.activeFeedId"
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
        @change-view-type="(feedId, viewType) => emit('change-view-type', feedId, viewType)"
      />
    </div>
  </aside>
</template>

<style scoped>
/* Migrated to UnoCSS - Scrollbar styles remain */
.sidebar::-webkit-scrollbar { width: 8px; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.sidebar:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .sidebar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .sidebar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
</style>
