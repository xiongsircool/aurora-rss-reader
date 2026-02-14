<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../../stores/feedStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import type { Feed, ViewType } from '../../types'
import SidebarHeader from './SidebarHeader.vue'
import AddFeedForm from './AddFeedForm.vue'
import AddFeedPopover from './AddFeedPopover.vue'
import OpmlActions from './OpmlActions.vue'
import FavoritesSection from './FavoritesSection.vue'
import CollectionsSection from './CollectionsSection.vue'
import TagsSection from './TagsSection.vue'
import QuickNavBar from './QuickNavBar.vue'
import FeedGroup from './FeedGroup.vue'
import ViewTypeNav from './ViewTypeNav.vue'
import ConfirmModal from '../common/ConfirmModal.vue'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import type { ViewMode } from '../../composables/useViewMode'

export type { ViewMode }

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
  
  // View mode
  viewMode: ViewMode
  activeCollectionId: string | null
  activeTagId: string | null
  activeTagView: 'tag' | 'pending' | 'untagged' | 'digest' | null
  
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
  (e: 'group-row-click', groupName: string): void
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

  // Move to group
  (e: 'move-to-group', feedId: string, groupName: string): void

  // Custom title
  (e: 'set-custom-title', feedId: string, customTitle: string | null): void

  // Collections
  (e: 'toggle-collections'): void
  (e: 'select-collection', id: string): void
  
  // Tags
  (e: 'toggle-tags'): void
  (e: 'select-tag', id: string): void
  (e: 'select-tag-view', view: 'pending' | 'untagged' | 'digest'): void
  (e: 'open-tag-settings'): void
}>()

const { t } = useI18n()
const feedStore = useFeedStore()
const favoritesStore = useFavoritesStore()
const showCreateGroupModal = ref(false)
const newGroupName = ref('')
const groupNameInput = ref<HTMLInputElement | null>(null)
const {
  show: confirmShow,
  options: confirmOptions,
  requestConfirm,
  handleConfirm,
  handleCancel
} = useConfirmDialog()

// --- Compact mode state ---
const sidebarCompact = ref(localStorage.getItem('sidebar-compact') === 'true')
const showAddFeedPopover = ref(false)
const showMoreMenu = ref(false)
const moreMenuRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(sidebarCompact, (val) => {
  localStorage.setItem('sidebar-compact', String(val))
})

function toggleCompact() {
  sidebarCompact.value = !sidebarCompact.value
  // Close any open popovers when switching modes
  showAddFeedPopover.value = false
  showMoreMenu.value = false
}

function handleMoreMenuClickOutside(e: MouseEvent) {
  if (moreMenuRef.value && !moreMenuRef.value.contains(e.target as Node)) {
    showMoreMenu.value = false
  }
}

function handleMoreMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showMoreMenu.value = false
}

watch(showMoreMenu, (visible) => {
  if (visible) {
    document.addEventListener('mousedown', handleMoreMenuClickOutside)
    document.addEventListener('keydown', handleMoreMenuKeydown)
  } else {
    document.removeEventListener('mousedown', handleMoreMenuClickOutside)
    document.removeEventListener('keydown', handleMoreMenuKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleMoreMenuClickOutside)
  document.removeEventListener('keydown', handleMoreMenuKeydown)
})

function handleMoreExport() {
  showMoreMenu.value = false
  emit('export-opml')
}

function handleMoreImport() {
  showMoreMenu.value = false
  fileInputRef.value?.click()
}

function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  emit('import-opml', file)
  if (target) target.value = ''
}

// --- Existing logic ---
const showFeedsArea = computed(() => props.viewMode === 'feeds' || props.viewMode === 'favorites')
const collectionsExpanded = computed(() => props.viewMode === 'collection')
const tagsExpanded = computed(() => props.viewMode === 'tag')

const feedMap = computed<Record<string, Feed>>(() => {
  return feedStore.feeds.reduce<Record<string, Feed>>((acc, feed) => {
    acc[feed.id] = feed
    return acc
  }, {})
})

const addFeedTargetGroupName = computed(() => {
  if (props.showFavoritesOnly) return null
  let targetGroupName = feedStore.activeGroupName
  if (!targetGroupName && feedStore.activeFeedId) {
    const activeFeed = feedStore.feeds.find((feed) => feed.id === feedStore.activeFeedId)
    targetGroupName = activeFeed?.group_name ?? null
  }
  return targetGroupName
})

function createNewGroup() {
  newGroupName.value = ''
  showCreateGroupModal.value = true
}

function closeCreateGroupModal() {
  showCreateGroupModal.value = false
}

function submitCreateGroup() {
  const name = newGroupName.value.trim()
  if (!name) return

  feedStore.createGroup(name)
  closeCreateGroupModal()
  newGroupName.value = ''
}

