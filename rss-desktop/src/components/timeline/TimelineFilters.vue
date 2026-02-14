<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  searchQuery: string
  filterMode: 'all' | 'unread' | 'starred'
  dateRangeFilter: string
  filterLoading: boolean
  enableDateFilter: boolean
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

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && props.aiSearchActive && props.searchQuery.trim()) {
    emit('ai-search', props.searchQuery.trim())
  }
}
</script>

<template>
  <div class="px-4 py-2.5 border-b border-[var(--border-color)] flex flex-col gap-2.5 flex-none">
    <div class="flex items-center gap-2.5 flex-wrap w-full justify-between">
      <div class="flex-[2_1_240px] min-w-200px relative">
        <input
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @keydown="handleSearchKeydown"
          type="search"
          :placeholder="aiSearchActive ? t('search.placeholder') : t('articles.searchPlaceholder')"
          class="w-full px-3.5 py-2.5 border rounded-lg text-sm bg-[var(--bg-surface)] c-[var(--text-primary)] transition-colors duration-200 transition-shadow duration-200 focus:outline-none focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)]"
          :class="aiSearchActive
            ? 'border-[#8b5cf6] focus:border-[#8b5cf6] focus:shadow-[0_0_0_2px_rgba(139,92,246,0.18)] pr-20'
            : 'border-[var(--border-color)] focus:border-[var(--accent)]'"
        />
        <!-- AI Search Toggle -->
        <button
          v-if="aiSearchEnabled"
          @click="emit('toggle-ai-search')"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all"
          :class="aiSearchActive
            ? 'bg-[#8b5cf6] c-white shadow-sm'
            : 'bg-[var(--bg-base)] c-[var(--text-tertiary)] hover:c-[var(--text-primary)] border border-[var(--border-color)]'"
          :title="aiSearchActive ? t('search.title') : t('search.title')"
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
      <div class="flex gap-2 flex-[1_1_220px] justify-end mb-0">
        <button
          v-for="mode in ['all', 'unread', 'starred'] as const"
          :key="mode"
          :class="['flex-1 px-3 py-2 border rounded-lg cursor-pointer text-[13px] transition-all duration-200', 
            filterMode === mode 
              ? 'bg-[linear-gradient(120deg,#ff7a18,#ffbe30)] c-white border-transparent shadow-[0_8px_18px_rgba(255,122,24,0.25)]' 
              : 'border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.08)] hover:border-[var(--accent)] hover:c-[var(--accent)]'
          ]"
          @click="emit('update:filterMode', mode)"
        >
          {{ mode === 'all' ? t('navigation.all') : mode === 'unread' ? t('navigation.unread') : t('navigation.favorites') }}
        </button>
      </div>
    </div>
    
    <div class="flex items-center gap-2.5 flex-wrap w-full justify-between">
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(135deg,rgba(255,122,24,0.06),rgba(0,122,255,0.06))] shadow-[0_4px_12px_rgba(15,17,21,0.08)] min-w-160px" v-if="enableDateFilter">
        <label class="text-xs c-[var(--text-secondary)] font-semibold whitespace-nowrap">{{ t('common.timeRange') }}</label>
        <select
          :value="dateRangeFilter"
          @change="emit('update:dateRangeFilter', ($event.target as HTMLSelectElement).value)"
          class="px-2 py-1.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-surface)] c-[var(--text-primary)] text-[13px] cursor-pointer transition-all duration-200 min-w-120px hover:border-[var(--accent)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)] disabled:op-60 disabled:cursor-not-allowed disabled:bg-[var(--bg-secondary)]"
          :disabled="filterLoading"
        >
          <option value="1d">{{ t('time.last1Day') }}</option>
          <option value="2d">{{ t('time.last2Days') }}</option>
          <option value="3d">{{ t('time.last3Days') }}</option>
          <option value="7d">{{ t('time.last1Week') }}</option>
          <option value="30d">{{ t('time.last1Month') }}</option>
          <option value="90d">{{ t('time.last3Months') }}</option>
          <option value="180d">{{ t('time.last6Months') }}</option>
          <option value="365d">{{ t('time.last1Year') }}</option>
          <option value="all">{{ t('time.allTime') }}</option>
        </select>
      </div>
      <div v-if="enableDateFilter" class="flex items-center gap-1.5">
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
