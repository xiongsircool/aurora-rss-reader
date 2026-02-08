<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore, type UserTag, type RerunSummary } from '../../stores/tagsStore'
import { useFeedStore } from '../../stores/feedStore'
import FeedScopeModal from './FeedScopeModal.vue'

const { t } = useI18n()
const tagsStore = useTagsStore()
const feedStore = useFeedStore()

const showCreateModal = ref(false)
const showConfigPanel = ref(false)
const showRerunModal = ref(false)
const showFeedScopeModal = ref(false)
const editingTag = ref<UserTag | null>(null)

// Form state
const tagName = ref('')
const tagDescription = ref('')
const tagColor = ref('#3b82f6')

// Range rerun state
const rerunFrom = ref('')
const rerunTo = ref('')
const rerunMode = ref<'all' | 'missing'>('all')
const rerunLimit = ref(50)
const rerunRunning = ref(false)
const rerunError = ref('')
const rerunCursor = ref<string | null>(null)
const rerunHasMore = ref(false)
const rerunTotals = ref<RerunSummary>({ total: 0, success: 0, tagged: 0, untagged: 0 })
const rerunLastSummary = ref<RerunSummary | null>(null)
const feedSearch = ref('')
const selectedFeedIds = ref<Set<string>>(new Set())

const colors = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
]

onMounted(async () => {
  await tagsStore.fetchTags()
  await tagsStore.fetchStats()
  await tagsStore.fetchConfig()
  if (feedStore.feeds.length === 0) {
    await feedStore.fetchFeeds()
  }
})

const filteredFeeds = computed(() => {
  const keyword = feedSearch.value.trim().toLowerCase()
  if (!keyword) return feedStore.feeds
  return feedStore.feeds.filter((feed) => {
    const label = (feed.custom_title || feed.title || feed.url || '').toLowerCase()
    return label.includes(keyword)
  })
})

const taggingEnabledCount = computed(() =>
  feedStore.feeds.filter((feed) => feed.ai_tagging_enabled !== 0).length
)

function openCreateModal(tag?: UserTag) {
  editingTag.value = tag || null
  tagName.value = tag?.name || ''
  tagDescription.value = tag?.description || ''
  tagColor.value = tag?.color || '#3b82f6'
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
  editingTag.value = null
  tagName.value = ''
  tagDescription.value = ''
  tagColor.value = '#3b82f6'
}

async function saveTag() {
  if (!tagName.value.trim()) return
  
  try {
    if (editingTag.value) {
      await tagsStore.updateTag(editingTag.value.id, {
        name: tagName.value.trim(),
        description: tagDescription.value.trim() || undefined,
        color: tagColor.value,
      })
    } else {
      await tagsStore.createTag({
        name: tagName.value.trim(),
        description: tagDescription.value.trim() || undefined,
        color: tagColor.value,
      })
    }
    closeCreateModal()
  } catch (error) {
    console.error('Failed to save tag:', error)
  }
}

async function handleDeleteTag(tag: UserTag) {
  if (confirm(t('tags.confirmDelete', { name: tag.name }))) {
    await tagsStore.deleteTag(tag.id)
  }
}

function selectTag(tagId: string) {
  tagsStore.selectTag(tagId)
}

function selectView(view: 'pending' | 'untagged') {
  tagsStore.setView(view)
}

function openRerunModal() {
  rerunError.value = ''
  rerunCursor.value = null
  rerunHasMore.value = false
  rerunTotals.value = { total: 0, success: 0, tagged: 0, untagged: 0 }
  rerunLastSummary.value = null

  if (!rerunFrom.value || !rerunTo.value) {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    rerunFrom.value = formatDateTimeLocal(sevenDaysAgo)
    rerunTo.value = formatDateTimeLocal(now)
  }

  if (feedStore.feeds.length === 0) {
    feedStore.fetchFeeds().catch(() => {})
  }

  showRerunModal.value = true
}

