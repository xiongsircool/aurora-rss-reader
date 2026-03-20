<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'

interface SummaryBackgroundStatus {
  enabled: boolean
  language: string
  range: {
    date_range: string
    time_field: 'published_at' | 'inserted_at'
    cutoff_at: string | null
  }
  queue: {
    eligible_in_range: number
    queued: number
    running: number
    failed: number
    succeeded: number
  }
  activity: {
    summaries_total: number
    summaries_last_24h: number
    jobs_last_24h: number
    last_job_at: string | null
    last_success_at: string | null
    last_failure_at: string | null
    last_error: string | null
  }
}

const props = defineProps<{
  draftEnabled: boolean
  draftDateRange: string
  draftTimeField: string
}>()

const { t, locale } = useI18n()

const status = ref<SummaryBackgroundStatus | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

const hasUnsavedChanges = computed(() => {
  if (!status.value) return false
  return (
    status.value.enabled !== props.draftEnabled ||
    status.value.range.date_range !== props.draftDateRange ||
    status.value.range.time_field !== props.draftTimeField
  )
})

const savedRangeText = computed(() => {
  if (!status.value) return '--'
  const fieldKey = status.value.range.time_field === 'published_at'
    ? 'settings.summaryBackgroundTimeFieldPublished'
    : 'settings.summaryBackgroundTimeFieldInserted'
  return t('settings.summaryBackgroundRuntimeRangeValue', {
    range: status.value.range.date_range,
    field: t(fieldKey),
  })
})

function formatDateTime(value: string | null): string {
  if (!value) return t('settings.summaryBackgroundStatusEmpty')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(locale.value === 'zh-CN' ? 'zh-CN' : undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchStatus() {
  loading.value = true
  error.value = null

  try {
    const { data } = await api.get<SummaryBackgroundStatus>('/settings/summary-background-status')
    status.value = data
  } catch (err) {
    error.value = getApiErrorMessage(err, t('settings.summaryBackgroundStatusLoadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchStatus()
  timer = setInterval(() => {
    void fetchStatus()
  }, 15000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)]/60 p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-semibold text-[var(--text-primary)]">
          {{ t('settings.summaryBackgroundRuntimeTitle') }}
        </div>
        <div class="mt-1 text-xs text-[var(--text-secondary)]">
          {{ t('settings.summaryBackgroundRuntimeHint') }}
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors bg-transparent"
        :disabled="loading"
        @click="fetchStatus"
      >
        {{ loading ? t('settings.summaryBackgroundRefreshing') : t('settings.summaryBackgroundRefresh') }}
      </button>
    </div>

    <div v-if="error" class="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-500">
      {{ error }}
    </div>

    <div v-else-if="status" class="mt-4 space-y-4">
      <div
        v-if="hasUnsavedChanges"
        class="rounded-lg border border-orange-500/20 bg-orange-500/8 px-3 py-2 text-xs text-orange-600 dark:text-orange-400"
      >
        {{ t('settings.summaryBackgroundUnsavedHint') }}
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundRuntimeRange') }}
          </div>
          <div class="mt-1 text-sm font-medium text-[var(--text-primary)] break-words">
            {{ savedRangeText }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundEligible') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {{ status.queue.eligible_in_range }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundRunning') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-orange-500">
            {{ status.queue.running }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundQueued') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {{ status.queue.queued }}
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundSucceeded') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-emerald-500">
            {{ status.queue.succeeded }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundFailed') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-red-500">
            {{ status.queue.failed }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundGenerated24h') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {{ status.activity.summaries_last_24h }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundTotalSaved') }}
          </div>
          <div class="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {{ status.activity.summaries_total }}
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundLastSuccess') }}
          </div>
          <div class="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {{ formatDateTime(status.activity.last_success_at) }}
          </div>
        </div>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {{ t('settings.summaryBackgroundLastFailure') }}
          </div>
          <div class="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {{ formatDateTime(status.activity.last_failure_at) }}
          </div>
        </div>
      </div>

      <div v-if="status.activity.last_error" class="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
        <div class="text-[11px] uppercase tracking-wide text-red-500/80">
          {{ t('settings.summaryBackgroundLastError') }}
        </div>
        <div class="mt-1 text-xs leading-5 text-red-500 break-words">
          {{ status.activity.last_error }}
        </div>
      </div>
    </div>

    <div v-else class="mt-3 text-xs text-[var(--text-secondary)]">
      {{ t('settings.summaryBackgroundLoading') }}
    </div>
  </div>
</template>
