<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'
import type { ContentBlock } from '../../composables/useArticleParser'
import DetailsHeader from './DetailsHeader.vue'
import DetailsActions from './DetailsActions.vue'
import AISummaryCard from './AISummaryCard.vue'
import ArticleContent from './ArticleContent.vue'
import AudioPlayer from './AudioPlayer.vue'
import { useSanitize } from '../../composables/useSanitize'

const props = defineProps<{
  entry: Entry | null
  inOverlay?: boolean

  // Translation language
  translationLanguage: string

  // Summary state
  summaryText: string
  summaryLoading: boolean

  // Full-text translation state
  fullTextTranslationBlocks: ContentBlock[]
  isFullTextTranslating: boolean
  showFullTextTranslation: boolean
  fullTextTranslationProgress: number
  translatedTitle: string | null
  getFullTextTranslation: (blockId: string) => string | null
  isFullTextBlockLoading: (blockId: string) => boolean
  isFullTextBlockFailed: (blockId: string) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-external'): void
  (e: 'toggle-star'): void
  (e: 'generate-summary'): void
  (e: 'update:translationLanguage', value: string): void
  (e: 'toggle-full-text-translation'): void
}>()

const { t } = useI18n()
const { sanitize } = useSanitize()
const safeContent = computed(() => sanitize(props.entry?.content ?? ''))

// Check if entry has audio enclosure
const hasAudio = computed(() => {
  const type = props.entry?.enclosure_type
  const url = props.entry?.enclosure_url
  return url && type?.startsWith('audio/')
})

const containerClasses = computed(() => [
  'details bg-[var(--bg-surface)] p-6 shrink-0 min-w-70 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden w-[var(--details-width,420px)]',
  props.inOverlay ? 'h-full max-h-none' : 'max-h-screen',
  props.inOverlay ? '' : 'lt-md:w-full! lt-md:max-w-none lt-md:h-auto lt-md:max-h-none lt-md:overflow-visible',
])
</script>

<template>
  <section :class="containerClasses">
    <div v-if="entry" class="flex flex-col min-h-0">
      <DetailsHeader
        :entry="entry"
        :show-translated-title="showFullTextTranslation"
        :translated-title="translatedTitle"
      />

      <DetailsActions
        :is-starred="entry.starred"
        :translation-language="translationLanguage"
        :is-full-text-translating="isFullTextTranslating"
        :show-full-text-translation="showFullTextTranslation"
        :full-text-translation-progress="fullTextTranslationProgress"
        :entry-url="entry.url ?? undefined"
        :entry-title="entry.title ?? undefined"
        :entry-author="entry.author"
        :entry-summary="entry.summary"
        :entry-published-at="entry.published_at"
        :entry-feed-title="entry.feed_title"
        :entry-doi="entry.doi"
        :entry-pmid="entry.pmid"
        @open-external="emit('open-external')"
        @toggle-star="emit('toggle-star')"
        @update:translation-language="emit('update:translationLanguage', $event)"
        @toggle-full-text-translation="emit('toggle-full-text-translation')"
      />

      <AISummaryCard
        :summary-text="summaryText"
        :summary-loading="summaryLoading"
        @generate-summary="emit('generate-summary')"
      />

      <!-- Audio Player -->
      <AudioPlayer
        v-if="hasAudio && entry.enclosure_url"
        :src="entry.enclosure_url"
        :duration="entry.duration"
        :image-url="entry.image_url"
        :title="entry.title"
        class="mb-4"
      />

      <!-- Article Body -->
      <ArticleContent
        v-if="fullTextTranslationBlocks.length > 0"
        :blocks="fullTextTranslationBlocks"
        :show-translation="showFullTextTranslation"
        :get-translation="getFullTextTranslation"
        :is-block-loading="isFullTextBlockLoading"
        :is-block-failed="isFullTextBlockFailed"
        class="details__body"
      />
      <article
        v-else
        class="details__body text-base leading-relaxed c-[var(--text-primary)] break-words flex-initial overflow-visible min-h-auto"
        v-html="safeContent"
      />
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

/* Article body styles */
.details__body :deep(p),
.details__body :deep(h1),
.details__body :deep(h2),
.details__body :deep(h3),
.details__body :deep(h4),
.details__body :deep(h5),
.details__body :deep(h6),
.details__body :deep(li),
.details__body :deep(blockquote) {
  margin: 0;
}

.details__body :deep(p) {
  margin-bottom: 0.5em;
}

.details__body :deep(h1),
.details__body :deep(h2),
.details__body :deep(h3),
.details__body :deep(h4),
.details__body :deep(h5),
.details__body :deep(h6) {
  margin-top: 0.8em;
  margin-bottom: 0.4em;
  font-weight: 600;
}

.details__body :deep(img) {
  max-width: 100%;
  height: auto;
}

.details__body :deep(video) {
  max-width: 100%;
  height: auto;
}

.details__body :deep(iframe) {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
}

.details__body :deep(figure) {
  max-width: 100%;
  margin: 0;
}

.details__body :deep(embed),
.details__body :deep(object) {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
}

.details__body :deep(pre) {
  background: var(--bg-elevated);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
}

.details__body :deep(code) {
  background: var(--bg-elevated);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

.details__body :deep(a) {
  color: var(--accent-primary, #4C74FF);
  text-decoration: none;
}

.details__body :deep(a:hover) {
  text-decoration: underline;
}
</style>
