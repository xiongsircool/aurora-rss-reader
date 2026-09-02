<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../../api/client'
import { getApiErrorMessage } from '../../api/errors'

interface DailyCount {
  date: string
  count: number
}

interface ReadingStats {
  totals: {
    entries: number
    read: number
    unread: number
    starred: number
    feeds: number
    read_rate: number
  }
  top_feeds: Array<{
    feed_id: string
    title: string
    total: number
    read: number
    read_rate: number
  }>
  ingest_daily: DailyCount[]
  read_daily: DailyCount[]
  top_tags: Array<{
    tag_id: string
    name: string
    count: number
  }>
  generated_at: string
}

const { t, locale } = useI18n()
const stats = ref<ReadingStats | null>(null)
const loading = ref(false)
const error = ref('')

const summaryItems = computed(() => {
  if (!stats.value) return []
  return [
    { key: 'entries', label: t('readingStats.totalEntries'), value: stats.value.totals.entries, icon: 'i-carbon-document', color: 'text-blue-500' },
    { key: 'read', label: t('readingStats.readEntries'), value: stats.value.totals.read, icon: 'i-carbon-checkmark-outline', color: 'text-emerald-500' },
    { key: 'unread', label: t('readingStats.unreadEntries'), value: stats.value.totals.unread, icon: 'i-carbon-email-new', color: 'text-orange-500' },
    { key: 'starred', label: t('readingStats.starredEntries'), value: stats.value.totals.starred, icon: 'i-carbon-star', color: 'text-amber-500' },
    { key: 'feeds', label: t('readingStats.totalFeeds'), value: stats.value.totals.feeds, icon: 'i-carbon-rss', color: 'text-violet-500' },
  ]
})

const chartDays = computed(() => {
  if (!stats.value) return []
  const readByDate = new Map(stats.value.read_daily.map((item) => [item.date, item.count]))
  return stats.value.ingest_daily.map((item) => ({
    date: item.date,
    ingested: item.count,
    read: readByDate.get(item.date) ?? 0,
  }))
})

const chartMax = computed(() => Math.max(1, ...chartDays.value.flatMap((day) => [day.ingested, day.read])))

function barHeight(value: number): string {
  if (value <= 0) return '2px'
  return `${Math.max(4, Math.round((value / chartMax.value) * 96))}px`
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'numeric', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.get<ReadingStats>('/stats')
    stats.value = response.data
  } catch (err) {
    error.value = getApiErrorMessage(err, t('readingStats.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <section class="space-y-5 min-w-0">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 class="m-0 text-lg font-600 text-[var(--text-primary)]">{{ t('readingStats.title') }}</h3>
        <p class="mt-1 mb-0 text-sm leading-5 text-[var(--text-secondary)]">{{ t('readingStats.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-orange-500 hover:border-orange-500/40 disabled:opacity-50 transition-colors"
        :disabled="loading"
        :title="t('common.refresh')"
        @click="loadStats"
      >
        <span class="i-carbon-renew text-lg" :class="loading ? 'animate-spin' : ''"></span>
      </button>
    </div>

    <div v-if="error" class="p-4 rounded-lg border border-red-500/30 bg-red-500/8 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <div v-if="loading && !stats" class="h-48 flex items-center justify-center text-sm text-[var(--text-secondary)]">
      <span class="i-carbon-circle-dash animate-spin text-xl mr-2"></span>
      {{ t('common.loading') }}
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          v-for="item in summaryItems"
          :key="item.key"
          class="min-w-0 p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs leading-4 text-[var(--text-secondary)] break-words">{{ item.label }}</span>
            <span :class="[item.icon, item.color, 'text-lg shrink-0']"></span>
          </div>
          <div class="mt-2 text-2xl font-700 text-[var(--text-primary)] tabular-nums">{{ item.value.toLocaleString() }}</div>
        </div>
      </div>

      <div class="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)]">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h4 class="m-0 text-sm font-600 text-[var(--text-primary)]">{{ t('readingStats.last30Days') }}</h4>
            <p class="mt-1 mb-0 text-xs text-[var(--text-secondary)]">{{ t('readingStats.timelineHint') }}</p>
          </div>
          <div class="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-sm bg-blue-500"></i>{{ t('readingStats.ingested') }}</span>
            <span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></i>{{ t('readingStats.read') }}</span>
          </div>
        </div>
        <div class="h-28 flex items-end gap-1 overflow-hidden" :aria-label="t('readingStats.last30Days')">
          <div
            v-for="(day, index) in chartDays"
            :key="day.date"
            class="flex-1 min-w-0 h-full flex items-end justify-center gap-px border-b border-[var(--border-color)]"
            :title="`${shortDate(day.date)} · ${t('readingStats.ingested')} ${day.ingested} · ${t('readingStats.read')} ${day.read}`"
          >
            <i class="w-[42%] max-w-2 rounded-t-sm bg-blue-500/75" :style="{ height: barHeight(day.ingested) }"></i>
            <i class="w-[42%] max-w-2 rounded-t-sm bg-emerald-500/80" :style="{ height: barHeight(day.read) }"></i>
            <span v-if="index % 7 === 0" class="sr-only">{{ shortDate(day.date) }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] min-w-0">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h4 class="m-0 text-sm font-600 text-[var(--text-primary)]">{{ t('readingStats.topFeeds') }}</h4>
            <span class="text-xs text-[var(--text-secondary)]">{{ t('readingStats.overallReadRate') }} {{ percent(stats.totals.read_rate) }}</span>
          </div>
          <div v-if="stats.top_feeds.length" class="space-y-3">
            <div v-for="feed in stats.top_feeds" :key="feed.feed_id" class="min-w-0">
              <div class="flex items-center justify-between gap-3 text-xs mb-1.5">
                <span class="truncate text-[var(--text-primary)]" :title="feed.title">{{ feed.title }}</span>
                <span class="shrink-0 tabular-nums text-[var(--text-secondary)]">{{ feed.read }}/{{ feed.total }} · {{ percent(feed.read_rate) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                <div class="h-full rounded-full bg-emerald-500" :style="{ width: percent(feed.read_rate) }"></div>
              </div>
            </div>
          </div>
          <p v-else class="m-0 py-6 text-center text-sm text-[var(--text-secondary)]">{{ t('common.noData') }}</p>
        </div>

        <div class="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] min-w-0">
          <h4 class="m-0 mb-4 text-sm font-600 text-[var(--text-primary)]">{{ t('readingStats.topTags') }}</h4>
          <div v-if="stats.top_tags.length" class="flex flex-wrap gap-2">
            <span
              v-for="tag in stats.top_tags"
              :key="tag.tag_id"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-sm text-[var(--text-primary)]"
            >
              <span class="truncate max-w-40">{{ tag.name }}</span>
              <span class="text-xs tabular-nums text-[var(--text-secondary)]">{{ tag.count }}</span>
            </span>
          </div>
          <p v-else class="m-0 py-6 text-center text-sm text-[var(--text-secondary)]">{{ t('common.noData') }}</p>
        </div>
      </div>
    </template>
  </section>
</template>
