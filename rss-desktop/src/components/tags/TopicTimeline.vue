<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore } from '../../stores/tagsStore'
import { formatDate } from '../../utils/date'

const props = defineProps<{
  tagId: string
  tagName: string
  tagColor: string
}>()

const emit = defineEmits<{
  (e: 'select-entry', entryId: string): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const groupBy = ref<'week' | 'month'>('week')
const timelineData = ref<Array<{
  period: string
  count: number
  period_start: string
  period_end: string
  entries: Array<{ id: string; title: string; url: string; published_at: string; summary: string | null; feed_title: string }>
}>>([])
const loading = ref(false)

async function loadTimeline() {
  loading.value = true
  try {
    const data = await tagsStore.fetchTimeline(props.tagId, groupBy.value)
    timelineData.value = data.items || []
  } finally {
    loading.value = false
  }
}

watch(() => props.tagId, () => loadTimeline(), { immediate: true })
watch(groupBy, () => loadTimeline())

function formatPeriod(period: string): string {
  if (groupBy.value === 'month') {
    // Format: 2026-02 -> Feb 2026
    const [year, month] = period.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  }
  // Week format: 2026-W06
  return period
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: tagColor }"></span>
        <span class="text-[13px] font-semibold c-[var(--text-primary)]">{{ t('tags.timeline') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="groupBy = 'week'"
          class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-all"
          :class="groupBy === 'week'
            ? 'bg-[rgba(139,92,246,0.15)] c-[#8b5cf6]'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.timelineGroupWeek') }}
        </button>
        <button
          @click="groupBy = 'month'"
          class="px-2 py-0.5 text-[10px] font-medium rounded-md transition-all"
          :class="groupBy === 'month'
            ? 'bg-[rgba(139,92,246,0.15)] c-[#8b5cf6]'
            : 'c-[var(--text-tertiary)] hover:c-[var(--text-secondary)]'"
        >
          {{ t('tags.timelineGroupMonth') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-4 text-center">
      <div class="inline-block animate-spin w-5 h-5 border-2 border-[#8b5cf6] border-t-transparent rounded-full"></div>
    </div>

    <!-- Timeline -->
    <div v-else-if="timelineData.length > 0" class="relative pl-5">
      <!-- Vertical line -->
      <div
        class="absolute left-2 top-2 bottom-2 w-px"
        :style="{ backgroundColor: tagColor + '40' }"
      />

      <div v-for="period in timelineData" :key="period.period" class="relative mb-4 last:mb-0">
        <!-- Dot on timeline -->
        <div
          class="absolute -left-3 top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-surface)]"
          :style="{ backgroundColor: tagColor }"
        />

        <!-- Period header -->
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[12px] font-semibold c-[var(--text-primary)]">{{ formatPeriod(period.period) }}</span>
          <span
            class="text-[10px] px-1.5 py-0 rounded-md font-medium"
            :style="{ backgroundColor: tagColor + '18', color: tagColor }"
          >
            {{ period.count }} {{ t('tags.articles') }}
          </span>
        </div>

        <!-- Entries -->
        <div class="space-y-1">
          <button
            v-for="entry in period.entries"
            :key="entry.id"
            @click="emit('select-entry', entry.id)"
            class="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer bg-transparent border-none"
          >
            <div class="text-[12px] font-medium c-[var(--text-primary)] line-clamp-1">{{ entry.title }}</div>
            <div class="text-[10px] c-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
              <span>{{ entry.feed_title }}</span>
              <span v-if="entry.published_at">{{ formatDate(entry.published_at, null) }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="py-4 text-center text-[12px] c-[var(--text-tertiary)]">
      {{ t('tags.noEntries') }}
    </div>
  </div>
</template>
