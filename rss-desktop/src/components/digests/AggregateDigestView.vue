<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownContent from '../common/MarkdownContent.vue'
import { useAIStore, type AggregateDigestEntryPreview, type AggregateDigestRecord } from '../../stores/aiStore'
import { useAIAutomation } from '../../composables/useAIAutomation'
import { formatDate } from '../../utils/date'

type ScopeType = 'feed' | 'group'

const props = defineProps<{
  scopeType: ScopeType
  scopeId: string
  scopeLabel: string
}>()

const emit = defineEmits<{
  (e: 'select-entry', entryId: string): void
  (e: 'back'): void
}>()

const { t, locale } = useI18n()
const aiStore = useAIStore()
const { isTaskEnabled } = useAIAutomation()

const period = ref<'latest' | 'week'>('latest')
const loading = ref(false)
const historyLoading = ref(false)
const regenerating = ref(false)
const digest = ref<AggregateDigestRecord | null>(null)
const entries = ref<AggregateDigestEntryPreview[]>([])
const recentCount = ref(0)
const timeRangeKey = ref<string | null>(null)
const expandedSummary = ref(false)
const expandedHistory = ref<Set<string>>(new Set())
const historyItems = ref<AggregateDigestRecord[]>([])
const historyCursor = ref<string | null>(null)
const historyHasMore = ref(false)
const showHistory = ref(false)
const autoGenerationAttempted = ref(false)

const accentColor = computed(() => props.scopeType === 'feed' ? '#ff7a18' : '#0ea5e9')
const scopeTitle = computed(() => props.scopeType === 'feed' ? t('digests.feedDigest') : t('digests.groupDigest'))
const emptyMessage = computed(() => props.scopeType === 'feed' ? t('digests.feedDigestEmpty') : t('digests.groupDigestEmpty'))

function shouldShowSummaryToggle(summary: string | null | undefined) {
  return !!summary && summary.length > 140
}

function resolveCitationEntries(citations: Array<{ ref: number; entry_id: string }>, sourceEntries: AggregateDigestEntryPreview[]) {
  return citations
    .map((citation) => ({
      ref: citation.ref,
      entry: sourceEntries.find((item) => item.id === citation.entry_id),
    }))
    .filter((item, index, list) => {
      if (!item.entry) return true
      return list.findIndex((candidate) => candidate.entry?.id === item.entry?.id) === index
    })
}

function formatRange(periodValue: 'latest' | 'week', rangeKey?: string | null) {
  if (!rangeKey) return periodValue === 'week' ? t('tags.digestWeek') : t('tags.digestLatest')
  return periodValue === 'week'
    ? `${t('tags.digestWeek')} (${rangeKey})`
    : t('tags.digestLatest')
}

function isHistorySummaryExpanded(itemId: string) {
  return expandedHistory.value.has(itemId)
}

function toggleHistorySummary(itemId: string) {
  if (expandedHistory.value.has(itemId)) expandedHistory.value.delete(itemId)
  else expandedHistory.value.add(itemId)
  expandedHistory.value = new Set(expandedHistory.value)
}

async function loadDigest() {
  loading.value = true
  try {
    const data = await aiStore.fetchAggregateDigest({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      period: period.value,
      language: locale.value,
    })
    digest.value = data.item
      ? {
          ...data.item,
          summary: data.item.summary_md || data.item.summary || '',
          summary_updated_at: data.item.summary_updated_at || data.item.created_at,
        }
      : null
    entries.value = data.entries || []
    recentCount.value = data.recentCount || 0
    timeRangeKey.value = data.time_range_key || null
    expandedSummary.value = false

    const autoDigestEnabled = isTaskEnabled('aggregate_digest', {
      feedId: props.scopeType === 'feed' ? props.scopeId : null,
      groupName: props.scopeType === 'group' ? props.scopeId : null,
    })

    if (!digest.value && recentCount.value > 0 && autoDigestEnabled && !autoGenerationAttempted.value) {
      autoGenerationAttempted.value = true
      await regenerateDigest('auto')
    }
  } finally {
    loading.value = false
  }
}

async function regenerateDigest(triggerType: 'auto' | 'manual' = 'manual') {
  if (regenerating.value) return
  regenerating.value = true
  try {
    const data = await aiStore.regenerateAggregateDigest({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      period: period.value,
      ui_language: locale.value,
      trigger_type: triggerType,
    })
    digest.value = data.item
      ? {
          ...data.item,
          summary: data.item.summary_md || data.item.summary || '',
          summary_updated_at: data.item.summary_updated_at || data.item.created_at,
        }
      : null
    entries.value = data.entries || []
    recentCount.value = data.recentCount || 0
    timeRangeKey.value = data.time_range_key || null
    if (showHistory.value) {
      await loadHistory(true)
    }
  } finally {
    regenerating.value = false
  }
}

