<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore, type CollectionEntry } from '../../stores/collectionsStore'

const props = defineProps<{
  selectedEntryId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-entry', entry: CollectionEntry): void
  (e: 'entry-removed', entryId: string): void
}>()

const { t } = useI18n()
const collectionsStore = useCollectionsStore()

const activeCollection = computed(() => collectionsStore.activeCollection)
const entries = computed(() => collectionsStore.collectionEntries)
const loading = computed(() => collectionsStore.loading)

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  if (!entries.value.length) return

  const currentIndex = entries.value.findIndex(entry => entry.id === props.selectedEntryId)

  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault()
    const nextIndex = currentIndex < entries.value.length - 1 ? currentIndex + 1 : 0
    emit('select-entry', entries.value[nextIndex])
  } else if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault()
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : entries.value.length - 1
    emit('select-entry', entries.value[prevIndex])
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

async function handleRemove(entryId: string, event: Event) {
  event.stopPropagation()
  if (!activeCollection.value) return
  await collectionsStore.removeEntryFromCollection(activeCollection.value.id, entryId)
  emit('entry-removed', entryId)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--bg-base)]">
    <!-- Header -->
    <div v-if="activeCollection" class="px-5 py-4 border-b border-[var(--border-color)]">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-lg flex items-center justify-center" :style="{ backgroundColor: activeCollection.color + '20' }">
          <svg class="w-5 h-5" :style="{ color: activeCollection.color }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <div>
          <h2 class="font-semibold text-lg">{{ activeCollection.name }}</h2>
          <p class="text-xs c-[var(--text-secondary)]">{{ activeCollection.entry_count }} {{ t('collections.items') }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!activeCollection" class="flex flex-col items-center justify-center h-full c-[var(--text-secondary)]">
        <svg class="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p class="text-sm">{{ t('collections.selectCollection') }}</p>
      </div>

      <!-- No Entries -->
      <div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-full c-[var(--text-secondary)]">
        <svg class="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p class="text-sm">{{ t('collections.noEntries') }}</p>
      </div>

      <!-- Entry List with Virtual Scroll -->
      <RecycleScroller
        v-else
        class="h-full"
        :items="entries"
        :item-size="88"
        key-field="id"
        v-slot="{ item: entry }"
      >
        <div
          @click="emit('select-entry', entry)"
          class="group px-5 py-3 cursor-pointer transition-colors border-b border-[var(--border-color)]"
          :class="selectedEntryId === entry.id
            ? 'bg-[rgba(255,122,24,0.08)]'
            : 'hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)]'"
        >
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-[14px] mb-1.5 line-clamp-2">{{ entry.title }}</h3>
              <div class="flex items-center gap-2 text-xs c-[var(--text-secondary)]">
                <span class="truncate max-w-[120px]">{{ entry.feed_title }}</span>
                <span class="opacity-50">·</span>
                <span>{{ formatDate(entry.published_at) }}</span>
              </div>
            </div>
            <button
              @click="handleRemove(entry.id, $event)"
              class="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[rgba(255,0,0,0.1)] c-red-500 transition-opacity shrink-0"
              :title="t('collections.removeFromCollection')"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </RecycleScroller>
    </div>
  </div>
</template>
