<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSanitize } from '../../composables/useSanitize'
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
const { sanitize } = useSanitize()

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
  
  // Sanitize content before creating DOM element to avoid XSS during preview generation
  // Although creating an element and not appending it is generally safe-ish, 
  // explicitly sanitizing is better practice.
  const sanitized = sanitize(content)
  
  const temp = document.createElement('div')
  temp.innerHTML = sanitized
  const text = temp.textContent || temp.innerText || ''
  return text.replace(/\s+/g, ' ').trim() || t('ai.noSummary')
}
</script>

<template>
  <div 
    class="border border-[var(--border-color)] text-left p-[clamp(12px,1.5vw,16px)] rounded-2xl bg-[var(--bg-surface)] flex items-start gap-[clamp(10px,0.8vw,14px)] c-[var(--text-primary)] shadow-[0_4px_14px_rgba(15,17,21,0.05)] transition-all duration-200 ease min-w-0 hover:border-[rgba(255,122,24,0.4)] hover:shadow-[0_8px_20px_rgba(15,17,21,0.1)] hover:-translate-y-0.5 relative group"
    :class="{ 
      'border-[var(--accent)]! border-2! shadow-[0_4px_20px_rgba(255,122,24,0.25)]!': active,
      'border-l-[var(--accent)] border-l-3': !active && !entry.read
    }"
  >
    <button class="flex-1 flex flex-col gap-1.5 cursor-pointer bg-transparent border-none p-0 text-left c-inherit font-inherit min-w-0" @click="emit('select', entry.id)">
      <!-- Title display area -->
      <template v-if="showTranslation && translatedTitle">
        <!-- Mode 1: Replace - show translation only -->
        <div v-if="titleDisplayMode === 'replace'" class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]">
          {{ translatedTitle }}
        </div>
        
        <!-- Mode 2: Translation first -->
        <template v-else-if="titleDisplayMode === 'translation-first'">
          <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]">{{ translatedTitle }}</div>
          <div class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)] italic dark:c-white/60">
            <span class="text-[0.75rem] op-70">🌐</span>
            {{ entry.title || '未命名文章' }}
          </div>
        </template>
        
        <!-- Mode 3: Original first (default) -->
        <template v-else>
          <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]">{{ entry.title || '未命名文章' }}</div>
          <div class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)] dark:c-white/75">
            <span class="inline-flex items-center h-[1.35rem] px-[0.45rem] rounded-full text-[0.72rem] tracking-wider font-semibold uppercase border border-[rgba(255,122,24,0.35)] bg-[rgba(255,122,24,0.14)] c-[#ff7a18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:bg-white/10 dark:border-white/25 dark:c-[#ffe4d3]">{{ t('articles.translationLabel', { language: translationLanguageLabel }) }}</span>
            {{ translatedTitle }}
          </div>
        </template>
      </template>
      
      <!-- No translation or loading -->
      <template v-else>
        <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]">{{ entry.title || '未命名文章' }}</div>
        <div v-if="showTranslation && isTranslationLoading" class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)]">
          <span class="inline-block c-[var(--text-secondary)] italic animate-pulse">{{ t('articles.translatingTitle') }}</span>
        </div>
      </template>
      
      <div class="text-xs c-[var(--text-secondary)] flex gap-1.5 items-center flex-wrap gap-y-0.5 min-w-0">
        <span>{{ entry.feed_title }}</span>
        <span>{{ t('articles.timeSeparator') }}</span>
        <span>{{ formatDate(entry.published_at) }}</span>
      </div>
      <p v-if="showSummary" class="c-[var(--text-secondary)] text-sm leading-relaxed line-clamp-3 break-words [overflow-wrap:anywhere] max-h-[clamp(4.2em,6vw,6.3em)] m-0">
        {{ getEntryPreview(entry) }}
      </p>
    </button>
    <button
      class="bg-transparent border-none p-1 rounded-md cursor-pointer text-lg c-[#ffbe30] transition-all shrink-0 mt-0.5 hover:bg-[rgba(255,190,48,0.1)] hover:scale-110"
      @click.stop="emit('toggle-star', entry)"
      :title="entry.starred ? '取消收藏' : '收藏'"
    >
      {{ entry.starred ? '★' : '☆' }}
    </button>
  </div>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