async function loadHistory(reset = false) {
  if (historyLoading.value) return
  historyLoading.value = true
  try {
    const data = await aiStore.fetchAggregateDigestHistory({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      period: period.value,
      language: locale.value,
      limit: 10,
      cursor: reset ? null : historyCursor.value,
    })
    historyItems.value = reset ? data.items : [...historyItems.value, ...data.items]
    historyCursor.value = data.nextCursor
    historyHasMore.value = data.hasMore
  } finally {
    historyLoading.value = false
  }
}

async function openHistory() {
  showHistory.value = true
  await loadHistory(true)
}

onMounted(() => {
  loadDigest()
})

watch(() => [props.scopeType, props.scopeId, locale.value] as const, () => {
  autoGenerationAttempted.value = false
  historyItems.value = []
  historyCursor.value = null
  historyHasMore.value = false
  showHistory.value = false
  loadDigest()
})

watch(period, () => {
  autoGenerationAttempted.value = false
  historyItems.value = []
  historyCursor.value = null
  historyHasMore.value = false
  showHistory.value = false
  loadDigest()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <button
          class="mb-2 inline-flex items-center gap-1.5 bg-transparent border-none p-0 text-[11px] c-[var(--text-secondary)] hover:c-[var(--text-primary)] cursor-pointer"
          @click="emit('back')"
        >
          <span class="i-carbon-arrow-left"></span>
          <span>{{ t('navigation.backToSubscription') }}</span>
        </button>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: accentColor }"></span>
          <span class="text-[14px] font-bold c-[var(--text-primary)]">{{ scopeTitle }}</span>
        </div>
        <div class="mt-1 text-[12px] c-[var(--text-secondary)] truncate">{{ scopeLabel }}</div>
      </div>
      <div class="flex items-center gap-1 bg-[var(--bg-base)] rounded-lg p-0.5 border border-[var(--border-color)]">
        <button
          @click="period = 'latest'"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="period === 'latest'
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.digestLatest') }}
        </button>
        <button
          @click="period = 'week'"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="period === 'week'
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.digestWeek') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-8 text-center">
      <div class="inline-block animate-spin w-5 h-5 border-2 border-t-transparent rounded-full" :style="{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }"></div>
    </div>

    <div v-else class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[13px] font-semibold c-[var(--text-primary)]">{{ formatRange(period, timeRangeKey) }}</div>
          <div class="mt-0.5 text-[11px] c-[var(--text-tertiary)]">
            {{ t('tags.digestNewArticles', { count: recentCount }) }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="digest"
            class="text-[11px] bg-transparent border-none cursor-pointer px-0"
            :style="{ color: accentColor }"
            @click="openHistory"
          >
            {{ t('common.viewHistory') }}
          </button>
          <button
            class="px-2.5 py-1 rounded-md text-[11px] border transition-colors"
            :class="regenerating ? 'opacity-70 cursor-wait' : ''"
            :style="{ borderColor: `${accentColor}55`, color: accentColor, backgroundColor: `${accentColor}10` }"
            @click="() => regenerateDigest('manual')"
          >
            {{ regenerating ? t('tags.digestRegenerating') : t('digests.regenerateDigest') }}
          </button>
        </div>
      </div>

      <div v-if="digest?.summary" class="px-4 py-3">
        <MarkdownContent
          :content="digest.summary"
          class="text-[12px] leading-5 c-[var(--text-primary)]"
          :style="expandedSummary
            ? {}
            : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
        />
        <button
          v-if="shouldShowSummaryToggle(digest.summary)"
          class="mt-1 text-[11px] hover:underline bg-transparent border-none cursor-pointer px-0"
          :style="{ color: accentColor }"
          @click="expandedSummary = !expandedSummary"
        >
          {{ expandedSummary ? t('tags.digestCollapse') : t('tags.digestExpand') }}
        </button>

        <div v-if="digest.citations?.length" class="mt-2 flex flex-wrap gap-1.5">
          <button
            v-for="citation in resolveCitationEntries(digest.citations, entries)"
            :key="`${citation.ref}-${citation.entry?.id || 'missing'}`"
            type="button"
            class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full text-[10px] border border-[rgba(15,17,21,0.12)] bg-[rgba(15,17,21,0.04)] dark:border-[rgba(255,255,255,0.14)] dark:bg-[rgba(255,255,255,0.06)] c-[var(--text-secondary)] hover:c-[var(--text-primary)]"
            :disabled="!citation.entry"
            @click="citation.entry && emit('select-entry', citation.entry.id)"
          >
            <span class="font-semibold">[{{ citation.ref }}]</span>
            <span class="truncate">{{ citation.entry?.title || t('common.unknown') }}</span>
          </button>
        </div>

        <div v-if="digest.keywords?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="kw in digest.keywords"
            :key="kw"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border"
            :style="{ borderColor: `${accentColor}55`, color: accentColor, backgroundColor: `${accentColor}12` }"
          >
            {{ kw }}
          </span>
        </div>
      </div>

      <div v-else class="px-4 py-8 text-center">
        <p class="text-[13px] c-[var(--text-tertiary)]">{{ emptyMessage }}</p>
      </div>

      <div class="border-t border-[var(--border-color)]">
        <button
          v-for="(entry, index) in entries"
          :key="entry.id"
          class="w-full flex items-start gap-2 px-4 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors"
          :class="{ 'border-t border-[var(--border-color)]': index > 0 }"
          @click="emit('select-entry', entry.id)"
        >
          <span class="text-[11px] c-[var(--text-tertiary)] mt-0.5 shrink-0 tabular-nums w-4 text-right">{{ index + 1 }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-medium c-[var(--text-primary)] line-clamp-1">{{ entry.title || t('common.unknown') }}</div>
            <div class="text-[10px] c-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
              <span>{{ entry.feed_title || t('common.unknown') }}</span>
              <span v-if="entry.published_at">{{ entry.published_at }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showHistory"
        class="fixed inset-0 z-[12000] flex items-center justify-center p-4"
        @keydown.esc="showHistory = false"
      >
        <div class="absolute inset-0 bg-black/45" @click="showHistory = false"></div>
        <div class="relative w-[min(920px,96vw)] max-h-[86vh] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: accentColor }"></span>
              <span class="text-[13px] font-semibold c-[var(--text-primary)]">{{ scopeLabel }} · {{ t('common.viewHistory') }}</span>
            </div>
            <button class="text-[11px] c-[var(--text-secondary)] hover:c-[var(--text-primary)] bg-transparent border-none cursor-pointer" @click="showHistory = false">
              {{ t('common.close') }}
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[calc(86vh-56px)] bg-[var(--bg-base)]">
            <div v-if="historyLoading" class="text-[12px] c-[var(--text-tertiary)]">Loading...</div>
            <div v-else-if="historyItems.length === 0" class="text-[12px] c-[var(--text-tertiary)]">{{ t('common.noData') }}</div>
            <div v-else class="space-y-2">
              <div
                v-for="item in historyItems"
                :key="item.id || `${item.time_range_key}-${item.summary_updated_at}`"
                class="relative rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 pl-4"
              >
                <span class="absolute left-1.5 top-3 h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: accentColor }"></span>
                <div class="text-[10px] c-[var(--text-tertiary)] mb-1 flex flex-wrap items-center gap-1.5">
                  <span>{{ formatDate(item.summary_updated_at || item.created_at || '', null) }}</span>
                  <span>·</span>
                  <span>{{ formatRange(item.period || period, item.time_range_key) }}</span>
                  <span v-if="item.source_count">·</span>
                  <span v-if="item.source_count">{{ item.source_count }}</span>
                  <span>·</span>
                  <span>{{ item.trigger_type === 'manual' ? t('tags.digestManual') : t('tags.digestAuto') }}</span>
                  <span v-if="item.model_name">·</span>
                  <span v-if="item.model_name">{{ item.model_name }}</span>
                </div>
                <MarkdownContent
                  :content="item.summary_md || item.summary || ''"
                  class="text-[12px] c-[var(--text-primary)] leading-5"
                  :style="isHistorySummaryExpanded(item.id || '')
                    ? {}
                    : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
                />
                <button
                  v-if="shouldShowSummaryToggle(item.summary_md || item.summary || '')"
                  class="mt-1 text-[10px] hover:underline bg-transparent border-none cursor-pointer px-0"
                  :style="{ color: accentColor }"
                  @click="toggleHistorySummary(item.id || '')"
                >
                  {{ isHistorySummaryExpanded(item.id || '') ? t('tags.digestCollapse') : t('tags.digestExpand') }}
                </button>
                <div v-if="item.keywords?.length" class="mt-1.5 flex flex-wrap gap-1">
                  <span
                    v-for="kw in item.keywords"
                    :key="`${item.id || item.time_range_key}-${kw}`"
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border"
                    :style="{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}10` }"
                  >
                    {{ kw }}
                  </span>
                </div>
              </div>
              <button
                v-if="historyHasMore"
                class="w-full py-1.5 rounded-md border border-[var(--border-color)] text-[11px] c-[var(--text-secondary)] bg-[var(--bg-surface)] hover:c-[var(--text-primary)]"
                @click="loadHistory(false)"
              >
                {{ t('common.loadMore') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
