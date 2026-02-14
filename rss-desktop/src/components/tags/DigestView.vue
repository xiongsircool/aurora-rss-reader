<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'
import { formatDate } from '../../utils/date'

const emit = defineEmits<{
  (e: 'select-entry', entryId: string): void
  (e: 'select-tag', tagId: string): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const period = ref<'today' | 'week'>('today')
const digestData = ref<Array<{
  tag: { id: string; name: string; color: string; entry_count: number }
  recentCount: number
  llm_summary: string | null
  keywords: string[]
  summary_updated_at: string | null
  entries: Array<{ id: string; title: string; url: string; published_at: string; summary: string | null; feed_title: string }>
}>>([])
const loading = ref(false)
const expandedHistory = ref<Set<string>>(new Set())
const historyByTag = ref<Record<string, Array<{ id: string; summary: string; keywords: string[]; created_at: string; source_count: number; model_name: string }>>>({})
const historyCursorByTag = ref<Record<string, string | null>>({})
const historyHasMoreByTag = ref<Record<string, boolean>>({})
const historyLoadingByTag = ref<Record<string, boolean>>({})

async function loadDigest() {
  loading.value = true
  try {
    const data = await tagsStore.fetchDigest(period.value)
    digestData.value = data.items || []
  } finally {
    loading.value = false
  }
}

onMounted(() => loadDigest())

function switchPeriod(p: 'today' | 'week') {
  period.value = p
  expandedHistory.value = new Set()
  historyByTag.value = {}
  historyCursorByTag.value = {}
  historyHasMoreByTag.value = {}
  historyLoadingByTag.value = {}
  loadDigest()
}

async function toggleHistory(tagId: string) {
  if (expandedHistory.value.has(tagId)) {
    expandedHistory.value.delete(tagId)
    expandedHistory.value = new Set(expandedHistory.value)
    return
  }
  expandedHistory.value.add(tagId)
  expandedHistory.value = new Set(expandedHistory.value)
  if (!historyByTag.value[tagId]) {
    await loadHistory(tagId, true)
  }
}

async function loadHistory(tagId: string, reset = false) {
  if (historyLoadingByTag.value[tagId]) return
  historyLoadingByTag.value[tagId] = true
  try {
    const cursor = reset ? undefined : (historyCursorByTag.value[tagId] || undefined)
    const data = await tagsStore.fetchDigestHistory(tagId, period.value, 10, cursor)
    historyByTag.value[tagId] = reset
      ? data.items
      : [...(historyByTag.value[tagId] || []), ...data.items]
    historyCursorByTag.value[tagId] = data.nextCursor
    historyHasMoreByTag.value[tagId] = data.hasMore
  } finally {
    historyLoadingByTag.value[tagId] = false
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
          @click="switchPeriod('today')"
          class="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
          :class="period === 'today'
            ? 'bg-[var(--bg-surface)] c-[var(--text-primary)] shadow-sm'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.digestToday') }}
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
          <p class="text-[12px] leading-5 c-[var(--text-primary)] m-0">{{ item.llm_summary }}</p>
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
              @click.stop="toggleHistory(item.tag.id)"
            >
              {{ expandedHistory.has(item.tag.id) ? t('common.close') : t('common.viewHistory') }}
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

        <div
          v-if="expandedHistory.has(item.tag.id)"
          class="border-t border-[var(--border-color)] px-4 py-3 bg-[rgba(139,92,246,0.04)]"
        >
          <div v-if="historyLoadingByTag[item.tag.id]" class="text-[11px] c-[var(--text-tertiary)]">
            Loading...
          </div>
          <div v-else-if="(historyByTag[item.tag.id] || []).length === 0" class="text-[11px] c-[var(--text-tertiary)]">
            {{ t('common.noData') }}
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="h in historyByTag[item.tag.id]"
              :key="h.id"
              class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2"
            >
              <div class="text-[10px] c-[var(--text-tertiary)] mb-1">
                {{ formatDate(h.created_at, null) }} · {{ h.source_count }}
              </div>
              <div class="text-[11px] c-[var(--text-primary)] leading-4">{{ h.summary }}</div>
            </div>
            <button
              v-if="historyHasMoreByTag[item.tag.id]"
              class="w-full py-1.5 rounded-md border border-[var(--border-color)] text-[11px] c-[var(--text-secondary)] bg-[var(--bg-surface)] hover:c-[var(--text-primary)]"
              @click="loadHistory(item.tag.id)"
            >
              {{ t('common.loadMore') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="py-8 text-center">
      <p class="text-[13px] c-[var(--text-tertiary)]">{{ t('tags.digestEmpty') }}</p>
    </div>
  </div>
</template>
