<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string | null
    faviconUrl?: string | null
    size?: number
  }>(),
  { faviconUrl: null, size: 36 },
)

// Show the favicon when available; otherwise fall back to an initial-letter
// circle with a deterministic color derived from the source name (matches the
// colored source avatars in the mobile design spec).
const faviconFailed = ref(false)
const showFavicon = computed(() => !!props.faviconUrl && !faviconFailed.value)

const initial = computed(() => {
  const trimmed = (props.name ?? '').trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
})

const PALETTE = ['#2f8f83', '#c8842c', '#6a7fd2', '#b94d6e', '#5aa15a', '#9b6dd0', '#3a93c4', '#c2683f']

const bg = computed(() => {
  const key = props.name ?? '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
})

const dimension = computed(() => `${props.size}px`)
const fontSize = computed(() => `${Math.round(props.size * 0.42)}px`)
</script>

<template>
  <span class="source-avatar" :style="{ width: dimension, height: dimension }">
    <img
      v-if="showFavicon"
      :src="faviconUrl!"
      :alt="name || ''"
      loading="lazy"
      decoding="async"
      @error="faviconFailed = true"
    >
    <span v-else class="source-avatar__initial" :style="{ background: bg, fontSize }">{{ initial }}</span>
  </span>
</template>

<style scoped>
.source-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 999px;
  overflow: hidden;
  background: var(--color-elevated);
}
.source-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.source-avatar__initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-weight: 600;
  line-height: 1;
}
</style>
