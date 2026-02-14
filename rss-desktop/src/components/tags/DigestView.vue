<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'
import { formatDate } from '../../utils/date'

const emit = defineEmits<{
  (e: 'select-entry', entryId: string): void
  (e: 'select-tag', tagId: string): void
}>()

const { t, locale } = useI18n()
const tagsStore = useTagsStore()

const period = ref<'latest' | 'week'>('latest')
const digestData = ref<Array<{
  tag: { id: string; name: string; color: string; entry_count: number }
  recentCount: number
  llm_summary: string | null
  keywords: string[]
  summary_updated_at: string | null
  time_range_key: string
  unsummarized_count?: number
  entries: Array<{ id: string; title: string; url: string; published_at: string; summary: string | null; feed_title: string }>
}>>([])
const loading = ref(false)
const expandedSummary = ref<Set<string>>(new Set())
const expandedHistorySummary = ref<Set<string>>(new Set())
const historyByTag = ref<Record<string, Array<{ id: string; period: 'latest' | 'week'; summary: string; keywords: string[]; created_at: string; source_count: number; model_name: string; time_range_key: string; trigger_type: string }>>>({})
const historyCursorByTag = ref<Record<string, string | null>>({})
const historyHasMoreByTag = ref<Record<string, boolean>>({})
const historyLoadingByTag = ref<Record<string, boolean>>({})
const regeneratingByTag = ref<Record<string, boolean>>({})
const historyModalTagId = ref<string | null>(null)
const historyModalTagName = ref('')
const historyModalTagColor = ref('#8b5cf6')

async function loadDigest() {
  loading.value = true
  try {
    const data = await tagsStore.fetchDigest(period.value, locale.value)
    digestData.value = data.items || []
  } finally {
    loading.value = false
  }
}

onMounted(() => loadDigest())
watch(() => locale.value, () => {
  loadDigest()
  if (historyModalTagId.value) {
    loadHistory(historyModalTagId.value, true)
  }
})

function isSummaryExpanded(tagId: string) {
  return expandedSummary.value.has(tagId)
}

function toggleSummary(tagId: string) {
  if (expandedSummary.value.has(tagId)) {
    expandedSummary.value.delete(tagId)
  } else {
    expandedSummary.value.add(tagId)
  }
  expandedSummary.value = new Set(expandedSummary.value)
}

function shouldShowSummaryToggle(summary: string | null) {
  return !!summary && summary.length > 120
}

function formatRange(periodValue: 'latest' | 'week', rangeKey?: string | null) {
  if (!rangeKey) return periodValue === 'week' ? t('tags.digestWeek') : t('tags.digestLatest')
  return periodValue === 'week'
    ? `${t('tags.digestWeek')} (${rangeKey})`
    : t('tags.digestLatest')
}

function isHistorySummaryExpanded(itemId: string) {
  return expandedHistorySummary.value.has(itemId)
}

function toggleHistorySummary(itemId: string) {
  if (expandedHistorySummary.value.has(itemId)) expandedHistorySummary.value.delete(itemId)
  else expandedHistorySummary.value.add(itemId)
  expandedHistorySummary.value = new Set(expandedHistorySummary.value)
}

function switchPeriod(p: 'latest' | 'week') {
  period.value = p
  expandedSummary.value = new Set()
  expandedHistorySummary.value = new Set()
  historyModalTagId.value = null
  historyByTag.value = {}
  historyCursorByTag.value = {}
  historyHasMoreByTag.value = {}
  historyLoadingByTag.value = {}
  loadDigest()
}

async function openHistory(tagId: string) {
  const tag = digestData.value.find((item) => item.tag.id === tagId)?.tag
  historyModalTagId.value = tagId
  historyModalTagName.value = tag?.name || ''
  historyModalTagColor.value = tag?.color || '#8b5cf6'
  await loadHistory(tagId, true)
}

function closeHistoryModal() {
  historyModalTagId.value = null
}

async function loadHistory(tagId: string, reset = false) {
  if (historyLoadingByTag.value[tagId]) return
  historyLoadingByTag.value[tagId] = true
  try {
    const cursor = reset ? undefined : (historyCursorByTag.value[tagId] || undefined)
    const data = await tagsStore.fetchDigestHistory(tagId, period.value, 10, cursor, locale.value)
    historyByTag.value[tagId] = reset
      ? data.items
      : [...(historyByTag.value[tagId] || []), ...data.items]
    historyCursorByTag.value[tagId] = data.nextCursor
    historyHasMoreByTag.value[tagId] = data.hasMore
  } finally {
    historyLoadingByTag.value[tagId] = false
  }
}