function closeRerunModal() {
  showRerunModal.value = false
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function toggleFeedSelection(feedId: string) {
  const next = new Set(selectedFeedIds.value)
  if (next.has(feedId)) {
    next.delete(feedId)
  } else {
    next.add(feedId)
  }
  selectedFeedIds.value = next
}

function clearFeedSelection() {
  selectedFeedIds.value = new Set()
}

function toggleAllFilteredFeeds() {
  const targetFeeds = filteredFeeds.value
  const next = new Set(selectedFeedIds.value)
  const allSelected = targetFeeds.length > 0 && targetFeeds.every(f => next.has(f.id))
  if (allSelected) {
    targetFeeds.forEach(f => next.delete(f.id))
    selectedFeedIds.value = next
    return
  }
  targetFeeds.forEach(f => next.add(f.id))
  selectedFeedIds.value = next
}

async function runRangeRerun(continueRun = false) {
  rerunError.value = ''
  if (!rerunFrom.value || !rerunTo.value) {
    rerunError.value = t('tags.rerunErrorTime')
    return
  }

  const fromTime = Date.parse(rerunFrom.value)
  const toTime = Date.parse(rerunTo.value)
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
    rerunError.value = t('tags.rerunErrorTime')
    return
  }

  const fromIso = new Date(fromTime).toISOString()
  const toIso = new Date(toTime).toISOString()
  if (fromTime > toTime) {
    rerunError.value = t('tags.rerunErrorRange')
    return
  }

  rerunRunning.value = true
  try {
    if (!continueRun) {
      rerunCursor.value = null
      rerunHasMore.value = false
      rerunTotals.value = { total: 0, success: 0, tagged: 0, untagged: 0 }
      rerunLastSummary.value = null
    }

    const feedIds = Array.from(selectedFeedIds.value)
    const result = await tagsStore.rerunRange({
      from: fromIso,
      to: toIso,
      feedIds: feedIds.length > 0 ? feedIds : undefined,
      mode: rerunMode.value,
      limit: rerunLimit.value,
      cursor: continueRun ? rerunCursor.value : undefined,
    })

    rerunLastSummary.value = result.summary
    rerunTotals.value = {
      total: rerunTotals.value.total + result.summary.total,
      success: rerunTotals.value.success + result.summary.success,
      tagged: rerunTotals.value.tagged + result.summary.tagged,
      untagged: rerunTotals.value.untagged + result.summary.untagged,
    }
    rerunCursor.value = result.nextCursor
    rerunHasMore.value = result.hasMore
  } catch (error) {
    rerunError.value = error instanceof Error ? error.message : t('common.error')
  } finally {
    rerunRunning.value = false
  }
}

async function handleAnalyzeAll() {
  if (tagsStore.stats.pending === 0) return
  // Load pending entries first
  await tagsStore.fetchPendingEntries(true)
  const entryIds = tagsStore.entries.map(e => e.id)
  if (entryIds.length > 0) {
    await tagsStore.analyzeEntries(entryIds)
    tagsStore.setView('pending')
    await tagsStore.fetchPendingEntries(true)
  }
}
</script>

