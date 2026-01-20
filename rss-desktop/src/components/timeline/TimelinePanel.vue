<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'
import TimelineHeader from './TimelineHeader.vue'
import TimelineFilters from './TimelineFilters.vue'
import EntryCard from './EntryCard.vue'
import LoadingSpinner from '../LoadingSpinner.vue'

defineProps<{
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
}>()

const { t } = useI18n()
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
    
    <section class="timeline__list flex-1 p-[clamp(12px,1.5vw,16px)] flex flex-col gap-[clamp(10px,1vw,14px)] overflow-y-auto overflow-x-hidden min-h-0">
      <LoadingSpinner v-if="loading" message="加载中..." />
      
      <template v-else>
        <!-- Custom scrollbar style is applied to the scroller -->
        <DynamicScroller
          class="h-full"
          :items="entries"
          :min-item-size="100"
          key-field="id"
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
                :title-display-mode="titleDisplayMode"
                :translation-language-label="translationLanguageLabel"
                :show-summary="showSummary"
                @select="emit('select-entry', $event)"
                @toggle-star="emit('toggle-star', $event)"
              />
            </DynamicScrollerItem>
          </template>
        </DynamicScroller>

        <div class="grid place-items-center c-[var(--text-secondary)] text-center p-6" v-if="!entries.length">
          {{ searchQuery ? t('feeds.noArticlesSearch') : t('feeds.noArticlesAdd') }}
        </div>
      </template>
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
</style>
