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
</script>

<template>
  <section class="details">
    <div v-if="entry" class="details__content">
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
        class="details__body" 
        v-html="showTranslation && translatedContent ? translatedContent : entry.content"
      ></article>
    </div>
    <div v-else class="empty">
      {{ t('articles.selectArticle') }}
    </div>
  </section>
</template>

<style scoped>
.details {
  background: var(--bg-surface);
  padding: 24px;
  flex-shrink: 0;
  min-width: 280px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  width: var(--details-width, 420px);
}

.details__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.details__body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
  flex: initial;
  overflow: visible;
  min-height: auto;
}

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

.empty {
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
  height: 100%;
}

.details::-webkit-scrollbar { width: 8px; }
.details::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.details:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .details::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .details:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }

@media (max-width: 960px) {
  .details {
    width: 100% !important;
    max-width: none;
    height: auto;
    max-height: none;
    overflow: visible;
  }
}
</style>
