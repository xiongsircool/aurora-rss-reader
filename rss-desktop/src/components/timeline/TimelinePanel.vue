<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Entry, ViewType } from '../../types'
import type { ViewMode } from '../../composables/useViewMode'
import { getTimeRangeText } from '../../utils/date'
import TimelineHeader from './TimelineHeader.vue'
import TimelineFilters from './TimelineFilters.vue'
import EntryCard from './EntryCard.vue'
import PictureCard from './PictureCard.vue'
import VideoCard from './VideoCard.vue'
import AudioCard from './AudioCard.vue'
import LoadingSpinner from '../LoadingSpinner.vue'
import TagComboFilter from '../tags/TagComboFilter.vue'

const props = defineProps<{
  // Header props
  title: string
  subtitle: string
  showFavoritesOnly: boolean
  viewMode: ViewMode
  activeTagId: string | null
  activeTagName?: string
  activeTagView: 'tag' | 'pending' | 'untagged' | 'digest' | null
  tagStats?: {
    pending: number
    analyzed: number
    withoutTags: number
  }
  comboFilterActive?: boolean
  comboFilterTagIds?: string[]
  comboFilterMode?: 'and' | 'or'
  availableTags?: Array<{ id: string; name: string; color: string }>

  // View type
  viewType?: ViewType
  
  // Filter props
  searchQuery: string
  filterMode: 'all' | 'unread' | 'starred'
  dateRangeFilter: string
  filterLoading: boolean
  enableDateFilter: boolean
  
  // List props
  entries: Entry[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  showSummary: boolean
  
  // Translation props
  autoTitleTranslation: boolean
  titleDisplayMode: string
  translationLanguageLabel: string
  
  // Selection
  selectedEntryId: string | null

  // Function Props for Translation Helpers
  getTranslatedTitle: (entryId: string) => string | null
  isTranslationLoading: (entryId: string) => boolean
  isTranslationFailed: (entryId: string) => boolean

  // AI Search
  aiSearchEnabled?: boolean
  aiSearchActive?: boolean
  aiSearchLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'back-to-feeds'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterMode', value: 'all' | 'unread' | 'starred'): void
  (e: 'update:dateRangeFilter', value: string): void
  (e: 'select-entry', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
  (e: 'toggle-read', entry: Entry): void
  (e: 'add-to-bookmark-group', entry: Entry): void
  (e: 'copy-link', entry: Entry): void
  (e: 'open-external', entry: Entry): void
  (e: 'mark-all-read'): void
  (e: 'entries-visible', entries: Entry[]): void
  (e: 'load-more'): void
  (e: 'toggle-ai-search'): void
  (e: 'ai-search', query: string): void
  (e: 'apply-tag-combo', tagIds: string[], mode: 'and' | 'or'): void
  (e: 'clear-tag-combo'): void
}>()

const { t } = useI18n()
const loadMoreThreshold = 8
let lastLoadMoreLength = 0

// View type helpers
const isPictureView = computed(() => props.viewType === 'pictures')
const isVideoView = computed(() => props.viewType === 'videos')
const isAudioView = computed(() => props.viewType === 'audio')
const isGridView = computed(() => isPictureView.value || isVideoView.value)
const isFavoritesLibraryView = computed(() =>
  props.showFavoritesOnly && !isGridView.value && !isAudioView.value
)

const favoriteGroupedEntries = computed(() => {
  const grouped = new Map<string, Entry[]>()
  for (const entry of props.entries) {
    const key = entry.feed_title || entry.feed_id || t('navigation.allFeeds')
    const bucket = grouped.get(key)
    if (bucket) bucket.push(entry)
    else grouped.set(key, [entry])
  }
  return Array.from(grouped.entries()).map(([feedTitle, items]) => ({ feedTitle, items }))
})

const showTagInsights = computed(() => props.viewMode === 'tag' && props.activeTagView !== 'digest')
const selectedComboTags = computed(() => {
  const idSet = new Set(props.comboFilterTagIds ?? [])
  return (props.availableTags ?? []).filter(tag => idSet.has(tag.id))
})
const hasSearchFilter = computed(() => props.searchQuery.trim().length > 0)
const hasStateFilter = computed(() => props.filterMode !== 'all')
const hasDateFilter = computed(() => props.enableDateFilter && props.dateRangeFilter !== 'all')
const hasAnyFilters = computed(() =>
  hasSearchFilter.value || hasStateFilter.value || hasDateFilter.value || !!props.comboFilterActive
)
const filterModeLabel = computed(() => {
  if (props.filterMode === 'unread') return t('navigation.unread')
  if (props.filterMode === 'starred') return t('navigation.favorites')
  return t('navigation.all')
})
const dateRangeLabel = computed(() => getTimeRangeText(props.dateRangeFilter))
const modeLabel = computed(() => {
  if (props.viewMode === 'favorites' || props.showFavoritesOnly) return t('groups.myFavorites')
  if (props.viewMode === 'collection') return t('collections.title')
  if (props.viewMode === 'tag') {
    if (props.activeTagView === 'digest') return t('tags.digest')
    if (props.activeTagView === 'pending') return t('tags.pending')
    if (props.activeTagView === 'untagged') return t('tags.untagged')
    return t('tags.title')
  }
  return t('navigation.allFeeds')
})

const modeAccentClass = computed(() => {
  if (props.viewMode === 'favorites' || props.showFavoritesOnly) {
    return 'border-[rgba(245,158,11,0.35)] bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.08))]'
  }
  if (props.viewMode === 'collection') {
    return 'border-[rgba(59,130,246,0.35)] bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(56,189,248,0.08))]'
  }
  if (props.viewMode === 'tag') {
    return 'border-[rgba(139,92,246,0.35)] bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(14,165,233,0.08))]'
  }
  return 'border-[rgba(255,122,24,0.28)] bg-[linear-gradient(135deg,rgba(255,122,24,0.1),rgba(255,190,48,0.08))]'
})

const emptyMessage = computed(() => {
  if (props.searchQuery.trim()) return t('feeds.noArticlesSearch')
  if (props.viewMode === 'favorites' || props.showFavoritesOnly) return t('articles.noFavoriteArticles')
  if (props.viewMode === 'collection') return t('collections.noCollections')
  if (props.viewMode === 'tag' && props.activeTagView === 'digest') return t('tags.digestEmpty')
  return t('feeds.noArticlesAdd')
})

// Responsive grid columns
const containerRef = ref<HTMLElement | null>(null)
const gridColumns = ref(3)

function updateGridColumns() {
  if (!containerRef.value) return
  const width = containerRef.value.clientWidth
  if (width < 400) {
    gridColumns.value = 2
  } else if (width < 600) {
    gridColumns.value = 3
  } else if (width < 900) {
    gridColumns.value = 4
  } else {
    gridColumns.value = 5
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateGridColumns)
    resizeObserver.observe(containerRef.value)
    updateGridColumns()
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

// Grid scroll handler for load more
function handleGridScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return

  const { scrollTop, scrollHeight, clientHeight } = target
  const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

  // Trigger load more when scrolled to 80%
  if (scrollPercentage > 0.8 && !props.loading && !props.loadingMore && props.hasMore) {
    if (props.entries.length !== lastLoadMoreLength) {
      lastLoadMoreLength = props.entries.length
      emit('load-more')
    }
  }

  // Emit visible entries for auto title translation
  const itemHeight = 200 // approximate height of picture card
  const startIndex = Math.floor(scrollTop / itemHeight) * gridColumns.value
  const visibleCount = Math.ceil(clientHeight / itemHeight) * gridColumns.value
  const endIndex = Math.min(startIndex + visibleCount, props.entries.length - 1)

  if (endIndex >= startIndex) {
    emit('entries-visible', props.entries.slice(startIndex, endIndex + 1))
  }
}

function handleVisibleUpdate(
  startIndex: number,
  endIndex: number,
  visibleStartIndex?: number,
  visibleEndIndex?: number
) {
  const start = Number.isFinite(visibleStartIndex) ? (visibleStartIndex as number) : startIndex
  const end = Number.isFinite(visibleEndIndex) ? (visibleEndIndex as number) : endIndex
  const safeStart = Math.max(0, start)
  const safeEnd = Math.min(props.entries.length - 1, end)
  if (safeEnd < safeStart) return
  emit('entries-visible', props.entries.slice(safeStart, safeEnd + 1))

  if (props.entries.length < lastLoadMoreLength) {
    lastLoadMoreLength = 0
  }

  if (!props.loading && !props.loadingMore && props.hasMore) {
    const triggerIndex = Math.max(0, props.entries.length - 1 - loadMoreThreshold)
    if (safeEnd >= triggerIndex && props.entries.length !== lastLoadMoreLength) {
      lastLoadMoreLength = props.entries.length
      emit('load-more')
    }
  }
}
</script>

<template>
  <main class="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-base)] flex-1 min-w-260px w-auto box-border max-h-screen min-h-0 overflow-hidden lt-md:w-full! lt-md:border-r-0 lt-md:border-b lt-md:min-w-auto lt-md:h-auto lt-md:max-h-none lt-md:overflow-visible">
    <TimelineHeader
      :title="title"
      :subtitle="subtitle"
      :show-favorites-only="showFavoritesOnly"
      :can-mark-all-read="!showFavoritesOnly && viewMode !== 'tag' && viewMode !== 'collection'"
      @refresh="emit('refresh')"
      @back-to-feeds="emit('back-to-feeds')"
      @mark-all-read="emit('mark-all-read')"
    />

    <div class="mx-4 mt-3 mb-2 px-3 py-2 rounded-xl border flex items-center justify-between gap-3" :class="modeAccentClass">
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0"></span>
        <span class="text-[12px] font-semibold c-[var(--text-primary)] truncate">{{ modeLabel }}</span>
      </div>
      <div class="text-[11px] c-[var(--text-secondary)] whitespace-nowrap">
        {{ entries.length }} {{ t('articles.title') }}
      </div>
    </div>

    <div
      v-if="showTagInsights"
      class="mx-4 mb-2 px-3 py-2 rounded-xl border border-[rgba(139,92,246,0.22)] bg-[linear-gradient(135deg,rgba(139,92,246,0.1),rgba(14,165,233,0.08))] flex items-center gap-2 flex-wrap"
    >
      <span class="text-[11px] font-semibold c-[var(--text-secondary)]">Tag Workspace</span>
      <span
        v-if="activeTagId && activeTagName"
        class="inline-flex items-center px-2 py-1 rounded-full text-[11px] bg-[rgba(139,92,246,0.18)] c-[#7c3aed] border border-[rgba(139,92,246,0.3)]"
      >
        # {{ activeTagName }}
      </span>
      <span
        v-if="activeTagView === 'pending'"
        class="inline-flex items-center px-2 py-1 rounded-full text-[11px] bg-[rgba(59,130,246,0.15)] c-[#2563eb]"
      >
        {{ t('tags.pending') }}
      </span>
      <span
        v-if="activeTagView === 'untagged'"
        class="inline-flex items-center px-2 py-1 rounded-full text-[11px] bg-[rgba(14,165,233,0.15)] c-[#0891b2]"
      >
        {{ t('tags.untagged') }}
      </span>
      <span v-if="tagStats" class="text-[11px] c-[var(--text-secondary)]">
        {{ t('tags.pending') }}: {{ tagStats.pending }} · {{ t('tags.untagged') }}: {{ tagStats.withoutTags }}
      </span>
    </div>

    <div
      v-if="viewMode === 'tag' && activeTagView === 'tag'"
      class="mx-4 mb-2 p-2 rounded-xl border border-[rgba(139,92,246,0.22)] bg-[var(--bg-surface)]"
    >
      <TagComboFilter
        @apply="(ids, mode) => emit('apply-tag-combo', ids, mode)"
        @clear="emit('clear-tag-combo')"
      />
      <div
        v-if="comboFilterActive && selectedComboTags.length"
        class="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center gap-2 flex-wrap"
      >
        <span class="text-[11px] c-[var(--text-secondary)]">
          {{ comboFilterMode === 'and' ? t('tags.filterModeAnd') : t('tags.filterModeOr') }}
        </span>
        <span
          v-for="tag in selectedComboTags"
          :key="tag.id"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border"
          :style="{ borderColor: tag.color + '55', backgroundColor: tag.color + '14', color: tag.color }"
        >
          <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: tag.color }"></span>
          {{ tag.name }}
        </span>
        <button
          class="ml-auto px-2 py-1 text-[11px] rounded-md border border-[var(--border-color)] c-[var(--text-secondary)] hover:c-[#ff3b30] hover:border-[rgba(255,59,48,0.35)] transition-all"
          @click="emit('clear-tag-combo')"
        >
          {{ t('tags.clearFilter') }}
        </button>
      </div>
    </div>
    
    <TimelineFilters
      :search-query="searchQuery"
      :filter-mode="filterMode"
      :date-range-filter="dateRangeFilter"
      :filter-loading="filterLoading"
      :enable-date-filter="enableDateFilter"
      :ai-search-enabled="aiSearchEnabled"
      :ai-search-active="aiSearchActive"
      :ai-search-loading="aiSearchLoading"
      @update:search-query="emit('update:searchQuery', $event)"
      @update:filter-mode="emit('update:filterMode', $event)"
      @update:date-range-filter="emit('update:dateRangeFilter', $event)"
      @toggle-ai-search="emit('toggle-ai-search')"
      @ai-search="emit('ai-search', $event)"
    />

    <div
      v-if="hasAnyFilters"
      class="mx-4 mb-2 mt-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center gap-2 flex-wrap"
    >
      <span class="text-[11px] c-[var(--text-secondary)]">{{ t('articles.filteringData') }}</span>

      <button
        v-if="hasSearchFilter"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[rgba(14,165,233,0.14)] c-[#0284c7] border border-[rgba(14,165,233,0.3)]"
        @click="emit('update:searchQuery', '')"
      >
        {{ searchQuery }}
        <span class="op-70">×</span>
      </button>

      <button
        v-if="hasStateFilter"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[rgba(249,115,22,0.14)] c-[#ea580c] border border-[rgba(249,115,22,0.3)]"
        @click="emit('update:filterMode', 'all')"
      >
        {{ filterModeLabel }}
        <span class="op-70">×</span>
      </button>

      <button
        v-if="hasDateFilter"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[rgba(16,185,129,0.14)] c-[#059669] border border-[rgba(16,185,129,0.3)]"
        @click="emit('update:dateRangeFilter', 'all')"
      >
        {{ dateRangeLabel }}
        <span class="op-70">×</span>
      </button>

      <button
        class="ml-auto px-2 py-1 rounded-md text-[11px] border border-[var(--border-color)] c-[var(--text-secondary)] hover:c-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
        @click="
          emit('update:searchQuery', '');
          emit('update:filterMode', 'all');
          emit('update:dateRangeFilter', 'all');
          emit('clear-tag-combo');
        "
      >
        {{ t('tags.clearFilter') }}
      </button>
    </div>
    
    <section
      ref="containerRef"
      class="timeline__list relative flex-1 p-[clamp(12px,1.5vw,16px)] overflow-y-auto overflow-x-hidden min-h-0"
      :class="{ 'flex flex-col gap-[clamp(10px,1vw,14px)]': !isGridView }"
      @scroll="isGridView ? handleGridScroll($event) : undefined"
    >
      <div
        v-if="loading"
        class="absolute inset-0 z-10 grid place-items-center bg-[rgba(255,255,255,0.65)] dark:bg-[rgba(15,17,21,0.65)] pointer-events-none"
      >
        <LoadingSpinner message="加载中..." />
      </div>

      <!-- Picture Grid View -->
      <div
        v-if="isPictureView && entries.length"
        class="picture-grid"
        :style="{ '--grid-columns': gridColumns }"
      >
        <PictureCard
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :active="selectedEntryId === entry.id"
          @select="emit('select-entry', $event)"
          @toggle-star="emit('toggle-star', $event)"
        />
      </div>

      <!-- Video Grid View -->
      <div
        v-else-if="isVideoView && entries.length"
        class="video-grid"
        :style="{ '--grid-columns': Math.max(2, gridColumns - 1) }"
      >
        <VideoCard
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :active="selectedEntryId === entry.id"
          @select="emit('select-entry', $event)"
          @toggle-star="emit('toggle-star', $event)"
        />
      </div>

      <!-- Audio List View -->
      <div
        v-else-if="isAudioView && entries.length"
        class="audio-list flex flex-col gap-2"
      >
        <AudioCard
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :active="selectedEntryId === entry.id"
          @select="emit('select-entry', $event)"
          @toggle-star="emit('toggle-star', $event)"
        />
      </div>

      <!-- Default List View -->
      <template
        v-if="isFavoritesLibraryView && entries.length"
      >
        <div
          v-for="section in favoriteGroupedEntries"
          :key="section.feedTitle"
          class="mb-3"
        >
          <div class="sticky top-0 z-2 py-1.5 px-2 rounded-lg bg-[rgba(255,255,255,0.8)] dark:bg-[rgba(15,17,21,0.8)] backdrop-blur border border-[var(--border-color)] text-[12px] font-semibold c-[var(--text-secondary)]">
            {{ section.feedTitle }} · {{ section.items.length }}
          </div>
          <div class="mt-2">
            <div
              v-for="item in section.items"
              :key="item.id"
              class="pb-5"
            >
              <EntryCard
                :entry="item"
                :active="selectedEntryId === item.id"
                :show-translation="autoTitleTranslation"
                :translated-title="getTranslatedTitle(item.id)"
                :is-translation-loading="isTranslationLoading(item.id)"
                :is-translation-failed="isTranslationFailed(item.id)"
                :title-display-mode="titleDisplayMode"
                :translation-language-label="translationLanguageLabel"
                :show-summary="showSummary"
                @select="emit('select-entry', $event)"
                @toggle-star="emit('toggle-star', $event)"
                @toggle-read="emit('toggle-read', $event)"
                @add-to-collection="emit('add-to-bookmark-group', $event)"
                @copy-link="emit('copy-link', $event)"
                @open-external="emit('open-external', $event)"
              />
            </div>
          </div>
        </div>
      </template>

      <DynamicScroller
        v-else-if="!isGridView && !isAudioView && entries.length"
        class="h-full"
        :items="entries"
        :min-item-size="100"
        :emit-update="true"
        key-field="id"
        @update="handleVisibleUpdate"
      >
        <template v-slot="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :size-dependencies="[
              item.summary,
              item.title,
              getTranslatedTitle(item.id),
              isTranslationLoading(item.id),
              isTranslationFailed(item.id),
              showSummary
            ]"
            :data-index="index"
            class="pb-5"
          >
            <EntryCard
              :entry="item"
              :active="selectedEntryId === item.id"
              :show-translation="autoTitleTranslation"
              :translated-title="getTranslatedTitle(item.id)"
              :is-translation-loading="isTranslationLoading(item.id)"
              :is-translation-failed="isTranslationFailed(item.id)"
              :title-display-mode="titleDisplayMode"
              :translation-language-label="translationLanguageLabel"
              :show-summary="showSummary"
              @select="emit('select-entry', $event)"
              @toggle-star="emit('toggle-star', $event)"
              @toggle-read="emit('toggle-read', $event)"
              @add-to-collection="emit('add-to-bookmark-group', $event)"
              @copy-link="emit('copy-link', $event)"
              @open-external="emit('open-external', $event)"
            />
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

      <div class="grid place-items-center c-[var(--text-secondary)] text-center p-6" v-if="!entries.length && !loading">
        {{ emptyMessage }}
      </div>

      <div
        v-if="loadingMore"
        class="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden pointer-events-none"
      >
        <div class="loading-bar h-full w-full"></div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* Migrated to UnoCSS - Scrollbar styles remain */
.timeline__list::-webkit-scrollbar { width: 8px; height: 8px; }
.timeline__list::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.timeline__list:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .timeline__list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .timeline__list:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }

/* Picture Grid Layout */
.picture-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
  gap: clamp(10px, 1.2vw, 16px);
  padding-bottom: 20px;
}

/* Video Grid Layout */
.video-grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns, 2), 1fr);
  gap: clamp(12px, 1.5vw, 20px);
  padding-bottom: 20px;
}

.loading-bar {
  background: linear-gradient(90deg, transparent 0%, var(--accent) 35%, #34c759 65%, transparent 100%);
  background-size: 200% 100%;
  animation: loadingBar 1.1s ease-in-out infinite;
  opacity: 0.7;
}

@keyframes loadingBar {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
