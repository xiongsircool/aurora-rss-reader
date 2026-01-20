<script setup lang="ts">
import type { Entry } from '../../types'

defineProps<{
  entry: Entry
  showTranslatedTitle: boolean
  translatedTitle: string | null
}>()

function formatDate(date?: string | null) {
  if (!date) return '未知时间'
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
</script>

<template>
  <div class="mb-3">
    <p class="c-[var(--text-secondary)] text-xs m-0">{{ entry.feed_title }}</p>
    <h2 class="my-2 text-2xl leading-tight break-words">{{ showTranslatedTitle && translatedTitle ? translatedTitle : entry.title }}</h2>
    <p class="c-[var(--text-secondary)] text-xs m-0">
      {{ entry.author || '未知作者' }} · {{ formatDate(entry.published_at) }}
    </p>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
