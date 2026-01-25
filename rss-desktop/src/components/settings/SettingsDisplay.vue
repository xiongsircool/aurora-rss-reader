<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const showEntrySummary = defineModel<boolean>('showEntrySummary', { required: true })
const openOriginalMode = defineModel<'system' | 'window'>('openOriginalMode', { required: true })
const enableDateFilter = defineModel<boolean>('enableDateFilter', { required: true })
const defaultDateRange = defineModel<string>('defaultDateRange', { required: true })
const timeField = defineModel<string>('timeField', { required: true })
const markAsReadRange = defineModel<string>('markAsReadRange', { required: true })
const detailsPanelMode = defineModel<'docked' | 'click'>('detailsPanelMode', { required: true })

const { t } = useI18n()
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_16px_0] text-base font-semibold text-[var(--text-primary)] hidden md:block">{{ t('settings.displaySettings') }}</h3>

    <!-- Show Entry Summary -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)] flex items-center gap-2 cursor-pointer">
        <input v-model="showEntrySummary" type="checkbox" class="mr-2 accent-orange-500" />
        {{ t('settings.showEntrySummary') }}
      </label>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.showEntrySummaryDescription') }}</p>
    </div>

    <!-- Open Original Mode -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.openOriginalMode') }}</label>
      <select v-model="openOriginalMode" class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]">
        <option value="system">{{ t('settings.openOriginalModeSystem') }}</option>
        <option value="window">{{ t('settings.openOriginalModeWindow') }}</option>
      </select>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.openOriginalModeDescription') }}</p>
    </div>

    <!-- Details Panel Mode -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.detailsPanelMode') }}</label>
      <select v-model="detailsPanelMode" class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]">
        <option value="docked">{{ t('settings.detailsPanelModeDocked') }}</option>
        <option value="click">{{ t('settings.detailsPanelModeClick') }}</option>
      </select>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.detailsPanelModeDescription') }}</p>
    </div>

    <!-- Enable Date Filter -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)] flex items-center gap-2 cursor-pointer">
        <input v-model="enableDateFilter" type="checkbox" class="mr-2 accent-orange-500" />
        {{ t('settings.enableTimeFilter') }}
      </label>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.timeFilterDescription') }}</p>
    </div>

    <!-- Default Time Range -->
    <div class="mb-4" v-if="enableDateFilter">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.defaultTimeRange') }}</label>
      <select v-model="defaultDateRange" class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]">
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
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.timeRangeDescription') }}</p>
    </div>

    <!-- Time Base -->
    <div class="mb-4" v-if="enableDateFilter">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.timeBase') }}</label>
      <div class="flex gap-4 mt-2">
        <label class="flex items-center gap-1.5 cursor-pointer text-sm text-[var(--text-primary)]">
          <input v-model="timeField" type="radio" value="inserted_at" class="mr-2 accent-orange-500" />
          {{ t('settings.entryTime') }}
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer text-sm text-[var(--text-primary)]">
          <input v-model="timeField" type="radio" value="published_at" class="mr-2 accent-orange-500" />
          {{ t('settings.publishTime') }}
        </label>
      </div>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.timeBaseDescription') }}</p>
    </div>
  </section>

  <!-- Mark as Read Settings -->
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_16px_0] text-base font-semibold text-[var(--text-primary)] hidden md:block">{{ t('settings.markAsReadSettings') }}</h3>

    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.markAsReadRange') }}</label>
      <select v-model="markAsReadRange" class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]">
        <option value="current">{{ t('settings.markAsReadRangeCurrent') }}</option>
        <option value="3d">{{ t('settings.markAsReadRange3d') }}</option>
        <option value="7d">{{ t('settings.markAsReadRange7d') }}</option>
        <option value="30d">{{ t('settings.markAsReadRange30d') }}</option>
        <option value="all">{{ t('settings.markAsReadRangeAll') }}</option>
      </select>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.markAsReadRangeDescription') }}</p>
    </div>
  </section>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
