<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'
import TimelineHeader from './TimelineHeader.vue'
import TimelineFilters from './TimelineFilters.vue'
import EntryCard from './EntryCard.vue'
import LoadingSpinner from '../LoadingSpinner.vue'

const props = defineProps<{
  // Header props
  title: string
  subtitle: string
  showFavoritesOnly: boolean
  
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
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'back-to-feeds'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterMode', value: 'all' | 'unread' | 'starred'): void
  (e: 'update:dateRangeFilter', value: string): void
  (e: 'select-entry', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
  (e: 'mark-all-read'): void
  (e: 'entries-visible', entries: Entry[]): void
  (e: 'load-more'): void
}>()

const { t } = useI18n()
const loadMoreThreshold = 8
let lastLoadMoreLength = 0

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
      @refresh="emit('refresh')"
      @back-to-feeds="emit('back-to-feeds')"
      @mark-all-read="emit('mark-all-read')"
    />
    
    <TimelineFilters
      :search-query="searchQuery"
      :filter-mode="filterMode"
      :date-range-filter="dateRangeFilter"
      :filter-loading="filterLoading"
      :enable-date-filter="enableDateFilter"
      @update:search-query="emit('update:searchQuery', $event)"
      @update:filter-mode="emit('update:filterMode', $event)"
      @update:date-range-filter="emit('update:dateRangeFilter', $event)"
    />
    
    <section class="timeline__list relative flex-1 p-[clamp(12px,1.5vw,16px)] flex flex-col gap-[clamp(10px,1vw,14px)] overflow-y-auto overflow-x-hidden min-h-0">
      <div
        v-if="loading"
        class="absolute inset-0 z-10 grid place-items-center bg-[rgba(255,255,255,0.65)] dark:bg-[rgba(15,17,21,0.65)] pointer-events-none"
      >
        <LoadingSpinner message="加载中..." />
      </div>

      <!-- Custom scrollbar style is applied to the scroller -->
      <DynamicScroller
        class="h-full"
        :items="entries"
        :min-item-size="100"
        :emit-update="true"
        key-field="id"
        @update="handleVisibleUpdate"
        v-if="entries.length"
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
            />
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

      <div class="grid place-items-center c-[var(--text-secondary)] text-center p-6" v-if="!entries.length && !loading">
        {{ searchQuery ? t('feeds.noArticlesSearch') : t('feeds.noArticlesAdd') }}
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
