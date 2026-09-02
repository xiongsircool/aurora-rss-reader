<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  searchQuery: string
  filterMode: 'all' | 'unread' | 'starred'
  dateRangeFilter: string
  filterLoading: boolean
  enableDateFilter: boolean
  filterDensity?: 'compact' | 'standard'
  aiSearchEnabled?: boolean
  aiSearchActive?: boolean
  aiSearchLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterMode', value: 'all' | 'unread' | 'starred'): void
  (e: 'update:dateRangeFilter', value: string): void
  (e: 'toggle-ai-search'): void
  (e: 'ai-search', query: string): void
}>()

const { t } = useI18n()
const quickDateRanges = ['7d', '30d', 'all'] as const
const isCompact = computed(() => props.filterDensity === 'compact')
const dateRangeOptions: Array<{ value: string; labelKey: string }> = [
  { value: '1d', labelKey: 'time.last1Day' },
  { value: '2d', labelKey: 'time.last2Days' },
  { value: '3d', labelKey: 'time.last3Days' },
  { value: '7d', labelKey: 'time.last1Week' },
  { value: '30d', labelKey: 'time.last1Month' },
  { value: '90d', labelKey: 'time.last3Months' },
  { value: '180d', labelKey: 'time.last6Months' },
  { value: '365d', labelKey: 'time.last1Year' },
  { value: 'all', labelKey: 'time.allTime' },
]

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && props.aiSearchActive && props.searchQuery.trim()) {
    emit('ai-search', props.searchQuery.trim())
  }
}
</script>

<template>
  <div
    class="px-4 border-b border-[var(--border-color)] flex flex-col flex-none"
    :class="isCompact ? 'py-2 gap-2' : 'py-2.5 gap-2.5'"
  >
    <div
      class="flex items-center flex-wrap w-full"
      :class="isCompact ? 'gap-2 justify-start' : 'gap-2.5 justify-between'"
    >
      <div class="relative" :class="isCompact ? 'flex-[1_1_280px] min-w-210px' : 'flex-[2_1_240px] min-w-200px'">
        <input
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @keydown="handleSearchKeydown"
          type="search"
          :placeholder="aiSearchActive ? t('search.placeholder') : t('articles.searchPlaceholder')"
          class="w-full px-3.5 py-2.5 border rounded-lg text-sm bg-[var(--bg-surface)] c-[var(--text-primary)] transition-colors duration-200 transition-shadow duration-200 focus:outline-none focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)]"
          :class="aiSearchActive
            ? 'border-[#8b5cf6] focus:border-[#8b5cf6] focus:shadow-[0_0_0_2px_rgba(139,92,246,0.18)] pr-20'
            : aiSearchEnabled
              ? 'border-[var(--border-color)] focus:border-[var(--accent)] pr-20'
              : 'border-[var(--border-color)] focus:border-[var(--accent)]'"
        />
        <!-- AI Search Toggle -->
        <button
          @click="emit('toggle-ai-search')"
          :disabled="!aiSearchEnabled"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all"
          :class="[
            aiSearchActive
              ? 'bg-[#8b5cf6] c-white shadow-sm'
              : 'bg-[var(--bg-base)] border border-[var(--border-color)]',
            aiSearchEnabled
              ? 'c-[var(--text-tertiary)] hover:c-[var(--text-primary)] cursor-pointer'
              : 'c-[var(--text-tertiary)] op-55 cursor-not-allowed'
          ]"
          :title="aiSearchEnabled ? t('search.title') : t('settings.embeddingService')"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          AI
        </button>
        <!-- AI search loading indicator -->
        <div v-if="aiSearchLoading" class="absolute right-14 top-1/2 -translate-y-1/2">
          <div class="animate-spin w-4 h-4 border-2 border-[#8b5cf6] border-t-transparent rounded-full"></div>
        </div>
      </div>
      <div
        class="flex items-center mb-0"
        :class="isCompact ? 'gap-1.5 flex-[0_1_auto] flex-wrap' : 'gap-2 flex-[1_1_220px] justify-end'"
      >
        <button
          v-for="mode in ['all', 'unread', 'starred'] as const"
          :key="mode"
          :class="[
            isCompact ? 'px-2.5 py-1.5 text-[12px]' : 'flex-1 px-3 py-2 text-[13px]',
            'border rounded-lg cursor-pointer transition-all duration-200',
            filterMode === mode 
              ? 'bg-[linear-gradient(120deg,#ff7a18,#ffbe30)] c-white border-transparent shadow-[0_8px_18px_rgba(255,122,24,0.25)]' 
              : 'border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.08)] hover:border-[var(--accent)] hover:c-[var(--accent)]'
          ]"
          @click="emit('update:filterMode', mode)"
        >
          {{ mode === 'all' ? t('navigation.all') : mode === 'unread' ? t('navigation.unread') : t('navigation.favorites') }}
        </button>

        <select
          v-if="enableDateFilter && isCompact"
          :value="dateRangeFilter"
          @change="emit('update:dateRangeFilter', ($event.target as HTMLSelectElement).value)"
          class="px-2 py-1.5 border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] c-[var(--text-primary)] text-[12px] cursor-pointer transition-all duration-200 min-w-92px hover:border-[var(--accent)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)] disabled:op-60 disabled:cursor-not-allowed disabled:bg-[var(--bg-secondary)]"
          :disabled="filterLoading"
          :title="t('common.timeRange')"
        >
          <option v-for="option in dateRangeOptions" :key="option.value" :value="option.value">
            {{ t(option.labelKey) }}
          </option>
        </select>
      </div>
    </div>
    
    <div v-if="enableDateFilter && !isCompact" class="flex items-center gap-2.5 flex-wrap w-full justify-between">
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(135deg,rgba(255,122,24,0.06),rgba(0,122,255,0.06))] shadow-[0_4px_12px_rgba(15,17,21,0.08)] min-w-160px" v-if="enableDateFilter">
        <label class="text-xs c-[var(--text-secondary)] font-semibold whitespace-nowrap">{{ t('common.timeRange') }}</label>
        <select
          :value="dateRangeFilter"
          @change="emit('update:dateRangeFilter', ($event.target as HTMLSelectElement).value)"
          class="px-2 py-1.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-surface)] c-[var(--text-primary)] text-[13px] cursor-pointer transition-all duration-200 min-w-120px hover:border-[var(--accent)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)] disabled:op-60 disabled:cursor-not-allowed disabled:bg-[var(--bg-secondary)]"
          :disabled="filterLoading"
        >
          <option v-for="option in dateRangeOptions" :key="option.value" :value="option.value">
            {{ t(option.labelKey) }}
          </option>
        </select>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          v-for="range in quickDateRanges"
          :key="range"
          class="px-2 py-1 rounded-md text-[11px] border transition-all"
          :class="dateRangeFilter === range
            ? 'bg-[rgba(255,122,24,0.16)] border-[rgba(255,122,24,0.35)] c-[var(--accent)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-color)] c-[var(--text-secondary)] hover:c-[var(--text-primary)] hover:border-[var(--accent)]'"
          @click="emit('update:dateRangeFilter', range)"
        >
          {{
            range === '7d'
              ? t('time.last1Week')
              : range === '30d'
                ? t('time.last1Month')
                : t('time.allTime')
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
