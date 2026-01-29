<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate } from '../../utils/date'
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

const imageLoaded = ref(false)
const imageError = ref(false)

const imageUrl = computed(() => props.entry.image_url)
const placeholderColor = computed(() => getEntryPlaceholderColor(props.entry.id))
const initial = computed(() => getEntryInitial(props.entry.title))
const hasAudio = computed(() => !!props.entry.enclosure_url)

// Format duration (supports HH:MM:SS or seconds)
const formattedDuration = computed(() => {
  const dur = props.entry.duration
  if (!dur) return null

  // Already formatted (HH:MM:SS or MM:SS)
  if (dur.includes(':')) return dur

  // Seconds to MM:SS or HH:MM:SS
  const secs = parseInt(dur, 10)
  if (isNaN(secs)) return dur

  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${mins}:${s.toString().padStart(2, '0')}`
})

// Format file size
const formattedSize = computed(() => {
  const len = props.entry.enclosure_length
  if (!len) return null

  if (len < 1024 * 1024) {
    return `${(len / 1024).toFixed(0)} KB`
  }
  return `${(len / (1024 * 1024)).toFixed(1)} MB`
})

const showPlaceholder = computed(() => !imageUrl.value || imageError.value)

function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError() {
  imageError.value = true
}
</script>

<template>
  <div
    class="audio-card relative rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[0_4px_12px_rgba(15,17,21,0.06)] transition-all duration-200 cursor-pointer group"
    :class="{
      'border-[var(--accent)]! border-2! shadow-[0_8px_24px_rgba(255,122,24,0.25)]!': active,
      'hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_8px_20px_rgba(15,17,21,0.12)] hover:-translate-y-0.5': !active
    }"
    @click="emit('select', entry.id)"
  >
    <div class="flex gap-3 p-3">
      <!-- Album Art -->
      <div class="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[var(--bg-elevated)]">
        <img
          v-if="imageUrl && !imageError"
          :src="imageUrl"
          :alt="entry.title || ''"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover"
          :class="{ 'opacity-0': !imageLoaded }"
          @load="handleImageLoad"
          @error="handleImageError"
        />

        <!-- Placeholder -->
        <div
          v-if="showPlaceholder"
          class="absolute inset-0 flex items-center justify-center"
          :style="{ backgroundColor: placeholderColor }"
        >
          <span class="text-white text-xl font-bold opacity-80">{{ initial }}</span>
        </div>

        <!-- Play icon overlay -->
        <div
          v-if="hasAudio"
          class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div class="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
            <svg class="w-4 h-4 text-[var(--accent)] ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>

        <!-- Unread indicator -->
        <div
          v-if="!entry.read"
          class="absolute top-1 left-1 w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_1px_4px_rgba(255,122,24,0.5)]"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <h3 class="text-[13px] font-medium leading-snug line-clamp-2 text-[var(--text-primary)] m-0">
          {{ entry.title || '未命名音频' }}
        </h3>

        <div class="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
          <span class="truncate max-w-[40%]">{{ entry.feed_title }}</span>
          <span>·</span>
          <span class="shrink-0">{{ formatDate(entry.published_at, entry.inserted_at) }}</span>
        </div>
      </div>

      <!-- Star button -->
      <button
        class="self-start shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgba(255,190,48,0.1)]"
        :class="{ 'opacity-100!': entry.starred }"
        @click.stop="emit('toggle-star', entry)"
      >
        <span :class="entry.starred ? 'text-[#ffbe30]' : 'text-[var(--text-tertiary)]'">
          {{ entry.starred ? '★' : '☆' }}
        </span>
      </button>
    </div>

    <!-- Audio meta bar -->
    <div
      v-if="hasAudio && (formattedDuration || formattedSize)"
      class="flex items-center gap-3 px-3 py-2 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] text-[11px] text-[var(--text-secondary)]"
    >
      <!-- Duration -->
      <div v-if="formattedDuration" class="flex items-center gap-1">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{{ formattedDuration }}</span>
      </div>

      <!-- File size -->
      <div v-if="formattedSize" class="flex items-center gap-1">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>{{ formattedSize }}</span>
      </div>

      <!-- Audio type badge -->
      <div class="ml-auto px-1.5 py-0.5 rounded bg-[rgba(255,122,24,0.15)] text-[10px] font-medium text-[var(--accent)]">
        {{ entry.enclosure_type?.includes('mpeg') ? 'MP3' : 'Audio' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
