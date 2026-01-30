<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../utils/date'
import { extractEntryVideo, getPlatformLabel, getPlatformColor } from '../../composables/useVideoExtractor'
import { getEntryPlaceholderColor, getEntryInitial } from '../../composables/useImageExtractor'
import type { Entry } from '../../types'

const props = defineProps<{
  entry: Entry
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'select', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
}>()

const thumbnailLoaded = ref(false)
const thumbnailError = ref(false)

const videoInfo = computed(() => extractEntryVideo(props.entry))
const placeholderColor = computed(() => getEntryPlaceholderColor(props.entry.id))
const initial = computed(() => getEntryInitial(props.entry.title))
const platformLabel = computed(() => videoInfo.value ? getPlatformLabel(videoInfo.value.platform) : '')
const platformColor = computed(() => videoInfo.value ? getPlatformColor(videoInfo.value.platform) : '#666')

const showPlaceholder = computed(() =>
  !videoInfo.value?.thumbnail || thumbnailError.value
)

function handleThumbnailLoad() {
  thumbnailLoaded.value = true
}

function handleThumbnailError() {
  thumbnailError.value = true
}
</script>

<template>
  <div
    class="video-card relative rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[0_4px_12px_rgba(15,17,21,0.06)] transition-all duration-200 cursor-pointer group"
    :class="{
      'border-[var(--accent)]! border-2! shadow-[0_8px_24px_rgba(255,122,24,0.25)]!': active,
      'hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_8px_20px_rgba(15,17,21,0.12)] hover:-translate-y-0.5': !active
    }"
    @click="emit('select', entry.id)"
  >
    <!-- Video Thumbnail (16:9 aspect ratio) -->
    <div class="relative w-full pt-[56.25%] bg-[var(--bg-elevated)]">
      <!-- Thumbnail Image -->
      <img
        v-if="videoInfo?.thumbnail && !thumbnailError"
        :src="videoInfo.thumbnail"
        :alt="entry.title || ''"
        loading="lazy"
        decoding="async"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        :class="{ 'opacity-0': !thumbnailLoaded }"
        @load="handleThumbnailLoad"
        @error="handleThumbnailError"
      />

      <!-- Placeholder -->
      <div
        v-if="showPlaceholder"
        class="absolute inset-0 flex items-center justify-center"
        :style="{ backgroundColor: placeholderColor }"
      >
        <span class="text-white text-4xl font-bold opacity-80">{{ initial }}</span>
      </div>

      <!-- Loading skeleton -->
      <div
        v-if="videoInfo?.thumbnail && !thumbnailLoaded && !thumbnailError"
        class="absolute inset-0 bg-[var(--bg-elevated)] animate-pulse"
      />

      <!-- Play Button Overlay -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
          <svg class="w-6 h-6 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      </div>

      <!-- Platform Badge -->
      <div
        v-if="videoInfo"
        class="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-medium text-white"
        :style="{ backgroundColor: platformColor }"
      >
        {{ platformLabel }}
      </div>

      <!-- Unread indicator -->
      <div
        v-if="!entry.read"
        class="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_2px_6px_rgba(255,122,24,0.5)]"
      />

      <!-- Star button -->
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
      <h3 class="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--text-primary)] m-0 mb-1">
        {{ entry.title || '未命名视频' }}
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
