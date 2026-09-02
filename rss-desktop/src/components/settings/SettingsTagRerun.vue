<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore } from '../../stores/feedStore'
import { useTagsStore, type RerunSummary } from '../../stores/tagsStore'

type RerunMode = 'missing' | 'all'
type RerunScope = 'all' | 'groups' | 'feeds'

const { t } = useI18n()
const feedStore = useFeedStore()
const tagsStore = useTagsStore()

const from = ref('')
const to = ref('')
const mode = ref<RerunMode>('missing')
const scope = ref<RerunScope>('all')
const limit = ref(50)
const groupSearch = ref('')
const feedSearch = ref('')
const selectedGroupKeys = ref<string[]>([])
const selectedFeedIds = ref<string[]>([])

const errorMessage = ref('')
const currentSummary = computed<RerunSummary | null>(() => tagsStore.rerunTask.currentSummary)
const totalSummary = computed<RerunSummary | null>(() => tagsStore.rerunTask.totalSummary)
const batches = computed(() => tagsStore.rerunTask.batches)
const stoppedReason = computed(() => tagsStore.rerunTask.stoppedReason)
const taskRunning = computed(() => tagsStore.rerunTask.running)

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function initializeRange() {
  const now = new Date()
  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  from.value = toLocalDateTimeInput(fromDate)
  to.value = toLocalDateTimeInput(now)
}

