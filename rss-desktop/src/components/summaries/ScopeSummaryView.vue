<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownContent from '../common/MarkdownContent.vue'
import {
  useAIStore,
  type ScopeSummaryEntryPreview,
  type ScopeSummaryRecord,
  type ScopeSummaryWindowType,
} from '../../stores/aiStore'
import { formatDate } from '../../utils/date'

const props = defineProps<{
  scopeType: 'feed' | 'group'
  scopeId: string
  scopeLabel: string
}>()

const emit = defineEmits<{
  (e: 'select-entry', entryId: string): void
  (e: 'back'): void
  (e: 'notify', message: string, type: 'success' | 'error' | 'info'): void
}>()

const { t, locale } = useI18n()
const aiStore = useAIStore()

const windowType = ref<ScopeSummaryWindowType>('24h')
const loading = ref(false)
const generating = ref(false)
const historyLoading = ref(false)
const summary = ref<ScopeSummaryRecord | null>(null)
const entries = ref<ScopeSummaryEntryPreview[]>([])
const entryIndexMap = ref<Record<number, string>>({})
const recentCount = ref(0)
const status = ref<'empty' | 'idle' | 'stale' | 'generating' | 'ready' | 'failed'>('idle')
const settings = ref({
  enabled: true,
  auto_generate: true,
  auto_generate_interval_minutes: 60,
  default_window: '24h' as ScopeSummaryWindowType,
  max_entries: 100,
  chunk_size: 10,
})
const suggestedWindows = ref<ScopeSummaryWindowType[]>([])
const expandedSummary = ref(false)
const historyItems = ref<ScopeSummaryRecord[]>([])
const historyCursor = ref<string | null>(null)
const historyHasMore = ref(false)
const showHistory = ref(false)
const autoGenerationAttempted = ref(false)
const queueHint = ref<'queued' | 'already_running' | null>(null)
const windowCandidates: ScopeSummaryWindowType[] = ['24h', '3d', '7d', '30d']
let pollTimer: ReturnType<typeof setTimeout> | null = null
let queueHintTimer: ReturnType<typeof setTimeout> | null = null

const accentColor = computed(() => props.scopeType === 'feed' ? '#ff7a18' : '#0ea5e9')
const scopeTitle = computed(() => props.scopeType === 'feed' ? t('scopeSummary.feedTitle') : t('scopeSummary.groupTitle'))
const isGeneratingState = computed(() => generating.value || status.value === 'generating')

function setQueueHint(next: 'queued' | 'already_running' | null) {
  queueHint.value = next
  if (queueHintTimer) {
    clearTimeout(queueHintTimer)
    queueHintTimer = null
  }
  if (next) {
    queueHintTimer = setTimeout(() => {
      queueHint.value = null
      queueHintTimer = null
    }, 5000)
  }
}

function normalizeSummaryMarkdown(content?: string | null) {
  if (!content) return ''
  let normalized = content.trim().replace(/\r\n/g, '\n')
  const wrappedFence = normalized.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i)
  if (wrappedFence?.[1]) {
    normalized = wrappedFence[1].trim()
  }
  return normalized.replace(/\n{3,}/g, '\n\n')
}

function mapSummaryRecord(item: ScopeSummaryRecord | null) {
  if (!item) return null
  const normalizedSummary = normalizeSummaryMarkdown(item.summary_md || item.summary || '')
  return {
    ...item,
    summary: normalizedSummary,
    summary_md: normalizedSummary,
    summary_updated_at: item.summary_updated_at || item.updated_at,
  }
}

function shouldShowSummaryToggle(content?: string | null) {
  return !!content && content.length > 260
}

