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
  <section class="settings-section">
    <h3>{{ t('settings.displaySettings') }}</h3>
    
    <!-- Show Entry Summary -->
    <div class="form-group">
      <label>
        <input v-model="showEntrySummary" type="checkbox" class="form-checkbox" />
        {{ t('settings.showEntrySummary') }}
      </label>
      <p class="form-hint">{{ t('settings.showEntrySummaryDescription') }}</p>
    </div>

    <!-- Enable Date Filter -->
    <div class="form-group">
      <label>
        <input v-model="enableDateFilter" type="checkbox" class="form-checkbox" />
        {{ t('settings.enableTimeFilter') }}
      </label>
      <p class="form-hint">{{ t('settings.timeFilterDescription') }}</p>
    </div>

    <!-- Default Time Range -->
    <div class="form-group" v-if="enableDateFilter">
      <label>{{ t('settings.defaultTimeRange') }}</label>
      <select v-model="defaultDateRange" class="form-select">
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
      <p class="form-hint">{{ t('settings.timeRangeDescription') }}</p>
    </div>

    <!-- Time Base -->
    <div class="form-group" v-if="enableDateFilter">
      <label>{{ t('settings.timeBase') }}</label>
      <div class="radio-group-inline">
        <label class="radio-label-inline">
          <input v-model="timeField" type="radio" value="inserted_at" class="form-radio" />
          {{ t('settings.entryTime') }}
        </label>
        <label class="radio-label-inline">
          <input v-model="timeField" type="radio" value="published_at" class="form-radio" />
          {{ t('settings.publishTime') }}
        </label>
      </div>
      <p class="form-hint">{{ t('settings.timeBaseDescription') }}</p>
    </div>
  </section>

  <!-- Mark as Read Settings -->
  <section class="settings-section">
    <h3>{{ t('settings.markAsReadSettings') }}</h3>
    
    <div class="form-group">
      <label>{{ t('settings.markAsReadRange') }}</label>
      <select v-model="markAsReadRange" class="form-select">
        <option value="current">{{ t('settings.markAsReadRangeCurrent') }}</option>
        <option value="3d">{{ t('settings.markAsReadRange3d') }}</option>
        <option value="7d">{{ t('settings.markAsReadRange7d') }}</option>
        <option value="30d">{{ t('settings.markAsReadRange30d') }}</option>
        <option value="all">{{ t('settings.markAsReadRangeAll') }}</option>
      </select>
      <p class="form-hint">{{ t('settings.markAsReadRangeDescription') }}</p>
    </div>
  </section>
</template>

<style scoped>
.radio-group-inline {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.radio-label-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}
</style>
