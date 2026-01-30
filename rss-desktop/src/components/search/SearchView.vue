<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSearchStore, type SearchResult } from '../../stores/searchStore'

const emit = defineEmits<{
  (e: 'select-result', result: SearchResult): void
}>()

const props = defineProps<{
  selectedResultId: string | null
}>()

const { t } = useI18n()
const searchStore = useSearchStore()

const searchInput = ref('')
const searchType = ref<'hybrid' | 'semantic' | 'keyword'>('hybrid')

const results = computed(() => searchStore.results)
const loading = computed(() => searchStore.loading)
const hasSearched = computed(() => searchStore.hasSearched)

async function handleSearch() {
  if (!searchInput.value.trim()) return
  await searchStore.search(searchInput.value, searchType.value)
}

function handleClear() {
  searchInput.value = ''
  searchStore.clearSearch()
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}

function highlightText(text: string, query: string) {
  if (!query || !text) return text
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>')
}
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--bg-base)]">
    <!-- Search Header -->
    <div class="px-5 py-4 border-b border-[var(--border-color)]">
      <div class="flex items-center gap-3 mb-3">
        <span class="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgba(59,130,246,0.1)]">
          <svg class="w-5 h-5 c-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </span>
        <div>
          <h2 class="font-semibold text-lg">{{ t('search.title') }}</h2>
          <p class="text-xs c-[var(--text-secondary)]">{{ t('search.subtitle') }}</p>
        </div>
      </div>

      <!-- Search Input -->
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <input
            v-model="searchInput"
            :placeholder="t('search.placeholder')"
            class="w-full px-4 py-2.5 pr-10 text-[14px] rounded-lg border border-[var(--border-color)] bg-transparent focus:border-[var(--accent)] outline-none"
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchInput"
            @click="handleClear"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[rgba(0,0,0,0.05)]"
          >
            <svg class="w-4 h-4 c-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <button
          @click="handleSearch"
          :disabled="!searchInput.trim() || loading"
          class="px-4 py-2.5 rounded-lg bg-[var(--accent)] c-white text-[14px] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {{ loading ? t('search.searching') : t('search.search') }}
        </button>
      </div>

      <!-- Search Type Selector -->
      <div class="flex items-center gap-4 mt-3">
        <span class="text-xs c-[var(--text-secondary)]">{{ t('search.type') }}:</span>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" v-model="searchType" value="hybrid" class="accent-[var(--accent)]" />
          <span class="text-xs">{{ t('search.typeHybrid') }}</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" v-model="searchType" value="semantic" class="accent-[var(--accent)]" />
          <span class="text-xs">{{ t('search.typeSemantic') }}</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" v-model="searchType" value="keyword" class="accent-[var(--accent)]" />
          <span class="text-xs">{{ t('search.typeKeyword') }}</span>
        </label>
      </div>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>

      <!-- Empty State - Not Searched -->
      <div v-else-if="!hasSearched" class="flex flex-col items-center justify-center h-full c-[var(--text-secondary)]">
        <svg class="w-20 h-20 mb-4 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p class="text-sm mb-2">{{ t('search.emptyTitle') }}</p>
        <p class="text-xs opacity-70">{{ t('search.emptyHint') }}</p>
      </div>

      <!-- No Results -->
      <div v-else-if="results.length === 0" class="flex flex-col items-center justify-center h-full c-[var(--text-secondary)]">
        <svg class="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        <p class="text-sm">{{ t('search.noResults') }}</p>
      </div>

      <!-- Results List -->
      <div v-else class="divide-y divide-[var(--border-color)]">
        <div
          v-for="result in results"
          :key="result.id"
          @click="emit('select-result', result)"
          class="group px-5 py-3 cursor-pointer transition-colors"
          :class="selectedResultId === result.id
            ? 'bg-[rgba(255,122,24,0.08)]'
            : 'hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)]'"
        >
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <h3
                class="font-medium text-[14px] mb-1.5 line-clamp-2"
                v-html="highlightText(result.title, searchStore.query)"
              ></h3>
              <p
                v-if="result.content"
                class="text-xs c-[var(--text-secondary)] line-clamp-2 mb-1.5"
                v-html="highlightText(result.content, searchStore.query)"
              ></p>
              <div class="flex items-center gap-2 text-xs c-[var(--text-secondary)]">
                <span class="truncate max-w-[120px]">{{ result.feed_title }}</span>
                <span class="opacity-50">·</span>
                <span>{{ formatDate(result.published_at) }}</span>
                <span class="opacity-50">·</span>
                <span
                  class="px-1.5 py-0.5 rounded text-[10px]"
                  :class="result.match_type === 'semantic'
                    ? 'bg-purple-100 c-purple-600 dark:bg-purple-900 dark:c-purple-300'
                    : 'bg-blue-100 c-blue-600 dark:bg-blue-900 dark:c-blue-300'"
                >
                  {{ result.match_type === 'semantic' ? t('search.matchSemantic') : t('search.matchKeyword') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Count -->
    <div v-if="hasSearched && results.length > 0" class="px-5 py-2 border-t border-[var(--border-color)] text-xs c-[var(--text-secondary)]">
      {{ t('search.resultsCount', { count: results.length }) }}
    </div>
  </div>
</template>
