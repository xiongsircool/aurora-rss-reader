<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Entry } from '../../types'

defineProps<{
  entry: Entry
  active: boolean
  showTranslation: boolean
  translatedTitle: string | null
  isTranslationLoading: boolean
  titleDisplayMode: string
  translationLanguageLabel: string
  showSummary: boolean
}>()

const emit = defineEmits<{
  (e: 'select', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
}>()

const { t } = useI18n()

function formatDate(date?: string | null) {
  if (!date) return '未知时间'
  // Simple relative time - would use dayjs in real implementation
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function getEntryPreview(entry: Entry): string {
  const summary = entry.summary?.trim()
  if (summary) return summary
  const content = entry.content || ''
  const temp = document.createElement('div')
  temp.innerHTML = content
  const text = temp.textContent || temp.innerText || ''
  return text.replace(/\s+/g, ' ').trim() || t('ai.noSummary')
}
</script>

<template>
  <div :class="['entry-card', { active, unread: !entry.read }]">
    <button class="entry-card__main" @click="emit('select', entry.id)">
      <!-- Title display area -->
      <template v-if="showTranslation && translatedTitle">
        <!-- Mode 1: Replace - show translation only -->
        <div v-if="titleDisplayMode === 'replace'" class="entry-card__title">
          {{ translatedTitle }}
        </div>
        
        <!-- Mode 2: Translation first -->
        <template v-else-if="titleDisplayMode === 'translation-first'">
          <div class="entry-card__title">{{ translatedTitle }}</div>
          <div class="entry-card__original-title">
            <span class="original-icon">🌐</span>
            {{ entry.title || '未命名文章' }}
          </div>
        </template>
        
        <!-- Mode 3: Original first (default) -->
        <template v-else>
          <div class="entry-card__title">{{ entry.title || '未命名文章' }}</div>
          <div class="entry-card__translated-title">
            <span class="translation-label">{{ t('articles.translationLabel', { language: translationLanguageLabel }) }}</span>
            {{ translatedTitle }}
          </div>
        </template>
      </template>
      
      <!-- No translation or loading -->
      <template v-else>
        <div class="entry-card__title">{{ entry.title || '未命名文章' }}</div>
        <div v-if="showTranslation && isTranslationLoading" class="entry-card__translated-title">
          <span class="loading-indicator">{{ t('articles.translatingTitle') }}</span>
        </div>
      </template>
      
      <div class="entry-card__meta">
        <span>{{ entry.feed_title }}</span>
        <span>{{ t('articles.timeSeparator') }}</span>
        <span>{{ formatDate(entry.published_at) }}</span>
      </div>
      <p v-if="showSummary" class="entry-card__summary">
        {{ getEntryPreview(entry) }}
      </p>
    </button>
    <button
      class="entry-card__star"
      @click.stop="emit('toggle-star', entry)"
      :title="entry.starred ? '取消收藏' : '收藏'"
    >
      {{ entry.starred ? '★' : '☆' }}
    </button>
  </div>
</template>

<style scoped>
.entry-card {
  border: 1px solid var(--border-color);
  text-align: left;
  padding: clamp(12px, 1.5vw, 16px);
  border-radius: 16px;
  background: var(--bg-surface);
  display: flex;
  align-items: flex-start;
  gap: clamp(10px, 0.8vw, 14px);
  color: var(--text-primary);
  box-shadow: 0 4px 14px rgba(15, 17, 21, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;
  min-width: 0;
}

.entry-card:hover {
  border-color: rgba(255, 122, 24, 0.4);
  box-shadow: 0 14px 28px rgba(15, 17, 21, 0.12);
  transform: translateY(-2px);
}

.entry-card__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  color: inherit;
  font: inherit;
  min-width: 0;
}

.entry-card__star {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  color: #ffbe30;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.entry-card__star:hover {
  background: rgba(255, 190, 48, 0.1);
  transform: scale(1.1);
}

.entry-card.unread {
  border-color: var(--accent);
}

.entry-card.active {
  border-color: var(--accent);
  box-shadow: 0 14px 32px rgba(255, 122, 24, 0.2);
  background: rgba(255, 122, 24, 0.06);
}

.entry-card__title {
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.entry-card__meta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 2px;
  min-width: 0;
}

.entry-card__summary {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: clamp(4.2em, 6vw, 6.3em);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.entry-card__translated-title {
  margin-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.translation-label {
  display: inline-flex;
  align-items: center;
  height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid rgba(255, 122, 24, 0.35);
  background: rgba(255, 122, 24, 0.14);
  color: #ff7a18;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
}

.loading-indicator {
  display: inline-block;
  color: var(--text-secondary);
  font-style: italic;
  animation: pulse 1.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.entry-card__original-title {
  margin-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.original-icon {
  font-size: 0.75rem;
  opacity: 0.7;
}

:global(.dark) .entry-card__translated-title {
  color: rgba(255, 255, 255, 0.75);
}

:global(.dark) .translation-label {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffe4d3;
}

:global(.dark) .entry-card__original-title {
  color: rgba(255, 255, 255, 0.6);
}
</style>
