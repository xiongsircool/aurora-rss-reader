<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagsStore, type TagEntry } from '../../stores/tagsStore'

const props = defineProps<{
  selectedEntryId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-entry', entry: TagEntry): void
}>()

const { t } = useI18n()
const tagsStore = useTagsStore()

const selectedEntries = ref<Set<string>>(new Set())
const selectAll = ref(false)

const title = computed(() => {
  if (tagsStore.selectedTag) {
    return tagsStore.selectedTag.name
  }
  if (tagsStore.selectedView === 'pending') {
    return t('tags.pending')
  }
  if (tagsStore.selectedView === 'untagged') {
    return t('tags.untagged')
  }
  return ''
})

// Load entries based on current view
async function loadEntries(refresh = false) {
  if (tagsStore.selectedTagId) {
    await tagsStore.fetchEntriesByTag(tagsStore.selectedTagId, refresh)
  } else if (tagsStore.selectedView === 'pending') {
    await tagsStore.fetchPendingEntries(refresh)
  } else if (tagsStore.selectedView === 'untagged') {
    await tagsStore.fetchUntaggedEntries(refresh)
  }
  selectedEntries.value.clear()
  selectAll.value = false
}

// Watch for view/tag changes
watch(
  () => [tagsStore.selectedTagId, tagsStore.selectedView],
  () => {
    loadEntries(true)
  },
  { immediate: true }
)

function toggleSelectAll() {
  if (selectAll.value) {
    selectedEntries.value.clear()
    selectAll.value = false
  } else {
    tagsStore.entries.forEach(e => selectedEntries.value.add(e.id))
    selectAll.value = true
  }
}

function toggleEntry(entryId: string) {
  if (selectedEntries.value.has(entryId)) {
    selectedEntries.value.delete(entryId)
    selectAll.value = false
  } else {
    selectedEntries.value.add(entryId)
    if (selectedEntries.value.size === tagsStore.entries.length) {
      selectAll.value = true
    }
  }
}

async function handleAnalyzeSelected() {
  if (selectedEntries.value.size === 0) return
  const ids = Array.from(selectedEntries.value)
  await tagsStore.analyzeEntries(ids)
  await loadEntries(true)
}

function handleSelectEntry(entry: TagEntry) {
  emit('select-entry', entry)
}

function loadMore() {
  if (tagsStore.hasMore && !tagsStore.loading) {
    loadEntries(false)
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return t('common.justNow')
  if (hours < 24) return t('common.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('common.daysAgo', { n: days })
  return date.toLocaleDateString()
}
</script>

<template>
  <div class="h-full flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-base)]">
    <!-- Header -->
    <div class="p-4 border-b border-[var(--border-color)]">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            v-if="tagsStore.selectedTag"
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: tagsStore.selectedTag.color }"
          ></span>
          <h2 class="text-[15px] font-semibold">{{ title }}</h2>
          <span class="text-[13px] c-[var(--text-tertiary)]">({{ tagsStore.entries.length }})</span>
        </div>
      </div>
      
      <!-- Selection Actions (for pending view) -->
      <div v-if="tagsStore.selectedView === 'pending' && tagsStore.entries.length > 0" class="mt-3 flex items-center gap-3">
        <label class="flex items-center gap-2 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            :checked="selectAll"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded border-[var(--border-color)]"
          />
          {{ t('common.selectAll') }}
        </label>
        <button
          v-if="selectedEntries.size > 0"
          @click="handleAnalyzeSelected"
          :disabled="tagsStore.analyzing"
          class="px-3 py-1.5 rounded-md bg-[var(--accent)] c-white text-[12px] font-medium"
          :class="tagsStore.analyzing ? 'opacity-50' : 'hover:opacity-90'"
        >
          {{ tagsStore.analyzing 
            ? t('tags.analyzing') 
            : t('tags.analyzeSelected', { n: selectedEntries.size }) }}
        </button>
      </div>
    </div>

    <!-- Entry List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="tagsStore.loading && tagsStore.entries.length === 0" class="flex items-center justify-center h-32">
        <div class="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="tagsStore.entries.length === 0" class="flex flex-col items-center justify-center h-full c-[var(--text-tertiary)] text-[13px]">
        <svg class="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <circle cx="7" cy="7" r="1.5"/>
        </svg>
        <p>{{ t('tags.noEntries') }}</p>
      </div>

      <div v-else class="divide-y divide-[var(--border-color)]">
        <div
          v-for="entry in tagsStore.entries"
          :key="entry.id"
          @click="handleSelectEntry(entry)"
          class="p-4 cursor-pointer transition-colors"
          :class="props.selectedEntryId === entry.id
            ? 'bg-[rgba(255,122,24,0.08)]'
            : 'hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)]'"
        >
          <div class="flex items-start gap-3">
            <!-- Checkbox (for pending view) -->
            <input
              v-if="tagsStore.selectedView === 'pending'"
              type="checkbox"
              :checked="selectedEntries.has(entry.id)"
              @click.stop="toggleEntry(entry.id)"
              class="mt-0.5 w-4 h-4 rounded border-[var(--border-color)] shrink-0"
            />
            
            <div class="flex-1 min-w-0">
              <h3 class="text-[14px] font-medium line-clamp-2 mb-1">{{ entry.title }}</h3>
              <p v-if="entry.summary" class="text-[12px] c-[var(--text-secondary)] line-clamp-2 mb-2">
                {{ entry.summary }}
              </p>
              <div class="flex items-center gap-2 text-[11px] c-[var(--text-tertiary)]">
                <span v-if="entry.feed_title">{{ entry.feed_title }}</span>
                <span v-if="entry.feed_title && entry.published_at">·</span>
                <span>{{ formatDate(entry.published_at || entry.inserted_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Load More -->
        <div v-if="tagsStore.hasMore" class="p-4 text-center">
          <button
            @click="loadMore"
            :disabled="tagsStore.loading"
            class="px-4 py-2 rounded-md text-[13px] bg-[var(--bg-surface)] hover:bg-[rgba(0,0,0,0.05)]"
          >
            {{ tagsStore.loading ? t('common.loading') : t('common.loadMore') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
