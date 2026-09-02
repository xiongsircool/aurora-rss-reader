<script setup lang="ts">
import { computed, ref } from 'vue'
import { Images } from 'lucide-vue-next'
import ImageViewer from '../common/ImageViewer.vue'
import { sanitizeHtml } from '../../composables/useSanitize'
import type { ReaderEntry } from '../../types'

const props = defineProps<{
  entry: ReaderEntry
}>()

const introHtml = computed(() => sanitizeHtml(props.entry.summary || props.entry.presentation.preview_text))
const images = computed(() => props.entry.presentation.images)

// Show a capped grid until the reader expands the full set.
const COLLAPSED_COUNT = 4
const expanded = ref(false)
const visibleImages = computed(() => (expanded.value ? images.value : images.value.slice(0, COLLAPSED_COUNT)))
const remaining = computed(() => Math.max(0, images.value.length - COLLAPSED_COUNT))

const viewerIndex = ref<number | null>(null)
function openViewer(index: number) {
  viewerIndex.value = index
}
</script>

<template>
  <article class="reader-template gallery-reader">
    <div v-if="introHtml" class="article-body gallery-reader__intro" v-html="introHtml" />

    <div class="gallery-grid">
      <figure
        v-for="(image, index) in visibleImages"
        :key="image.url"
        class="gallery-image"
        @click="openViewer(index)"
      >
        <img :src="image.url" :alt="image.alt || entry.title || ''" loading="lazy" decoding="async">
        <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
      </figure>
    </div>

    <button
      v-if="!expanded && remaining > 0"
      class="gallery-view-all"
      type="button"
      @click="expanded = true"
    >
      <Images :size="16" />
      View all {{ images.length }} images
    </button>

    <ImageViewer :images="images" :start-index="viewerIndex" @close="viewerIndex = null" />
  </article>
</template>
