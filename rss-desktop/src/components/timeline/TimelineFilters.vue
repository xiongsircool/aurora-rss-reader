<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  searchQuery: string
  filterMode: 'all' | 'unread' | 'starred'
  dateRangeFilter: string
  filterLoading: boolean
  enableDateFilter: boolean
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
  (e: 'update:filterMode', value: 'all' | 'unread' | 'starred'): void
  (e: 'update:dateRangeFilter', value: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="px-4 py-2.5 border-b border-[var(--border-color)] flex flex-col gap-2.5 flex-none">
    <div class="flex items-center gap-2.5 flex-wrap w-full justify-between">
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="search"
        :placeholder="t('articles.searchPlaceholder')"
        class="px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-surface)] c-[var(--text-primary)] transition-colors duration-200 transition-shadow duration-200 flex-[2_1_240px] min-w-200px focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(255,122,24,0.18)]"
      />
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
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
