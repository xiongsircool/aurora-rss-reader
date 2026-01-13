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
  <div class="details__header">
    <p class="muted">{{ entry.feed_title }}</p>
    <h2>{{ showTranslatedTitle && translatedTitle ? translatedTitle : entry.title }}</h2>
    <p class="muted">
      {{ entry.author || '未知作者' }} · {{ formatDate(entry.published_at) }}
    </p>
  </div>
</template>

<style scoped>
.details__header {
  margin-bottom: 12px;
}

.details__header h2 {
  margin: 8px 0;
  font-size: 1.5rem;
  line-height: 1.3;
  word-break: break-word;
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
  margin: 0;
}
</style>
