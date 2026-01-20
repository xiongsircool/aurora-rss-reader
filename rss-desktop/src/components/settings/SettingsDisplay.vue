<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const showEntrySummary = defineModel<boolean>('showEntrySummary', { required: true })
const enableDateFilter = defineModel<boolean>('enableDateFilter', { required: true })
const defaultDateRange = defineModel<string>('defaultDateRange', { required: true })
const timeField = defineModel<string>('timeField', { required: true })
const markAsReadRange = defineModel<string>('markAsReadRange', { required: true })

const { t } = useI18n()
</script>

<template>
  <section class="mb-6 p-[18px_20px] rounded-xl bg-[#f8faff] border border-[rgba(76,116,255,0.08)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] last:mb-0 dark:bg-[rgba(255,255,255,0.04)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-[0_0_16px_0] text-base font-semibold c-[var(--text-primary)]">{{ t('settings.displaySettings') }}</h3>
    
    <!-- Show Entry Summary -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)] flex items-center gap-2 cursor-pointer">
        <input v-model="showEntrySummary" type="checkbox" class="mr-2 accent-[var(--settings-accent)]" />
        {{ t('settings.showEntrySummary') }}
      </label>
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.showEntrySummaryDescription') }}</p>
    </div>

    <!-- Enable Date Filter -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)] flex items-center gap-2 cursor-pointer">
        <input v-model="enableDateFilter" type="checkbox" class="mr-2 accent-[var(--settings-accent)]" />
        {{ t('settings.enableTimeFilter') }}
      </label>
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.timeFilterDescription') }}</p>
    </div>

    <!-- Default Time Range -->
    <div class="mb-4" v-if="enableDateFilter">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)]">{{ t('settings.defaultTimeRange') }}</label>
      <select v-model="defaultDateRange" class="w-full p-[11px_14px] border border-[rgba(92,106,138,0.22)] rounded-lg text-sm bg-[#fefefe] c-[var(--text-primary)] transition-all shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)] dark:bg-[var(--bg-surface)] dark:border-[rgba(255,255,255,0.12)] dark:shadow-none">
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
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.timeRangeDescription') }}</p>
    </div>

    <!-- Time Base -->
    <div class="mb-4" v-if="enableDateFilter">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)]">{{ t('settings.timeBase') }}</label>
      <div class="flex gap-4 mt-2">
        <label class="flex items-center gap-1.5 cursor-pointer text-sm c-[var(--text-primary)]">
          <input v-model="timeField" type="radio" value="inserted_at" class="mr-2 accent-[var(--settings-accent)]" />
          {{ t('settings.entryTime') }}
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer text-sm c-[var(--text-primary)]">
          <input v-model="timeField" type="radio" value="published_at" class="mr-2 accent-[var(--settings-accent)]" />
          {{ t('settings.publishTime') }}
        </label>
      </div>
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.timeBaseDescription') }}</p>
    </div>
  </section>

  <!-- Mark as Read Settings -->
  <section class="mb-6 p-[18px_20px] rounded-xl bg-[#f8faff] border border-[rgba(76,116,255,0.08)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] last:mb-0 dark:bg-[rgba(255,255,255,0.04)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-[0_0_16px_0] text-base font-semibold c-[var(--text-primary)]">{{ t('settings.markAsReadSettings') }}</h3>
    
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)]">{{ t('settings.markAsReadRange') }}</label>
      <select v-model="markAsReadRange" class="w-full p-[11px_14px] border border-[rgba(92,106,138,0.22)] rounded-lg text-sm bg-[#fefefe] c-[var(--text-primary)] transition-all shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)] dark:bg-[var(--bg-surface)] dark:border-[rgba(255,255,255,0.12)] dark:shadow-none">
        <option value="current">{{ t('settings.markAsReadRangeCurrent') }}</option>
        <option value="3d">{{ t('settings.markAsReadRange3d') }}</option>
        <option value="7d">{{ t('settings.markAsReadRange7d') }}</option>
        <option value="30d">{{ t('settings.markAsReadRange30d') }}</option>
        <option value="all">{{ t('settings.markAsReadRangeAll') }}</option>
      </select>
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.markAsReadRangeDescription') }}</p>
    </div>
  </section>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
