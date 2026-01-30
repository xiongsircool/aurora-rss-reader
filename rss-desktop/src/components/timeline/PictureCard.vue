<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../utils/date'
import { extractEntryImage, getEntryPlaceholderColor, getEntryInitial } from '../../composables/useImageExtractor'
import type { Entry } from '../../types'

const props = defineProps<{
  entry: Entry
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'select', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
}>()

const imageLoaded = ref(false)
const imageError = ref(false)

const imageUrl = computed(() => extractEntryImage(props.entry))
const placeholderColor = computed(() => getEntryPlaceholderColor(props.entry.id))
const initial = computed(() => getEntryInitial(props.entry.title))

function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError() {
  imageError.value = true
}

const showPlaceholder = computed(() => !imageUrl.value || imageError.value)
</script>

<template>
  <div
    class="picture-card relative rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[0_4px_12px_rgba(15,17,21,0.06)] transition-all duration-200 cursor-pointer group"
    :class="{
      'border-[var(--accent)]! border-2! shadow-[0_8px_24px_rgba(255,122,24,0.25)]!': active,
      'hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_8px_20px_rgba(15,17,21,0.12)] hover:-translate-y-0.5': !active
    }"
    @click="emit('select', entry.id)"
  >
    <!-- Image Container (1:1 aspect ratio) -->
    <div class="relative w-full pt-[100%] bg-[var(--bg-elevated)]">
      <!-- Actual Image -->
      <img
        v-if="imageUrl && !imageError"
        :src="imageUrl"
        :alt="entry.title || ''"
        loading="lazy"
        decoding="async"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        :class="{ 'opacity-0': !imageLoaded }"
        @load="handleImageLoad"
        @error="handleImageError"
      />

      <!-- Placeholder (no image or error) -->
      <div
        v-if="showPlaceholder"
        class="absolute inset-0 flex items-center justify-center"
        :style="{ backgroundColor: placeholderColor }"
      >
        <span class="text-white text-3xl font-bold opacity-80">{{ initial }}</span>
      </div>

      <!-- Loading skeleton -->
      <div
        v-if="imageUrl && !imageLoaded && !imageError"
        class="absolute inset-0 bg-[var(--bg-elevated)] animate-pulse"
      />

      <!-- Unread indicator -->
      <div
        v-if="!entry.read"
        class="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_2px_6px_rgba(255,122,24,0.5)]"
      />

      <!-- Star button (show on hover) -->
      <button
        class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
        :class="{ 'opacity-100!': entry.starred }"
        @click.stop="emit('toggle-star', entry)"
      >
        <span :class="entry.starred ? 'text-[#ffbe30]' : 'text-white/80'">
          {{ entry.starred ? '★' : '☆' }}
        </span>
      </button>
    </div>

    <!-- Info Section -->
    <div class="p-2.5">
      <h3
        class="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--text-primary)] m-0 mb-1"
      >
        {{ entry.title || '未命名文章' }}
      </h3>
      <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
        <span class="truncate max-w-[60%]">{{ entry.feed_title }}</span>
        <span>·</span>
        <span class="shrink-0">{{ formatDate(entry.published_at, entry.inserted_at) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
