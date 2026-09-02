<script setup lang="ts">
import { computed, ref } from 'vue'
import AISummaryPanel from './AISummaryPanel.vue'
import ImageViewer from '../common/ImageViewer.vue'
import { sanitizeHtml } from '../../composables/useSanitize'
import type { EntryMediaImage } from '../../domain/entryPresentation'
import type { ReaderEntry } from '../../types'

const props = defineProps<{
  entry: ReaderEntry
}>()

const leadImage = computed(() => props.entry.presentation.lead_image_url)
const bodyHtml = computed(() => sanitizeHtml(props.entry.presentation.reader_html || props.entry.summary))

// Tap the hero to open it fullscreen. Use parsed images when present, else the lead.
const viewerImages = computed<EntryMediaImage[]>(() =>
  props.entry.presentation.images.length
    ? props.entry.presentation.images
    : leadImage.value
      ? [{ url: leadImage.value, alt: props.entry.title, caption: null, width: null, height: null }]
      : [],
)
const viewerIndex = ref<number | null>(null)
</script>

<template>
  <article class="reader-template image-reader">
    <img
      v-if="leadImage"
      class="reader-hero-image"
      :src="leadImage"
      :alt="entry.title || ''"
      @click="viewerIndex = 0"
    >
    <AISummaryPanel />
    <div class="article-body" v-html="bodyHtml" />
    <ImageViewer :images="viewerImages" :start-index="viewerIndex" @close="viewerIndex = null" />
  </article>
</template>