const availableFeeds = computed(() =>
  [...feedStore.feeds]
    .filter((feed) => feed.ai_tagging_enabled !== 0)
    .map((feed) => ({
      id: feed.id,
      label: feed.custom_title || feed.title || feed.url,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en')),
)

const filteredFeeds = computed(() => {
  const keyword = feedSearch.value.trim().toLowerCase()
  if (!keyword) return availableFeeds.value
  return availableFeeds.value.filter((feed) =>
    feed.label.toLowerCase().includes(keyword),
  )
})

const availableGroups = computed(() => {
  const grouped = new Map<string, { key: string; label: string; feedCount: number }>()
  for (const feed of feedStore.feeds) {
    if (feed.ai_tagging_enabled === 0) continue
    const key = feed.group_name || ''
    const existing = grouped.get(key)
    if (existing) {
      existing.feedCount += 1
      continue
    }
    grouped.set(key, {
      key,
      label: key || t('tags.ungrouped'),
      feedCount: 1,
    })
  }
  return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label, 'en'))
})

const filteredGroups = computed(() => {
  const keyword = groupSearch.value.trim().toLowerCase()
  if (!keyword) return availableGroups.value
  return availableGroups.value.filter((group) => group.label.toLowerCase().includes(keyword))
})

function toggleFeedSelection(feedId: string, checked: boolean) {
  if (checked) {
    if (!selectedFeedIds.value.includes(feedId)) {
      selectedFeedIds.value.push(feedId)
    }
    return
  }
  selectedFeedIds.value = selectedFeedIds.value.filter((id) => id !== feedId)
}

function clearSelection() {
  selectedGroupKeys.value = []
  selectedFeedIds.value = []
}

function toggleGroupSelection(groupKey: string, checked: boolean) {
  if (checked) {
    if (!selectedGroupKeys.value.includes(groupKey)) {
      selectedGroupKeys.value.push(groupKey)
    }
    return
  }
  selectedGroupKeys.value = selectedGroupKeys.value.filter((key) => key !== groupKey)
}

function formatSummary(summary: RerunSummary | null): string {
  if (!summary) return '-'
  return `${summary.total}/${summary.success}/${summary.tagged}/${summary.untagged}`
}

async function startRangeRerun() {
  errorMessage.value = ''

  if (!from.value || !to.value) {
    errorMessage.value = t('tags.rerunErrorTime')
    return
  }

  const fromMs = Date.parse(from.value)
  const toMs = Date.parse(to.value)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    errorMessage.value = t('tags.rerunErrorTime')
    return
  }
  if (fromMs > toMs) {
    errorMessage.value = t('tags.rerunErrorRange')
    return
  }

  const safeLimit = Math.max(1, Math.min(limit.value || 50, 200))
  const fromIso = new Date(from.value).toISOString()
  const toIso = new Date(to.value).toISOString()
  let scopedFeedIds: string[] | undefined

  if (scope.value === 'groups') {
    if (selectedGroupKeys.value.length === 0) {
      errorMessage.value = t('tags.rerunErrorScope')
      return
    }
    scopedFeedIds = feedStore.feeds
      .filter((feed) => feed.ai_tagging_enabled !== 0 && selectedGroupKeys.value.includes(feed.group_name || ''))
      .map((feed) => feed.id)
  } else if (scope.value === 'feeds') {
    if (selectedFeedIds.value.length === 0) {
      errorMessage.value = t('tags.rerunErrorScope')
      return
    }
    scopedFeedIds = selectedFeedIds.value
  }

  if (scopedFeedIds && scopedFeedIds.length === 0) {
    errorMessage.value = t('tags.rerunErrorScope')
    return
  }

  try {
    const result = await tagsStore.runRangeRerunTask({
      from: fromIso,
      to: toIso,
      mode: mode.value,
      feedIds: scopedFeedIds,
      limit: safeLimit,
    })
    if (result.stoppedReason === 'cursor_not_advanced') {
      errorMessage.value = 'Range rerun stopped early because cursor did not advance.'
    } else if (result.stoppedReason === 'too_many_batches') {
      errorMessage.value = 'Range rerun stopped after too many batches.'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(async () => {
  initializeRange()
  if (!feedStore.feeds.length) {
    await feedStore.fetchFeeds()
  }
})
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_8px_0] text-base font-semibold text-[var(--text-primary)]">{{ t('tags.rangeRerun') }}</h3>
    <p class="m-0 text-xs text-[var(--text-secondary)]">
      {{ t('tags.rangeRerunNote') }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <label class="text-sm text-[var(--text-primary)]">
        <span class="block mb-1.5">{{ t('tags.rerunFrom') }}</span>
        <input
          v-model="from"
          type="datetime-local"
          class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
        />
      </label>
      <label class="text-sm text-[var(--text-primary)]">
        <span class="block mb-1.5">{{ t('tags.rerunTo') }}</span>
        <input
          v-model="to"
          type="datetime-local"
          class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
        />
      </label>
    </div>

    <div class="mt-4">
      <label class="block mb-1.5 text-sm text-[var(--text-primary)]">{{ t('tags.rerunMode') }}</label>
      <select
        v-model="mode"
        class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      >
        <option value="missing">{{ t('tags.rerunModeMissing') }}</option>
        <option value="all">{{ t('tags.rerunModeAll') }}</option>
      </select>
    </div>

    <div class="mt-4">
      <label class="block mb-1.5 text-sm text-[var(--text-primary)]">{{ t('tags.rerunScope') }}</label>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-md border transition-all"
          :class="scope === 'all'
            ? 'bg-[rgba(255,122,24,0.12)] border-[rgba(255,122,24,0.3)] text-orange-500'
            : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'"
          @click="scope = 'all'"
        >
          {{ t('tags.rerunScopeAll') }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-md border transition-all"
          :class="scope === 'groups'
            ? 'bg-[rgba(255,122,24,0.12)] border-[rgba(255,122,24,0.3)] text-orange-500'
            : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'"
          @click="scope = 'groups'"
        >
          {{ t('tags.rerunScopeGroups') }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs rounded-md border transition-all"
          :class="scope === 'feeds'
            ? 'bg-[rgba(255,122,24,0.12)] border-[rgba(255,122,24,0.3)] text-orange-500'
            : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'"
          @click="scope = 'feeds'"
        >
          {{ t('tags.rerunScopeFeeds') }}
        </button>
      </div>
    </div>

    <div v-if="scope === 'groups'" class="mt-4">
      <label class="block mb-1.5 text-sm text-[var(--text-primary)]">{{ t('tags.rerunGroups') }}</label>
      <input
        v-model="groupSearch"
        type="text"
        :placeholder="t('tags.rerunGroupSearch')"
        class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
      <div class="mt-1.5 text-xs text-[var(--text-secondary)] flex items-center justify-between gap-2">
        <span>{{ t('tags.rerunGroupsHint') }}</span>
        <button
          type="button"
          class="text-orange-500 hover:text-orange-600 bg-transparent border-none p-0 cursor-pointer"
          @click="clearSelection"
        >
          {{ t('tags.clearSelection') }}
        </button>
      </div>
      <div class="mt-2 max-h-220px overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 space-y-1">
        <label
          v-for="group in filteredGroups"
          :key="group.key || '__ungrouped__'"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <input
            type="checkbox"
            :checked="selectedGroupKeys.includes(group.key)"
            class="accent-orange-500"
            @change="toggleGroupSelection(group.key, ($event.target as HTMLInputElement).checked)"
          />
          <span class="truncate">{{ group.label }}</span>
          <span class="ml-auto text-xs text-[var(--text-secondary)] tabular-nums">{{ group.feedCount }}</span>
        </label>
        <div v-if="filteredGroups.length === 0" class="px-2 py-1.5 text-xs text-[var(--text-secondary)]">
          {{ t('tags.noGroupsMatch') }}
        </div>
      </div>
    </div>

    <div v-if="scope === 'feeds'" class="mt-4">
      <label class="block mb-1.5 text-sm text-[var(--text-primary)]">{{ t('tags.rerunFeeds') }}</label>
      <input
        v-model="feedSearch"
        type="text"
        :placeholder="t('tags.rerunFeedSearch')"
        class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
      <div class="mt-1.5 text-xs text-[var(--text-secondary)] flex items-center justify-between gap-2">
        <span>{{ t('tags.rerunFeedsHint') }}</span>
        <button
          type="button"
          class="text-orange-500 hover:text-orange-600 bg-transparent border-none p-0 cursor-pointer"
          @click="clearSelection"
        >
          {{ t('tags.clearSelection') }}
        </button>
      </div>

      <div class="mt-2 max-h-220px overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 space-y-1">
        <label
          v-for="feed in filteredFeeds"
          :key="feed.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <input
            type="checkbox"
            :checked="selectedFeedIds.includes(feed.id)"
            class="accent-orange-500"
            @change="toggleFeedSelection(feed.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="truncate">{{ feed.label }}</span>
        </label>
        <div v-if="filteredFeeds.length === 0" class="px-2 py-1.5 text-xs text-[var(--text-secondary)]">
          {{ t('tags.noFeedsMatch') }}
        </div>
      </div>
    </div>

    <div class="mt-4">
      <label class="block mb-1.5 text-sm text-[var(--text-primary)]">{{ t('tags.rerunLimit') }}</label>
      <input
        v-model.number="limit"
        type="number"
        min="1"
        max="200"
        class="w-full p-[10px_12px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
    </div>

    <div class="mt-4">
      <button
        type="button"
        :disabled="taskRunning"
        class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
        @click="startRangeRerun"
      >
        {{ taskRunning ? t('tags.analyzing') : t('tags.rerunStart') }}
      </button>
    </div>

    <div v-if="currentSummary" class="mt-3 text-sm text-[var(--text-primary)]">
      <div><span class="text-[var(--text-secondary)]">{{ t('tags.rerunSummary') }}:</span> {{ formatSummary(currentSummary) }}</div>
      <div><span class="text-[var(--text-secondary)]">{{ t('tags.rerunTotals') }}:</span> {{ formatSummary(totalSummary) }}</div>
      <div class="text-xs text-[var(--text-secondary)]">{{ t('tags.rerunLimit') }}: {{ batches }}</div>
      <div v-if="stoppedReason" class="text-xs text-[var(--text-secondary)]">stopped: {{ stoppedReason }}</div>
    </div>
    <p v-if="errorMessage" class="mt-2 mb-0 text-xs text-red-500">
      {{ errorMessage }}
    </p>
    <p class="mt-2 mb-0 text-xs text-[var(--text-secondary)]">
      {{ t('tags.rerunSummaryHint') }}
    </p>
  </section>
</template>
