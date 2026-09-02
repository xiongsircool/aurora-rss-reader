<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import type { EntryMediaImage } from '../../domain/entryPresentation'

const props = defineProps<{
  images: EntryMediaImage[]
  /** Index to open at; null = closed. */
  startIndex: number | null
}>()

const emit = defineEmits<{ (event: 'close'): void }>()

const current = ref(0)
watch(
  () => props.startIndex,
  (idx) => {
    if (idx != null) current.value = idx
  },
  { immediate: true },
)

const open = computed(() => props.startIndex != null && props.images.length > 0)
const image = computed(() => props.images[current.value] ?? null)
const hasMultiple = computed(() => props.images.length > 1)

function prev() {
  current.value = (current.value - 1 + props.images.length) % props.images.length
}
function next() {
  current.value = (current.value + 1) % props.images.length
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="image-viewer" role="dialog" aria-modal="true" @click.self="emit('close')">
      <button class="image-viewer__close icon-button" type="button" aria-label="Close" @click="emit('close')">
        <X :size="22" />
      </button>

      <button v-if="hasMultiple" class="image-viewer__nav image-viewer__nav--prev" type="button" aria-label="Previous" @click="prev">
        <ChevronLeft :size="28" />
      </button>

      <figure class="image-viewer__figure">
        <img v-if="image" :src="image.url" :alt="image.alt || ''">
        <figcaption v-if="image?.caption">{{ image.caption }}</figcaption>
      </figure>

      <button v-if="hasMultiple" class="image-viewer__nav image-viewer__nav--next" type="button" aria-label="Next" @click="next">
        <ChevronRight :size="28" />
      </button>

      <span v-if="hasMultiple" class="image-viewer__counter">{{ current + 1 }} / {{ images.length }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
.image-viewer {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 14, 12, 0.94);
  padding: env(safe-area-inset-top) 12px env(safe-area-inset-bottom);
}
.image-viewer__close {
  position: absolute;
  top: calc(10px + env(safe-area-inset-top));
  right: 12px;
  color: #fff;
}
.image-viewer__figure {
  margin: 0;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.image-viewer__figure img {
  max-width: 100%;
  max-height: 78vh;
  object-fit: contain;
  border-radius: 4px;
}
.image-viewer__figure figcaption {
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  text-align: center;
}
.image-viewer__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 6px;
}
.image-viewer__nav--prev { left: 10px; }
.image-viewer__nav--next { right: 10px; }
.image-viewer__counter {
  position: absolute;
  bottom: calc(16px + env(safe-area-inset-bottom));
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}
</style>
