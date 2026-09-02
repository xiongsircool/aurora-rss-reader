<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Languages } from 'lucide-vue-next'
import ArticleReader from '../components/reader/ArticleReader.vue'
import GalleryReader from '../components/reader/GalleryReader.vue'
import ImageReader from '../components/reader/ImageReader.vue'
import ReaderActions from '../components/reader/ReaderActions.vue'
import VideoReader from '../components/reader/VideoReader.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ErrorBanner from '../components/common/ErrorBanner.vue'
import { useReaderStore } from '../stores/readerStore'
import { useAiStore } from '../stores/aiStore'
import { selectReaderTemplate } from '../components/reader/template'
import { renderMarkdown } from '../composables/useSanitize'
import { formatFullDate } from '../utils/date'
import { openUrl } from '../utils/openUrl'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const reader = useReaderStore()
const ai = useAiStore()

const TEMPLATES = { article: ArticleReader, image: ImageReader, gallery: GalleryReader, video: VideoReader }
const templateComponent = computed(() => TEMPLATES[selectReaderTemplate(reader.entry?.presentation.content_type)])

// Translation overlay: when toggled on, replace the body with the translated
// text. Per-entry state lives in aiStore so it never bleeds across articles.
const showTranslation = ref(false)
const aiState = computed(() => ai.state(reader.row?.id ?? '__none__'))
const translatedHtml = computed(() => renderMarkdown(aiState.value.translation))

async function toggleTranslate() {
  if (!reader.row) return
  showTranslation.value = !showTranslation.value
  if (showTranslation.value && !aiState.value.translation) {
    await ai.translate(reader.row)
  }
}

const metadata = computed(() => {
  if (!reader.entry) return ''
  const parts = [
    reader.entry.feed_title,
    formatFullDate(reader.entry.published_at, reader.entry.inserted_at),
    reader.entry.presentation.reading_time_minutes ? `${reader.entry.presentation.reading_time_minutes} min read` : null,
  ].filter(Boolean)

  return parts.join(' · ')
})

function shareEntry() {
  const entry = reader.entry
  if (!entry?.url) return

  if (navigator.share) {
    navigator.share({
      title: entry.title || 'Aurora entry',
      url: entry.url,
    }).catch(() => undefined)
    return
  }

  navigator.clipboard?.writeText(entry.url).catch(() => undefined)
}

// Reading progress (design shows "NN% read"). Tracked per-mounted-entry, which
// also means scroll position is never shared between articles (issue #14.11).
const scrollEl = ref<HTMLElement | null>(null)
const progress = ref(0)

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0
}

function resetScroll() {
  progress.value = 0
  void nextTick(() => {
    scrollEl.value?.scrollTo({ top: 0 })
  })
}

onMounted(() => {
  void reader.loadEntry(props.id)
})

watch(
  () => props.id,
  (nextId) => {
    resetScroll()
    showTranslation.value = false
    void reader.loadEntry(nextId)
  },
)
</script>

<template>
  <main ref="scrollEl" class="reader-screen" @scroll="onScroll">
    <header class="reader-header">
      <button class="icon-button" type="button" aria-label="Back" @click="router.back()">
        <ArrowLeft :size="20" />
      </button>
      <div>
        <span>{{ reader.entry?.feed_title || 'Aurora' }}</span>
      </div>
      <button
        v-if="reader.entry"
        class="icon-button"
        type="button"
        :class="{ 'icon-button--active': showTranslation }"
        aria-label="Translate"
        @click="toggleTranslate"
      >
        <Languages :size="20" />
      </button>
      <div class="reader-progress" aria-hidden="true">
        <span class="reader-progress__fill" :style="{ width: `${progress}%` }" />
      </div>
    </header>

    <ErrorBanner :message="reader.error" />

    <EmptyState v-if="!reader.loading && !reader.entry" title="Entry not found" />

    <section v-else-if="reader.loading" class="reader-loading">
      <div class="skeleton-line wide" />
      <div class="skeleton-card tall" />
    </section>

    <article v-else-if="reader.entry" class="reader-shell">
      <div class="reader-title-block">
        <span class="type-pill">{{ reader.entry.presentation.content_type }}</span>
        <h1>{{ reader.entry.title || 'Untitled entry' }}</h1>
        <p>{{ metadata }}</p>
      </div>

      <section v-if="showTranslation" class="reader-translation">
        <header class="reader-translation__head">
          <Languages :size="14" />
          <span>Translation</span>
        </header>
        <p v-if="aiState.translationLoading" class="ai-summary__status">Translating…</p>
        <p v-else-if="aiState.error" class="ai-summary__error">{{ aiState.error }}</p>
        <div v-else-if="aiState.translation" class="article-body markdown-body" v-html="translatedHtml" />
      </section>

      <component :is="templateComponent" v-else :entry="reader.entry" />

      <ReaderActions
        :saved="reader.entry.starred"
        :original-url="reader.entry.url"
        :progress="progress"
        @toggle-saved="reader.toggleSaved"
        @open-original="openUrl(reader.entry?.url)"
        @share="shareEntry"
      />
    </article>
  </main>
</template>
