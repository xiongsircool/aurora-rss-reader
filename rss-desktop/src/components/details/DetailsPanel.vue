<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'
import DetailsHeader from './DetailsHeader.vue'
import DetailsActions from './DetailsActions.vue'
import AISummaryCard from './AISummaryCard.vue'
import ArticleBlock from './ArticleBlock.vue'
import { useArticleParser } from '../../composables/useArticleParser'
import { useTranslationQueue } from '../../composables/useTranslationQueue'

const props = defineProps<{
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

// Immersive Translation Logic
const { 
  blocks, 
  loadContent, 
  applyCachedTranslations, 
  updateBlockTranslation,
  resetTranslations 
} = useArticleParser()

const { 
  processQueue, 
  retrySingle, 
  fetchCache, 
  isProcessing,
  progress: queueProgress 
} = useTranslationQueue()

// Watch entry changes to parse content
watch(() => props.entry, (newEntry) => {
  if (newEntry?.content) {
    loadContent(newEntry.content)
    // If translation is already on, trigger translation logic
    if (props.showTranslation) {
      handleImmersiveTranslation(newEntry.id, props.translationLanguage)
    }
  } else {
    // Clear blocks if no content
    loadContent('')
  }
}, { immediate: true })

// Watch translation toggle
watch(() => props.showTranslation, (show) => {
  if (show && props.entry) {
    handleImmersiveTranslation(props.entry.id, props.translationLanguage)
  }
})

// Watch translation language change
watch(() => props.translationLanguage, (newLang) => {
  if (props.showTranslation && props.entry) {
    // Determine if we need to reset and re-translate
    // For now, simpler to just trigger translation (it handles cache check)
    handleImmersiveTranslation(props.entry.id, newLang)
  }
})

async function handleImmersiveTranslation(entryId: string, language: string) {
  // 1. Fetch any existing cache first
  const cache = await fetchCache(entryId, language)
  applyCachedTranslations(cache)
  
  // 2. Queue remaining blocks for translation
  processQueue(entryId, blocks.value, language, updateBlockTranslation)
}

function handleRetry(blockId: string) {
  if (!props.entry) return
  const block = blocks.value.find(b => b.id === blockId)
  if (block) {
    retrySingle(props.entry.id, block, props.translationLanguage, updateBlockTranslation)
  }
}
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
        :is-translating="translationLoading || isProcessing"
        :show-translation="showTranslation"
        :translation-language="translationLanguage"
        :translation-progress="translationLoading ? translationProgress : (isProcessing ? queueProgress : undefined)"
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
      
      <!-- Immersive Reader Body -->
      <article 
        class="details__body text-base leading-relaxed c-[var(--text-primary)] break-words flex-initial overflow-visible min-h-auto"
      >
        <ArticleBlock
          v-for="block in blocks"
          :key="block.id"
          :block="block"
          :show-translation="showTranslation"
          @retry="handleRetry"
        />
      </article>
    </div>
    <div v-else class="grid place-items-center c-[var(--text-secondary)] text-center p-6 h-full">
      {{ t('articles.selectArticle') }}
    </div>
  </section>
</template>

<style scoped>
/* Scoped styles for the container */
.details__body {
  /* Ensure container has some spacing */
  padding-bottom: 2em;
}

/* Custom scrollbar */
.details::-webkit-scrollbar { width: 8px; }
.details::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.details:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }

:global(.dark) .details::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .details:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
</style>
