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
  <div class="timeline__controls">
    <div class="timeline__controls-row timeline__controls-main">
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="search"
        :placeholder="t('articles.searchPlaceholder')"
        class="search-input"
      />
      <div class="filter-buttons">
        <button
          :class="['filter-btn', { active: filterMode === 'all' }]"
          @click="emit('update:filterMode', 'all')"
        >
          {{ t('navigation.all') }}
        </button>
        <button
          :class="['filter-btn', { active: filterMode === 'unread' }]"
          @click="emit('update:filterMode', 'unread')"
        >
          {{ t('navigation.unread') }}
        </button>
        <button
          :class="['filter-btn', { active: filterMode === 'starred' }]"
          @click="emit('update:filterMode', 'starred')"
        >
          {{ t('navigation.favorites') }}
        </button>
      </div>
    </div>
    
    <div class="timeline__controls-row timeline__controls-meta">
      <div class="date-filter" v-if="enableDateFilter">
        <label>{{ t('common.timeRange') }}</label>
        <select
          :value="dateRangeFilter"
          @change="emit('update:dateRangeFilter', ($event.target as HTMLSelectElement).value)"
          class="date-select"
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
.timeline__controls {
  padding: 10px 16px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 auto;
}

.timeline__controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.timeline__controls-main {
  justify-content: space-between;
}

.timeline__controls-meta {
  justify-content: space-between;
}

.search-input {
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
  flex: 2 1 240px;
  min-width: 200px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.filter-buttons {
  display: flex;
  gap: 8px;
  flex: 1 1 220px;
  justify-content: flex-end;
  margin-bottom: 0;
}

.filter-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-surface);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  color: var(--text-primary);
}

.filter-btn:hover {
  background: rgba(255, 122, 24, 0.08);
  border-color: var(--accent);
  color: var(--accent);
}

.filter-btn.active {
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 8px 18px rgba(255, 122, 24, 0.25);
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 122, 24, 0.06), rgba(0, 122, 255, 0.06));
  box-shadow: 0 4px 12px rgba(15, 17, 21, 0.08);
  min-width: 160px;
}

.date-filter label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.date-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.date-select:hover {
  border-color: var(--accent);
}

.date-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(255, 122, 24, 0.18);
}

.date-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-secondary);
}
</style>