function resolveCitationEntries(citations: Array<{ ref: number; entry_id: string }>, sourceEntries: ScopeSummaryEntryPreview[]) {
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

async function loadSummary() {
  loading.value = true
  try {
    const data = await aiStore.fetchScopeSummary({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      window_type: windowType.value,
      language: locale.value,
    })
    status.value = data.status
    entries.value = data.entries || []
    entryIndexMap.value = data.entry_index_map || {}
    recentCount.value = data.recentCount || 0
    settings.value = data.settings
    suggestedWindows.value = data.suggested_windows || []
    summary.value = mapSummaryRecord(data.item)
    expandedSummary.value = false

    if (data.status === 'generating') {
      startPolling()
    } else {
      stopPolling()
    }

    if (data.status === 'idle' && !summary.value?.summary && data.can_auto_generate && !autoGenerationAttempted.value) {
      autoGenerationAttempted.value = true
      await generateSummary('auto')
    }
  } catch (error) {
    console.error('Failed to load scope summary:', error)
    status.value = summary.value?.summary ? 'stale' : 'failed'
  } finally {
    loading.value = false
  }
}

async function generateSummary(triggerType: 'auto' | 'manual' = 'manual') {
  if (isGeneratingState.value) return
  generating.value = true
  status.value = 'generating'
  try {
    const data = await aiStore.generateScopeSummary({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      window_type: windowType.value,
      ui_language: locale.value,
      trigger_type: triggerType,
      background: true,
    })
    status.value = data.status
    entries.value = data.entries || []
    entryIndexMap.value = data.entry_index_map || {}
    recentCount.value = data.recentCount || 0
    settings.value = data.settings
    summary.value = mapSummaryRecord(data.item)
    if (data.queue_state === 'queued') {
      setQueueHint('queued')
      if (triggerType === 'manual') {
        emit('notify', t('scopeSummary.generating'), 'info')
      }
    } else if (data.queue_state === 'already_running') {
      setQueueHint('already_running')
      if (triggerType === 'manual') {
        emit('notify', t('scopeSummary.statusGenerating'), 'info')
      }
    } else {
      setQueueHint(null)
    }
    if (data.status === 'generating') {
      startPolling()
    } else {
      stopPolling()
    }
    if (showHistory.value) {
      await loadHistory(true)
    }
  } catch (error) {
    console.error('Failed to generate scope summary in view:', error)
    status.value = summary.value?.summary ? 'stale' : 'failed'
  } finally {
    generating.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  if (status.value !== 'generating') return
  stopPolling()
  pollTimer = setTimeout(async () => {
    try {
      const data = await aiStore.fetchScopeSummary({
        scope_type: props.scopeType,
        scope_id: props.scopeId,
        window_type: windowType.value,
        language: locale.value,
      })
      status.value = data.status
      entries.value = data.entries || []
      entryIndexMap.value = data.entry_index_map || {}
      recentCount.value = data.recentCount || 0
      settings.value = data.settings
      suggestedWindows.value = data.suggested_windows || []
      summary.value = mapSummaryRecord(data.item)

      if (data.status === 'generating') {
        startPolling()
      } else {
        stopPolling()
      }
    } catch (error) {
      console.error('Scope summary polling failed:', error)
      stopPolling()
      status.value = summary.value?.summary ? 'stale' : 'failed'
    }
  }, 3000)
}

async function loadHistory(reset = false) {
  if (historyLoading.value) return
  historyLoading.value = true
  try {
    const data = await aiStore.fetchScopeSummaryHistory({
      scope_type: props.scopeType,
      scope_id: props.scopeId,
      window_type: windowType.value,
      language: locale.value,
      limit: 10,
      cursor: reset ? null : historyCursor.value,
    })
    const mergedItems = reset ? data.items : [...historyItems.value, ...data.items]
    historyItems.value = mergedItems.map((item) => mapSummaryRecord(item) || item)
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

function switchWindow(nextWindow: ScopeSummaryWindowType) {
  if (windowType.value === nextWindow) return
  windowType.value = nextWindow
}

function summaryStatusText() {
  switch (status.value) {
    case 'empty': return t('scopeSummary.statusEmpty')
    case 'idle': return t('scopeSummary.statusIdle')
    case 'stale': return t('scopeSummary.statusStale')
    case 'generating': return t('scopeSummary.statusGenerating')
    case 'failed': return t('scopeSummary.statusFailed')
    default: return t('scopeSummary.statusReady')
  }
}

function processedSummary() {
  if (!summary.value?.summary) return ''
  let processed = summary.value.summary

  // First, enhance existing <span entry_id="X"> tags with clickable attributes and show index as superscript
  processed = processed.replace(/<span\s+entry_id="(\d+(?:,\d+)*)"[^>]*>(.*?)<\/span>/gi, (match, ids, content) => {
    const firstId = ids.split(',')[0].trim()
    const entryId = entryIndexMap.value[Number(firstId)]
    if (entryId) {
      return `<span class="entry-ref" data-entry-id="${entryId}" data-index="${firstId}">${content}<sup>[${firstId}]</sup></span>`
    }
    return match
  })

  // Replace (0), (1), (2) format with clickable spans (0-based index)
  processed = processed.replace(/\((\d+)\)/g, (match, num) => {
    const entryId = entryIndexMap.value[Number(num)]
    if (entryId) {
      return `<span class="entry-ref" data-entry-id="${entryId}" data-index="${num}">[${num}]</span>`
    }
    return match
  })

  // Replace [1], [2], [3] format with clickable spans (1-based index)
  processed = processed.replace(/\[(\d+)\]/g, (match, num) => {
    const refIndex = Number(num) - 1 // Convert 1-based to 0-based
    const entryId = entryIndexMap.value[refIndex]
    if (entryId) {
      return `<span class="entry-ref" data-entry-id="${entryId}" data-index="${refIndex}">[${num}]</span>`
    }
    return match
  })

  // Replace (编号: X) or 编号: X with clickable spans
  processed = processed.replace(/[（(]?编号:\s*(\d+)[）)]?/g, (match, num) => {
    const entryId = entryIndexMap.value[Number(num)]
    if (entryId) {
      return `<span class="entry-ref" data-entry-id="${entryId}" data-index="${num}">[${num}]</span>`
    }
    return match
  })

  return processed
}

function handleSummaryClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.classList.contains('entry-ref')) {
    const entryId = target.getAttribute('data-entry-id')
    if (entryId) {
      emit('select-entry', entryId)
    }
  }
}

onMounted(() => {
  loadSummary().catch((error) => {
    console.error('Initial scope summary load failed:', error)
  })
})

watch(() => [props.scopeType, props.scopeId, locale.value] as const, () => {
  stopPolling()
  autoGenerationAttempted.value = false
  historyItems.value = []
  historyCursor.value = null
  historyHasMore.value = false
  showHistory.value = false
  loadSummary().catch((error) => {
    console.error('Scope summary reload failed:', error)
  })
})

watch(windowType, () => {
  stopPolling()
  autoGenerationAttempted.value = false
  historyItems.value = []
  historyCursor.value = null
  historyHasMore.value = false
  showHistory.value = false
  loadSummary().catch((error) => {
    console.error('Scope summary window switch failed:', error)
  })
})

onUnmounted(() => {
  stopPolling()
  if (queueHintTimer) {
    clearTimeout(queueHintTimer)
    queueHintTimer = null
  }
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
          <span>{{ t('scopeSummary.backToArticles') }}</span>
        </button>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: accentColor }"></span>
          <span class="text-[14px] font-bold c-[var(--text-primary)]">{{ scopeTitle }}</span>
        </div>
        <div class="mt-1 text-[12px] c-[var(--text-secondary)] truncate">{{ scopeLabel }}</div>
      </div>
      <div class="flex items-center gap-1 bg-[var(--bg-base)] rounded-lg p-0.5 border border-[var(--border-color)] flex-wrap justify-end">
        <button
          v-for="candidate in windowCandidates"
          :key="candidate"
          @click="switchWindow(candidate)"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="windowType === candidate
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t(`scopeSummary.windows.${candidate}`) }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-8 text-center">
      <div class="inline-block animate-spin w-5 h-5 border-2 border-t-transparent rounded-full" :style="{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }"></div>
    </div>

    <div v-else class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
      <div class="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[13px] font-semibold c-[var(--text-primary)]">{{ t(`scopeSummary.windows.${windowType}`) }}</div>
          <div class="mt-0.5 text-[11px] c-[var(--text-tertiary)]">
            {{ t('scopeSummary.articleCount', { count: recentCount }) }} · {{ summaryStatusText() }}
          </div>
          <div v-if="queueHint" class="mt-1 text-[11px] c-[var(--text-secondary)]">
            {{ queueHint === 'already_running' ? t('scopeSummary.statusGenerating') : t('scopeSummary.generating') }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="summary"
            class="text-[11px] bg-transparent border-none cursor-pointer px-0"
            :style="{ color: accentColor }"
            @click="openHistory"
          >
            {{ t('common.viewHistory') }}
          </button>
          <button
            class="px-2.5 py-1 rounded-md text-[11px] border transition-colors"
            :class="isGeneratingState ? 'opacity-70 cursor-wait' : ''"
            :style="{ borderColor: `${accentColor}55`, color: accentColor, backgroundColor: `${accentColor}10` }"
            :disabled="isGeneratingState"
            @click="() => generateSummary('manual')"
          >
            {{ isGeneratingState ? t('scopeSummary.generating') : t('scopeSummary.generate') }}
          </button>
        </div>
      </div>

      <div v-if="status === 'empty'" class="px-4 py-8 text-center">
        <div class="text-[13px] font-semibold c-[var(--text-primary)]">{{ t('scopeSummary.emptyTitle') }}</div>
        <div class="mt-1 text-[12px] c-[var(--text-secondary)]">{{ t('scopeSummary.emptyHint') }}</div>
        <div v-if="suggestedWindows.length" class="mt-3 flex justify-center gap-2 flex-wrap">
          <button
            v-for="candidate in suggestedWindows"
            :key="candidate"
            class="px-2.5 py-1 rounded-md text-[11px] border border-[var(--border-color)] bg-[var(--bg-base)] c-[var(--text-secondary)] hover:c-[var(--text-primary)]"
            @click="switchWindow(candidate)"
          >
            {{ t(`scopeSummary.windows.${candidate}`) }}
          </button>
        </div>
      </div>

      <div v-else-if="status === 'idle' && !summary" class="px-4 py-8 text-center">
        <div class="text-[13px] font-semibold c-[var(--text-primary)]">{{ t('scopeSummary.idleTitle') }}</div>
        <div class="mt-1 text-[12px] c-[var(--text-secondary)]">{{ t('scopeSummary.idleHint') }}</div>
      </div>

      <div v-else-if="status === 'failed' && !summary" class="px-4 py-8 text-center">
        <div class="text-[13px] font-semibold c-[var(--text-primary)]">{{ t('scopeSummary.failedTitle') }}</div>
        <div class="mt-1 text-[12px] c-[var(--text-secondary)]">{{ t('scopeSummary.failedHint') }}</div>
      </div>

      <div v-else-if="summary?.summary" class="px-4 py-3">
        <div v-if="status === 'stale'" class="mb-3 px-3 py-2 rounded-lg border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] text-[11px] c-[#b45309]">
          {{ t('scopeSummary.staleBanner') }}
        </div>
        <MarkdownContent
          :content="processedSummary()"
          :render-math="true"
          class="scope-summary-body text-[13px] leading-6 c-[var(--text-primary)]"
          :class="!expandedSummary ? 'line-clamp-[14]' : ''"
          @click="handleSummaryClick"
        />
        <button
          v-if="shouldShowSummaryToggle(summary.summary)"
          class="mt-2 text-[11px] bg-transparent border-none cursor-pointer px-0"
          :style="{ color: accentColor }"
          @click="expandedSummary = !expandedSummary"
        >
          {{ expandedSummary ? t('tags.digestCollapse') : t('tags.digestExpand') }}
        </button>

        <div v-if="summary.citations?.length" class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="citation in resolveCitationEntries(summary.citations, entries)"
            :key="`${citation.ref}-${citation.entry?.id || 'missing'}`"
            class="px-2 py-1 rounded-md text-[11px] border border-[var(--border-color)] bg-[var(--bg-base)] c-[var(--text-secondary)] hover:c-[var(--text-primary)]"
            @click="citation.entry && emit('select-entry', citation.entry.id)"
          >
            [{{ citation.ref }}] {{ citation.entry?.title || t('scopeSummary.sourceMissing') }}
          </button>
        </div>

        <div v-if="summary.keywords?.length" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="kw in summary.keywords"
            :key="kw"
            class="px-2 py-1 rounded-full text-[11px] bg-[var(--bg-base)] c-[var(--text-secondary)] border border-[var(--border-color)]"
          >
            {{ kw }}
          </span>
        </div>
      </div>

      <div v-if="showHistory" class="px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-base)]">
        <div class="mb-3 text-[12px] font-semibold c-[var(--text-primary)]">{{ t('scopeSummary.historyTitle') }}</div>
        <div class="space-y-3">
          <div
            v-for="item in historyItems"
            :key="item.id || item.created_at"
            class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3"
          >
            <div class="text-[11px] c-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
              <span>{{ formatDate(item.summary_updated_at || item.updated_at || item.created_at || '') }}</span>
              <span>{{ item.trigger_type === 'manual' ? t('tags.digestManual') : t('tags.digestAuto') }}</span>
              <span v-if="item.model_name">{{ item.model_name }}</span>
            </div>
            <MarkdownContent
              :content="item.summary_md || item.summary || ''"
              :render-math="true"
              class="scope-summary-history-body mt-2 text-[12px] leading-6 c-[var(--text-primary)] line-clamp-[8]"
            />
          </div>
        </div>
        <div v-if="historyHasMore" class="mt-3 text-center">
          <button
            class="px-3 py-1.5 rounded-md text-[11px] border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-secondary)] hover:c-[var(--text-primary)]"
            :disabled="historyLoading"
            @click="loadHistory(false)"
          >
            {{ historyLoading ? t('common.loading') : t('common.loadMore') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scope-summary-body :deep(h2) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  padding-left: 0.5rem;
  border-left: 3px solid color-mix(in srgb, var(--accent) 60%, transparent);
  font-size: 0.98rem;
  font-weight: 700;
}

.scope-summary-body :deep(h3) {
  margin-top: 0.8rem;
  margin-bottom: 0.4rem;
  font-size: 0.92rem;
  font-weight: 650;
  color: var(--text-secondary);
}

.scope-summary-body :deep(p) {
  text-wrap: pretty;
}

.scope-summary-body :deep(li) {
  line-height: 1.65;
}

.scope-summary-body :deep(blockquote) {
  font-size: 0.85rem;
}

.scope-summary-body :deep(.entry-ref) {
  display: inline-block;
  padding: 0 0.25rem;
  margin: 0 0.125rem;
  color: var(--accent);
  font-weight: 500;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.scope-summary-body :deep(.entry-ref sup) {
  font-size: 0.65em;
  font-weight: 600;
  margin-left: 0.15rem;
  opacity: 0.75;
  vertical-align: super;
}

.scope-summary-body :deep(.entry-ref:hover) {
  background-color: color-mix(in srgb, var(--accent) 10%, transparent);
}

.scope-summary-history-body :deep(h2),
.scope-summary-history-body :deep(h3),
.scope-summary-history-body :deep(h4) {
  font-size: 0.86rem;
}
</style>
