<script setup lang="ts">
import { Bookmark, ExternalLink, Share2 } from 'lucide-vue-next'

defineProps<{
  saved: boolean
  originalUrl: string | null
  progress?: number
}>()

const emit = defineEmits<{
  (event: 'toggle-saved'): void
  (event: 'open-original'): void
  (event: 'share'): void
}>()
</script>

<template>
  <div class="reader-actions-wrap">
    <p v-if="progress !== undefined" class="reader-progress-label">{{ progress }}% read</p>
    <div class="reader-actions">
      <button class="reader-action" type="button" @click="emit('toggle-saved')">
        <Bookmark :size="18" :fill="saved ? 'currentColor' : 'none'" />
        <span>{{ saved ? 'Saved' : 'Save' }}</span>
      </button>
      <button class="reader-action" type="button" @click="emit('share')">
        <Share2 :size="18" />
        <span>Share</span>
      </button>
      <button class="reader-action" type="button" :disabled="!originalUrl" @click="emit('open-original')">
        <ExternalLink :size="18" />
        <span>Original</span>
      </button>
    </div>
  </div>
</template>
