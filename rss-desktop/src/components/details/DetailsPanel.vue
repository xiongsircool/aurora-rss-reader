<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'
import DetailsHeader from './DetailsHeader.vue'
import DetailsActions from './DetailsActions.vue'
import AISummaryCard from './AISummaryCard.vue'

defineProps<{
  entry: Entry | null
  
  // Translation state
  showTranslation: boolean
  translatedTitle: string | null
  translatedContent: string | null
  translationLoading: boolean
  translationProgress?: number
  translationLanguage: string
  
  // Summary state
  summaryText: string
  summaryLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'open-external'): void
  (e: 'toggle-star'): void
  (e: 'toggle-translation'): void
  (e: 'generate-summary'): void
  (e: 'update:translationLanguage', value: string): void
}>()

const { t } = useI18n()
import { useSanitize } from '../../composables/useSanitize'

const { sanitize } = useSanitize()
</script>

<template>
  <section class="details bg-[var(--bg-surface)] p-6 shrink-0 min-w-70 flex flex-col max-h-screen min-h-0 overflow-y-auto overflow-x-hidden w-[var(--details-width,420px)] lt-md:w-full! lt-md:max-w-none lt-md:h-auto lt-md:max-h-none lt-md:overflow-visible">
    <div v-if="entry" class="flex flex-col min-h-0">
      <DetailsHeader
        :entry="entry"
        :show-translated-title="showTranslation"
        :translated-title="translatedTitle"
      />
      
      <DetailsActions
        :is-starred="entry.starred"
        :is-translating="translationLoading"
        :show-translation="showTranslation"
        :translation-language="translationLanguage"
        :translation-progress="translationProgress"
        @open-external="emit('open-external')"
        @toggle-star="emit('toggle-star')"
        @toggle-translation="emit('toggle-translation')"
        @update:translation-language="emit('update:translationLanguage', $event)"
      />
      
      <AISummaryCard
        :summary-text="summaryText"
        :summary-loading="summaryLoading"
        @generate-summary="emit('generate-summary')"
      />
      
      <article 
        class="details__body text-base leading-relaxed c-[var(--text-primary)] break-words flex-initial overflow-visible min-h-auto" 
        v-html="sanitize(showTranslation && translatedContent ? translatedContent : entry.content)"
      ></article>
    </div>
    <div v-else class="grid place-items-center c-[var(--text-secondary)] text-center p-6 h-full">
      {{ t('articles.selectArticle') }}
    </div>
  </section>
</template>

<style scoped>
/* Deep selectors for article content styling */
.details__body :deep(p) {
  margin-bottom: 1em;
}

.details__body :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  border-radius: 10px;
}

.details__body :deep(table) {
  width: 100%;
  overflow-x: auto;
  display: block;
}

.details__body :deep(pre),
.details__body :deep(code) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Custom scrollbar */
.details::-webkit-scrollbar { width: 8px; }
.details::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.details:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .details::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .details:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }

/* Bilingual Translation Styles */
.details__body :deep(.bilingual-segment) {
  margin-bottom: 1.5em;
  position: relative;
}

.details__body :deep(.translated) {
  margin-top: 0.5em;
  padding: 10px 14px;
  background: rgba(76, 116, 255, 0.04);
  border-radius: 6px;
  border-left: 3px solid #4c74ff;
  color: var(--text-secondary);
  font-size: 0.95em;
  line-height: 1.6;
}

:global(.dark) .details__body :deep(.translated) {
  background: rgba(76, 116, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  border-left-color: #5c80ff;
}
</style>