<template>
  <div class="h-full flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]">
    <!-- Header -->
    <div class="p-4 border-b border-[var(--border-color)]">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-[15px] font-semibold">{{ t('workspace.tags') }}</h2>
        <div class="flex gap-1">
          <button
            @click="showConfigPanel = !showConfigPanel"
            class="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
            :class="showConfigPanel ? 'bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.08)]' : ''"
            :title="t('tags.settings')"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
          <button
            @click="openCreateModal()"
            class="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
            :title="t('tags.create')"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Stats Card -->
      <div class="rounded-lg bg-[var(--bg-base)] p-3 text-[13px]">
        <div class="flex justify-between items-center mb-2">
          <span class="c-[var(--text-secondary)]">{{ t('tags.pendingCount') }}</span>
          <span class="font-medium">{{ tagsStore.stats.pending }}</span>
        </div>
        <button
          @click="handleAnalyzeAll"
          :disabled="tagsStore.stats.pending === 0 || tagsStore.analyzing || tagsStore.tags.length === 0"
          class="w-full py-2 rounded-md bg-[var(--accent)] c-white text-[13px] font-medium transition-opacity"
          :class="tagsStore.stats.pending === 0 || tagsStore.analyzing || tagsStore.tags.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'"
        >
          {{ tagsStore.analyzing ? t('tags.analyzing') : t('tags.analyzeAll') }}
        </button>
      </div>

      <div v-if="showConfigPanel" class="mt-3 rounded-lg bg-[var(--bg-base)] p-3 text-[12px] space-y-3">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[12px] font-semibold c-[var(--text-primary)]">{{ t('tags.taggingScope') }}</span>
            <span class="text-[11px] c-[var(--text-tertiary)]">
              {{ t('tags.taggingEnabledCount', { enabled: taggingEnabledCount, total: feedStore.feeds.length }) }}
            </span>
          </div>
          <button
            @click="showFeedScopeModal = true"
            class="mt-2 w-full py-2.5 rounded-md border border-[var(--border-color)] text-[13px] font-medium hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v18M3 12h18"/>
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            {{ t('tags.configureFeedScope') }}
          </button>
        </div>

        <div class="pt-2 border-t border-[var(--border-color)]">
          <p class="c-[var(--text-secondary)] mb-2">
            {{ t('tags.rangeRerunNote') }}
          </p>
          <button
            @click="openRerunModal"
            class="w-full py-2 rounded-md border border-[var(--border-color)] text-[13px] font-medium hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
          >
            {{ t('tags.rangeRerun') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Tag List -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- My Tags Section -->
      <div class="mb-4">
        <div class="px-2 py-1.5 text-[11px] font-medium c-[var(--text-tertiary)] uppercase tracking-wider">
          {{ t('tags.myTags') }}
        </div>
        <div class="space-y-0.5">
          <button
            v-for="tag in tagsStore.tags"
            :key="tag.id"
            @click="selectTag(tag.id)"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-[13px] transition-colors group"
            :class="tagsStore.selectedTagId === tag.id
              ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]'
              : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: tag.color }"></span>
            <span class="flex-1 truncate">{{ tag.name }}</span>
            <span class="text-[11px] c-[var(--text-tertiary)]">{{ tag.entry_count || 0 }}</span>
            <div class="hidden group-hover:flex gap-0.5">
              <button
                @click.stop="openCreateModal(tag)"
                class="p-1 rounded hover:bg-[rgba(0,0,0,0.1)]"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click.stop="handleDeleteTag(tag)"
                class="p-1 rounded hover:bg-[rgba(255,0,0,0.1)] c-red-500"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </button>

          <!-- Empty State -->
          <div v-if="tagsStore.tags.length === 0" class="px-3 py-6 text-center c-[var(--text-tertiary)] text-[13px]">
            <p class="mb-2">{{ t('tags.noTags') }}</p>
            <button
              @click="openCreateModal()"
              class="text-[var(--accent)] hover:underline"
            >
              {{ t('tags.createFirst') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Special Views -->
      <div>
        <div class="px-2 py-1.5 text-[11px] font-medium c-[var(--text-tertiary)] uppercase tracking-wider">
          {{ t('tags.views') }}
        </div>
        <div class="space-y-0.5">
          <button
            @click="selectView('pending')"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-[13px] transition-colors"
            :class="tagsStore.selectedView === 'pending' && !tagsStore.selectedTagId
              ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]'
              : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="flex-1">{{ t('tags.pending') }}</span>
            <span class="text-[11px] c-[var(--text-tertiary)]">{{ tagsStore.stats.pending }}</span>
          </button>
          <button
            @click="selectView('untagged')"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-[13px] transition-colors"
            :class="tagsStore.selectedView === 'untagged' && !tagsStore.selectedTagId
              ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)]'
              : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8"/>
            </svg>
            <span class="flex-1">{{ t('tags.untagged') }}</span>
            <span class="text-[11px] c-[var(--text-tertiary)]">{{ tagsStore.stats.withoutTags }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-[var(--bg-surface)] rounded-xl shadow-xl w-[400px] max-w-[90vw]">
          <div class="p-4 border-b border-[var(--border-color)]">
            <h3 class="text-[15px] font-semibold">
              {{ editingTag ? t('tags.edit') : t('tags.create') }}
            </h3>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.name') }}</label>
              <input
                v-model="tagName"
                type="text"
                class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
                :placeholder="t('tags.namePlaceholder')"
              />
            </div>
            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.description') }}</label>
              <textarea
                v-model="tagDescription"
                rows="3"
                class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)] resize-none"
                :placeholder="t('tags.descriptionPlaceholder')"
              ></textarea>
              <p class="mt-1 text-[11px] c-[var(--text-tertiary)]">{{ t('tags.descriptionHint') }}</p>
            </div>
            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.color') }}</label>
              <div class="flex gap-2">
                <button
                  v-for="color in colors"
                  :key="color"
                  @click="tagColor = color"
                  class="w-7 h-7 rounded-full ring-2 ring-offset-2 ring-offset-[var(--bg-surface)] transition-all"
                  :class="tagColor === color ? 'ring-[var(--accent)]' : 'ring-transparent'"
                  :style="{ backgroundColor: color }"
                ></button>
              </div>
            </div>
          </div>
          <div class="p-4 border-t border-[var(--border-color)] flex justify-end gap-2">
            <button
              @click="closeCreateModal"
              class="px-4 py-2 rounded-lg text-[13px] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              @click="saveTag"
              :disabled="!tagName.trim()"
              class="px-4 py-2 rounded-lg text-[13px] bg-[var(--accent)] c-white"
              :class="tagName.trim() ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'"
            >
              {{ t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Range Rerun Modal -->
    <Teleport to="body">
      <div v-if="showRerunModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-[var(--bg-surface)] rounded-xl shadow-xl w-[520px] max-w-[92vw]">
          <div class="p-4 border-b border-[var(--border-color)]">
            <h3 class="text-[15px] font-semibold">
              {{ t('tags.rangeRerun') }}
            </h3>
          </div>

          <div class="p-4 space-y-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.rerunFrom') }}</label>
                <input
                  v-model="rerunFrom"
                  type="datetime-local"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.rerunTo') }}</label>
                <input
                  v-model="rerunTo"
                  type="datetime-local"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.rerunMode') }}</label>
              <div class="flex flex-col gap-2 text-[13px]">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="rerunMode" type="radio" value="all" />
                  {{ t('tags.rerunModeAll') }}
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="rerunMode" type="radio" value="missing" />
                  {{ t('tags.rerunModeMissing') }}
                </label>
              </div>
            </div>

            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.rerunFeeds') }}</label>
              <div class="flex flex-wrap items-center gap-2">
                <input
                  v-model="feedSearch"
                  type="text"
                  class="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
                  :placeholder="t('tags.rerunFeedSearch')"
                />
                <button
                  type="button"
                  @click="toggleAllFilteredFeeds"
                  class="px-3 py-2 rounded-lg border border-[var(--border-color)] text-[12px] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
                >
                  {{ t('common.selectAll') }}
                </button>
                <button
                  type="button"
                  @click="clearFeedSelection"
                  class="px-3 py-2 rounded-lg border border-[var(--border-color)] text-[12px] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
                >
                  {{ t('tags.clearSelection') }}
                </button>
              </div>
              <div class="mt-2 max-h-[160px] overflow-y-auto border border-[var(--border-color)] rounded-lg bg-[var(--bg-base)]">
                <div v-if="filteredFeeds.length === 0" class="px-3 py-3 text-[12px] c-[var(--text-tertiary)]">
                  {{ t('tags.noFeedsMatch') }}
                </div>
                <label
                  v-for="feed in filteredFeeds"
                  :key="feed.id"
                  class="flex items-center gap-2 px-3 py-2 text-[13px] border-b border-[var(--border-color)] last:border-b-0 cursor-pointer hover:bg-[rgba(0,0,0,0.02)]"
                >
                  <input
                    type="checkbox"
                    :checked="selectedFeedIds.has(feed.id)"
                    @change="toggleFeedSelection(feed.id)"
                  />
                  <span class="truncate">{{ feed.custom_title || feed.title || feed.url }}</span>
                </label>
              </div>
              <p class="mt-1 text-[11px] c-[var(--text-tertiary)]">
                {{ t('tags.rerunFeedsHint') }}
              </p>
            </div>

            <div>
              <label class="block text-[13px] font-medium mb-1.5">{{ t('tags.rerunLimit') }}</label>
              <input
                v-model.number="rerunLimit"
                type="number"
                min="1"
                max="200"
                class="w-[140px] px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div v-if="rerunError" class="text-[12px] c-red-500">
              {{ rerunError }}
            </div>

            <div v-if="rerunLastSummary" class="text-[12px] c-[var(--text-secondary)]">
              <div class="mb-1">{{ t('tags.rerunSummary') }}: {{ rerunLastSummary.total }} / {{ rerunLastSummary.success }} / {{ rerunLastSummary.tagged }} / {{ rerunLastSummary.untagged }}</div>
              <div>{{ t('tags.rerunTotals') }}: {{ rerunTotals.total }} / {{ rerunTotals.success }} / {{ rerunTotals.tagged }} / {{ rerunTotals.untagged }}</div>
            </div>
          </div>

          <div class="p-4 border-t border-[var(--border-color)] flex justify-between items-center gap-2">
            <div class="text-[11px] c-[var(--text-tertiary)]">
              {{ t('tags.rerunSummaryHint') }}
            </div>
            <div class="flex gap-2">
              <button
                @click="closeRerunModal"
                class="px-4 py-2 rounded-lg text-[13px] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                @click="runRangeRerun(false)"
                :disabled="rerunRunning"
                class="px-4 py-2 rounded-lg text-[13px] bg-[var(--accent)] c-white"
                :class="rerunRunning ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'"
              >
                {{ rerunRunning ? t('tags.analyzing') : t('tags.rerunStart') }}
              </button>
              <button
                v-if="rerunHasMore"
                @click="runRangeRerun(true)"
                :disabled="rerunRunning"
                class="px-4 py-2 rounded-lg text-[13px] border border-[var(--border-color)]"
                :class="rerunRunning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]'"
              >
                {{ t('tags.rerunContinue') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Feed Scope Modal -->
    <FeedScopeModal
      :visible="showFeedScopeModal"
      @close="showFeedScopeModal = false"
    />
  </div>
</template>
