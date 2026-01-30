<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSanitize } from '../../composables/useSanitize'
import type { CollectionEntry } from '../../stores/collectionsStore'

const props = defineProps<{
  entry: CollectionEntry | null
  showRemove?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-external'): void
  (e: 'remove'): void
}>()

const { t } = useI18n()
const { sanitize, sanitizeTitle } = useSanitize()

const safeTitle = computed(() => sanitizeTitle(props.entry?.title || ''))
const safeContent = computed(() => sanitize(props.entry?.content || props.entry?.summary || ''))

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-color)]">
    <!-- Empty State -->
    <div v-if="!entry" class="flex-1 flex items-center justify-center c-[var(--text-secondary)]">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p class="text-sm">{{ t('articles.selectToRead') }}</p>
      </div>
    </div>

    <!-- Article Content -->
    <template v-else>
      <!-- Header -->
      <div class="shrink-0 p-5 border-b border-[var(--border-color)]">
        <div class="flex items-start justify-between gap-3 mb-3">
          <h1 class="text-lg font-semibold leading-snug" v-html="safeTitle"></h1>
          <button
            @click="emit('close')"
            class="shrink-0 p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)]"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="flex items-center gap-3 text-xs c-[var(--text-secondary)]">
          <span>{{ entry.feed_title }}</span>
          <span>·</span>
          <span>{{ formatDate(entry.published_at) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="shrink-0 px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
        <button
          @click="emit('open-external')"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)]"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {{ t('articles.openInBrowser') }}
        </button>
        <button
          v-if="showRemove !== false"
          @click="emit('remove')"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm c-red-500 hover:bg-[rgba(255,0,0,0.1)]"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          {{ t('collections.removeFromCollection') }}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5">
        <article
          class="prose prose-sm max-w-none dark:prose-invert"
          v-html="safeContent"
        ></article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prose :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.prose :deep(a) {
  color: var(--accent);
}
.prose :deep(pre) {
  background: var(--bg-base);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}
</style>
