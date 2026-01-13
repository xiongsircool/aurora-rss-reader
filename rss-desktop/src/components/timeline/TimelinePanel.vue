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
  <main class="timeline">
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
    
    <section class="timeline__list">
      <LoadingSpinner v-if="loading" message="加载中..." />
      
      <template v-else>
        <EntryCard
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :active="selectedEntryId === entry.id"
          :show-translation="autoTitleTranslation"
          :translated-title="getTranslatedTitle(entry.id)"
          :is-translation-loading="isTranslationLoading(entry.id)"
          :title-display-mode="titleDisplayMode"
          :translation-language-label="translationLanguageLabel"
          :show-summary="showSummary"
          @select="emit('select-entry', $event)"
          @toggle-star="emit('toggle-star', $event)"
        />

        <div class="empty" v-if="!entries.length">
          {{ searchQuery ? t('feeds.noArticlesSearch') : t('feeds.noArticlesAdd') }}
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  background: var(--bg-base);
  flex: 1 1 auto;
  min-width: 260px;
  width: auto;
  box-sizing: border-box;
  max-height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.timeline__list {
  flex: 1 1 auto;
  padding: clamp(12px, 1.5vw, 16px);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1vw, 14px);
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.empty {
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
}

.timeline__list::-webkit-scrollbar { width: 8px; height: 8px; }
.timeline__list::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.timeline__list:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .timeline__list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .timeline__list:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }

@media (max-width: 960px) {
  .timeline {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    min-width: auto;
    height: auto;
    max-height: none;
    overflow: visible;
  }
}
</style>