async function regenerateSummary(tagId: string) {
  if (regeneratingByTag.value[tagId]) return
  regeneratingByTag.value[tagId] = true
  try {
    const result = await tagsStore.regenerateDigestSummary(tagId, period.value, locale.value)
    if (!result) return
    const idx = digestData.value.findIndex((item) => item.tag.id === tagId)
    if (idx >= 0) {
      digestData.value[idx] = {
        ...digestData.value[idx],
        llm_summary: result.summary,
        keywords: result.keywords || [],
        summary_updated_at: result.summary_updated_at,
        time_range_key: result.time_range_key || digestData.value[idx].time_range_key,
      }
    }
    if (historyModalTagId.value === tagId) {
      await loadHistory(tagId, true)
    }
  } finally {
    regeneratingByTag.value[tagId] = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-4.5 h-4.5 c-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span class="text-[14px] font-bold c-[var(--text-primary)]">{{ t('tags.digest') }}</span>
      </div>
      <div class="flex items-center gap-1 bg-[var(--bg-base)] rounded-lg p-0.5 border border-[var(--border-color)]">
        <button
          @click="switchPeriod('latest')"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="period === 'latest'
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.digestLatest') }}
        </button>
        <button
          @click="switchPeriod('week')"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="period === 'week'
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.digestWeek') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-8 text-center">
      <div class="inline-block animate-spin w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full"></div>
    </div>

    <!-- Digest Cards -->
    <div v-else-if="digestData.length > 0" class="space-y-3">
      <div
        v-for="item in digestData"
        :key="item.tag.id"
        class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden"
      >
        <!-- Tag header -->
        <button
          @click="emit('select-tag', item.tag.id)"
          class="w-full flex items-center gap-2.5 px-4 py-2.5 bg-transparent border-none cursor-pointer text-left hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors"
        >
          <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.tag.color }"></span>
          <span class="flex-1 text-[13px] font-semibold c-[var(--text-primary)]">{{ item.tag.name }}</span>
          <span
            class="text-[11px] px-2 py-0.5 rounded-full font-medium"
            :style="{ backgroundColor: item.tag.color + '18', color: item.tag.color }"
          >
            {{ t('tags.digestNewArticles', { count: item.recentCount }) }}
          </span>
        </button>

        <div v-if="item.llm_summary" class="px-4 pb-3">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-[10px] c-[var(--text-tertiary)]">
                {{ formatRange(period, item.time_range_key) }}
              </span>
              <span
                v-if="(item.unsummarized_count || 0) > 0"
                class="text-[10px] px-1.5 py-0.5 rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.10)] c-[#b45309]"
              >
                {{ t('tags.digestUnsummarized', { count: item.unsummarized_count || 0 }) }}
              </span>
            </div>
            <button
              class="text-[11px] c-[#8b5cf6] hover:underline bg-transparent border-none cursor-pointer"
              :disabled="!!regeneratingByTag[item.tag.id]"
              @click.stop="regenerateSummary(item.tag.id)"
            >
              {{ regeneratingByTag[item.tag.id] ? t('tags.digestRegenerating') : t('tags.digestRegenerate') }}
            </button>
          </div>
          <p
            class="text-[12px] leading-5 c-[var(--text-primary)] m-0 whitespace-pre-line"
            :style="isSummaryExpanded(item.tag.id)
              ? {}
              : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
          >
            {{ item.llm_summary }}
          </p>
          <button
            v-if="shouldShowSummaryToggle(item.llm_summary)"
            class="mt-1 text-[11px] c-[#8b5cf6] hover:underline bg-transparent border-none cursor-pointer px-0"
            @click.stop="toggleSummary(item.tag.id)"
          >
            {{ isSummaryExpanded(item.tag.id) ? t('tags.digestCollapse') : t('tags.digestExpand') }}
          </button>
          <div v-if="item.keywords?.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="kw in item.keywords"
              :key="kw"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.12)] c-[#7c3aed]"
            >
              {{ kw }}
            </span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-[10px] c-[var(--text-tertiary)]">
              {{ item.summary_updated_at ? formatDate(item.summary_updated_at, null) : '' }}
            </span>
            <button
              class="text-[11px] c-[#8b5cf6] hover:underline bg-transparent border-none cursor-pointer"
              @click.stop="openHistory(item.tag.id)"
            >
              {{ t('common.viewHistory') }}
            </button>
          </div>
        </div>

        <!-- Entry list -->
        <div class="border-t border-[var(--border-color)]">
          <button
            v-for="(entry, ei) in item.entries"
            :key="entry.id"
            @click="emit('select-entry', entry.id)"
            class="w-full flex items-start gap-2 px-4 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            :class="{ 'border-t border-[var(--border-color)]': ei > 0 }"
          >
            <span class="text-[11px] c-[var(--text-tertiary)] mt-0.5 shrink-0 tabular-nums w-4 text-right">{{ ei + 1 }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-[12px] font-medium c-[var(--text-primary)] line-clamp-1">{{ entry.title }}</div>
              <div class="text-[10px] c-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
                <span>{{ entry.feed_title }}</span>
                <span v-if="entry.published_at">{{ formatDate(entry.published_at, null) }}</span>
              </div>
            </div>
          </button>
          <div
            v-if="item.recentCount > item.entries.length"
            class="px-4 py-1.5 text-[10px] c-[var(--text-tertiary)] border-t border-[var(--border-color)]"
          >
            +{{ item.recentCount - item.entries.length }} more...
          </div>
        </div>

      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="py-8 text-center">
      <p class="text-[13px] c-[var(--text-tertiary)]">{{ t('tags.digestEmpty') }}</p>
    </div>

    <Teleport to="body">
      <div
        v-if="historyModalTagId"
        class="fixed inset-0 z-[12000] flex items-center justify-center p-4"
        @keydown.esc="closeHistoryModal"
      >
        <div class="absolute inset-0 bg-black/45" @click="closeHistoryModal"></div>
        <div class="relative w-[min(920px,96vw)] max-h-[86vh] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: historyModalTagColor }"></span>
              <span class="text-[13px] font-semibold c-[var(--text-primary)]">{{ historyModalTagName }} · {{ t('common.viewHistory') }}</span>
            </div>
            <button class="text-[11px] c-[var(--text-secondary)] hover:c-[var(--text-primary)] bg-transparent border-none cursor-pointer" @click="closeHistoryModal">
              {{ t('common.close') }}
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[calc(86vh-56px)] bg-[var(--bg-base)]">
            <div v-if="historyLoadingByTag[historyModalTagId]" class="text-[12px] c-[var(--text-tertiary)]">
              Loading...
            </div>
            <div v-else-if="(historyByTag[historyModalTagId] || []).length === 0" class="text-[12px] c-[var(--text-tertiary)]">
              {{ t('common.noData') }}
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="h in historyByTag[historyModalTagId]"
                :key="h.id"
                class="relative rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 pl-4"
              >
                <span class="absolute left-1.5 top-3 h-1.5 w-1.5 rounded-full bg-[#8b5cf6]"></span>
                <div class="text-[10px] c-[var(--text-tertiary)] mb-1 flex flex-wrap items-center gap-1.5">
                  <span>{{ formatDate(h.created_at, null) }}</span>
                  <span>·</span>
                  <span>{{ formatRange(h.period, h.time_range_key) }}</span>
                  <span>·</span>
                  <span>{{ h.source_count }}</span>
                  <span>·</span>
                  <span>{{ h.trigger_type === 'manual' ? t('tags.digestManual') : t('tags.digestAuto') }}</span>
                </div>
                <div
                  class="text-[12px] c-[var(--text-primary)] leading-5 whitespace-pre-line"
                  :style="isHistorySummaryExpanded(h.id)
                    ? {}
                    : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
                >
                  {{ h.summary }}
                </div>
                <button
                  v-if="shouldShowSummaryToggle(h.summary)"
                  class="mt-1 text-[10px] c-[#8b5cf6] hover:underline bg-transparent border-none cursor-pointer px-0"
                  @click.stop="toggleHistorySummary(h.id)"
                >
                  {{ isHistorySummaryExpanded(h.id) ? t('tags.digestCollapse') : t('tags.digestExpand') }}
                </button>
                <div v-if="h.keywords?.length" class="mt-1.5 flex flex-wrap gap-1">
                  <span
                    v-for="kw in h.keywords"
                    :key="`${h.id}-${kw}`"
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] c-[#7c3aed]"
                  >
                    {{ kw }}
                  </span>
                </div>
              </div>
              <button
                v-if="historyHasMoreByTag[historyModalTagId]"
                class="w-full py-1.5 rounded-md border border-[var(--border-color)] text-[11px] c-[var(--text-secondary)] bg-[var(--bg-surface)] hover:c-[var(--text-primary)]"
                @click="loadHistory(historyModalTagId)"
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
