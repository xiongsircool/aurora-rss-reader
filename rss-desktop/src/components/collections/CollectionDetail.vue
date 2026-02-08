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
  <div class="h-full flex flex-col bg-[var(--bg-base)] border-l border-[var(--border-color)]">
    <!-- Header -->
    <div v-if="activeCollection" class="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div class="flex items-center gap-3">
        <span class="w-8 h-8 rounded-lg flex items-center justify-center" :style="{ backgroundColor: activeCollection.color + '20' }">
          <svg class="w-4 h-4" :style="{ color: activeCollection.color }" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.17l1.42 1.42a2 2 0 0 0 1.41.58H20a2 2 0 0 1 2 2v10z"/>
          </svg>
        </span>
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-[15px] truncate c-[var(--text-primary)]">{{ activeCollection.name }}</h2>
          <p class="text-[11px] c-[var(--text-tertiary)]">{{ activeCollection.entry_count }} {{ t('collections.items') }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!activeCollection" class="flex flex-col items-center justify-center h-full text-center px-4">
        <svg class="w-12 h-12 mb-3 c-[var(--text-tertiary)] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p class="text-sm c-[var(--text-secondary)]">{{ t('collections.selectCollection') }}</p>
      </div>

      <!-- No Entries -->
      <div v-else-if="entries.length === 0" class="flex flex-col items-center justify-center h-full text-center px-4">
        <svg class="w-12 h-12 mb-3 c-[var(--text-tertiary)] opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p class="text-sm c-[var(--text-secondary)]">{{ t('collections.noEntries') }}</p>
      </div>

      <!-- Entry List -->
      <RecycleScroller
        v-else
        class="h-full px-3 py-3"
        :items="entries"
        :item-size="78"
        key-field="id"
        v-slot="{ item: entry }"
      >
        <div
          @click="emit('select-entry', entry)"
          class="group flex items-center gap-3 px-4 py-3 mb-2.5 cursor-pointer transition-all duration-200 rounded-xl border"
          :class="selectedEntryId === entry.id
            ? 'bg-gradient-to-r from-[rgba(255,122,24,0.12)] to-[rgba(255,122,24,0.06)] border-[var(--accent)] shadow-[0_2px_12px_rgba(255,122,24,0.15)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--accent)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5'"
        >
          <!-- Folder color indicator -->
          <div 
            class="w-1 h-10 rounded-full shrink-0 transition-colors"
            :class="selectedEntryId === entry.id ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'"
          ></div>
          
          <div class="flex-1 min-w-0">
            <h3 
              class="text-[13px] font-medium leading-snug line-clamp-1 mb-1 transition-colors"
              :class="selectedEntryId === entry.id ? 'c-[var(--accent)]' : 'c-[var(--text-primary)]'"
            >
              {{ entry.title }}
            </h3>
            <div class="flex items-center gap-2 text-[11px] c-[var(--text-tertiary)]">
              <span class="truncate max-w-[120px]">{{ entry.feed_title }}</span>
              <span class="opacity-40">·</span>
              <span>{{ formatDate(entry.published_at) }}</span>
            </div>
          </div>
          
          <button
            @click.stop="handleRemove(entry.id, $event)"
            class="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[rgba(255,59,48,0.1)] c-[var(--text-tertiary)] hover:c-[#ff3b30] transition-all shrink-0"
            :title="t('collections.removeFromCollection')"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </RecycleScroller>
    </div>
  </div>
</template>