async function handleDeleteGroup(groupName: string) {
  const confirmMessage = feedStore.groupStats[groupName]?.feedCount === 0
    ? t('groups.deleteConfirm')
    : t('groups.deleteConfirmWithFeeds')

  const confirmed = await requestConfirm({
    title: t('groups.deleteGroup'),
    message: confirmMessage,
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  })

  if (!confirmed) return
  feedStore.deleteGroup(groupName)
}

function isGroupCollapsed(groupName: string): boolean {
  return !!props.collapsedGroups[groupName]
}

watch(showCreateGroupModal, (visible) => {
  if (!visible) return
  nextTick(() => groupNameInput.value?.focus())
})
</script>

<template>
  <aside class="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 min-w-180px box-border max-h-screen overflow-y-auto min-h-0 w-[var(--sidebar-width,280px)] transition-[width] duration-160 ease-out sidebar lt-md:w-full! lt-md:h-auto lt-md:max-h-none lt-md:border-r-0 lt-md:border-b lt-md:overflow-visible" :class="sidebarCompact ? 'p-[12px_12px]' : 'p-[24px_16px]'">
    
    <!-- ============ COMPACT MODE ============ -->
    <template v-if="sidebarCompact">
      <div class="relative">
        <SidebarHeader
          :logo-size="28"
          :dark-mode="darkMode"
          :compact="true"
          @toggle-theme="emit('toggle-theme')"
          @open-settings="emit('open-settings')"
          @reset-layout="emit('reset-layout')"
          @toggle-compact="toggleCompact"
          @open-add-feed="showAddFeedPopover = !showAddFeedPopover"
          @open-more-menu="showMoreMenu = !showMoreMenu"
        />

        <!-- Add Feed Popover -->
        <AddFeedPopover
          v-if="showAddFeedPopover"
          :adding-feed="addingFeed"
          :target-group-name="addFeedTargetGroupName"
          @add-feed="emit('add-feed', $event); showAddFeedPopover = false"
          @close="showAddFeedPopover = false"
        />

        <!-- More Menu Dropdown -->
        <div
          v-if="showMoreMenu"
          ref="moreMenuRef"
          class="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)]"
        >
          <button
            @click="handleMoreExport"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left bg-transparent border-none c-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[rgba(255,122,24,0.08)] dark:hover:bg-[rgba(255,255,255,0.06)]"
          >
            <svg class="w-4 h-4 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {{ t('opml.export') }}
          </button>
          <button
            @click="handleMoreImport"
            :disabled="importLoading"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left bg-transparent border-none c-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[rgba(255,122,24,0.08)] dark:hover:bg-[rgba(255,255,255,0.06)] disabled:op-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4 shrink-0 c-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ importLoading ? t('toast.importing') : t('opml.import') }}
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".opml,.xml"
          @change="handleFileInputChange"
          class="hidden"
        />
      </div>

      <!-- QuickNavBar: compact pills for Favorites/Collections/Tags -->
      <QuickNavBar
        :view-mode="viewMode"
        @toggle-favorites="emit('toggle-favorites')"
        @toggle-collections="emit('toggle-collections')"
        @toggle-tags="emit('toggle-tags')"
      />

      <!-- Compact mode: show expanded sections for collections/tags when active -->
      <FavoritesSection
        v-if="viewMode === 'favorites'"
        :total-starred="favoritesStore.totalStarred"
        :grouped-stats="favoritesStore.groupedStats"
        :show-favorites-only="showFavoritesOnly"
        :selected-favorite-feed="selectedFavoriteFeed"
        :feed-map="feedMap"
        @toggle-favorites="emit('toggle-favorites')"
        @select-feed="emit('select-favorite-feed', $event)"
      />

      <CollectionsSection
        v-if="viewMode === 'collection'"
        :expanded="true"
        :active-collection-id="activeCollectionId"
        @toggle="emit('toggle-collections')"
        @select-collection="emit('select-collection', $event)"
      />

      <TagsSection
        v-if="viewMode === 'tag'"
        :expanded="true"
        :active-tag-id="activeTagId"
        :active-tag-view="activeTagView"
        @toggle="emit('toggle-tags')"
        @select-tag="emit('select-tag', $event)"
        @select-tag-view="emit('select-tag-view', $event)"
        @open-tag-settings="emit('open-tag-settings')"
      />
    </template>

    <!-- ============ EXPANDED MODE ============ -->
    <template v-else>
      <SidebarHeader
        :logo-size="logoSize"
        :dark-mode="darkMode"
        :compact="false"
        @toggle-theme="emit('toggle-theme')"
        @open-settings="emit('open-settings')"
        @reset-layout="emit('reset-layout')"
        @toggle-compact="toggleCompact"
        @open-add-feed="() => {}"
        @open-more-menu="() => {}"
      />
      
      <AddFeedForm
        :adding-feed="addingFeed"
        :target-group-name="addFeedTargetGroupName"
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

      <CollectionsSection
        :expanded="collectionsExpanded"
        :active-collection-id="activeCollectionId"
        @toggle="emit('toggle-collections')"
        @select-collection="emit('select-collection', $event)"
      />

      <TagsSection
        :expanded="tagsExpanded"
        :active-tag-id="activeTagId"
        :active-tag-view="activeTagView"
        @toggle="emit('toggle-tags')"
        @select-tag="emit('select-tag', $event)"
        @select-tag-view="emit('select-tag-view', $event)"
        @open-tag-settings="emit('open-tag-settings')"
      />
    </template>

    <!-- Shared: View Type Navigation + Feed Groups (both modes) -->
    <ViewTypeNav
      v-show="showFeedsArea && !showFavoritesOnly"
      @select="emit('select-view-type', $event)"
    />

    <div class="flex-1" v-show="showFeedsArea && !showFavoritesOnly">
      <!-- Group controls -->
      <div class="flex gap-1.5 mb-2 px-1">
        <button 
          @click="createNewGroup"
          class="border border-[rgba(15,17,21,0.1)] dark:border-[rgba(255,255,255,0.1)] bg-transparent c-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:c-[var(--text-primary)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]" 
          :title="t('groups.createGroup')"
        >
          {{ t('groups.createGroup') }}
        </button>
        <template v-if="feedStore.sortedGroupNames.length > 1">
          <button @click="emit('expand-all')" class="border border-[rgba(15,17,21,0.1)] dark:border-[rgba(255,255,255,0.1)] bg-transparent c-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:c-[var(--text-primary)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]" :title="t('feeds.groupControlTitle')">
            {{ t('common.expandAll') }}
          </button>
          <button @click="emit('collapse-all')" class="border border-[rgba(15,17,21,0.1)] dark:border-[rgba(255,255,255,0.1)] bg-transparent c-[var(--text-secondary)] px-2 py-1 rounded-md text-[11px] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,122,24,0.08)] hover:c-[var(--text-primary)] hover:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)] dark:hover:border-[rgba(255,122,24,0.3)]" :title="t('feeds.groupControlCollapseTitle')">
            {{ t('common.collapseAll') }}
          </button>
        </template>
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
        :available-groups="feedStore.sortedGroupNames"
        @group-click="emit('group-click', $event)"
        @toggle-collapse="emit('toggle-collapse', $event)"
        @group-row-click="emit('group-row-click', $event)"
        @select-feed="emit('select-feed', $event)"
        @start-edit="emit('start-edit', $event, groupName)"
        @save-edit="emit('save-edit', $event, editingGroupName)"
        @cancel-edit="emit('cancel-edit')"
        @delete-feed="emit('delete-feed', $event)"
        @update:editing-group-name="emit('update:editingGroupName', $event)"
        @mark-group-read="emit('mark-group-read', $event)"
        @mark-feed-read="emit('mark-feed-read', $event)"
        @change-view-type="(feedId, viewType) => emit('change-view-type', feedId, viewType)"
        @move-to-group="(feedId, groupName) => emit('move-to-group', feedId, groupName)"
        @set-custom-title="(feedId, customTitle) => emit('set-custom-title', feedId, customTitle)"
        @delete-group="handleDeleteGroup"
      />
    </div>
  </aside>

  <Teleport to="body">
    <div v-if="showCreateGroupModal" class="fixed inset-0 z-[10000] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="closeCreateGroupModal"></div>

      <!-- Modal -->
      <div class="relative bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-[360px] max-h-[80vh] overflow-hidden border border-[var(--border-color)]">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 class="font-semibold text-[15px]">{{ t('groups.createGroup') }}</h3>
          <button @click="closeCreateGroupModal" class="p-1 hover:bg-[rgba(0,0,0,0.05)] rounded-md">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <input
            ref="groupNameInput"
            v-model="newGroupName"
            :placeholder="t('groups.createGroupPrompt')"
            class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-transparent text-[13px] focus:border-[var(--accent)] outline-none"
            @keyup.enter="submitCreateGroup"
            @keyup.esc="closeCreateGroupModal"
          />
        </div>

        <!-- Footer -->
        <div class="border-t border-[var(--border-color)] p-3 flex justify-end gap-2">
          <button
            @click="closeCreateGroupModal"
            class="px-3 py-2 rounded-lg text-[13px] c-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)]"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="submitCreateGroup"
            :disabled="!newGroupName.trim()"
            class="px-4 py-2 rounded-lg bg-[var(--accent)] c-white text-[13px] font-medium disabled:opacity-50"
          >
            {{ t('common.add') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <ConfirmModal
    :show="confirmShow"
    :title="confirmOptions.title || ''"
    :message="confirmOptions.message"
    :confirm-text="confirmOptions.confirmText"
    :cancel-text="confirmOptions.cancelText"
    :danger="confirmOptions.danger"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<style scoped>
/* Scrollbar styles */
.sidebar::-webkit-scrollbar { width: 8px; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.sidebar:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .sidebar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .sidebar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
</style>
