<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSanitize } from '../../composables/useSanitize'
import { formatDate } from '../../utils/date'
import type { Entry } from '../../types'

const props = defineProps<{
  entry: Entry
  active: boolean
  showTranslation: boolean
  translatedTitle: string | null
  isTranslationLoading: boolean
  isTranslationFailed: boolean
  titleDisplayMode: string
  translationLanguageLabel: string
  showSummary: boolean
}>()

const emit = defineEmits<{
  (e: 'select', entryId: string): void
  (e: 'toggle-star', entry: Entry): void
  (e: 'toggle-read', entry: Entry): void
  (e: 'add-to-collection', entry: Entry): void
  (e: 'copy-link', entry: Entry): void
  (e: 'open-external', entry: Entry): void
}>()

const { t } = useI18n()
const { sanitize, sanitizeTitle } = useSanitize()

// Context menu state
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const CLOSE_EVENT = 'entry-context-menu:close-all'

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT))

  const menuWidth = 220
  const menuHeight = 280
  let x = e.clientX
  let y = e.clientY

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }

  contextMenuPos.value = { x, y }
  requestAnimationFrame(() => {
    showContextMenu.value = true
  })
}

function closeContextMenu() {
  showContextMenu.value = false
}

function handleGlobalClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.entry-context-menu')) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  window.addEventListener(CLOSE_EVENT, closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  window.removeEventListener(CLOSE_EVENT, closeContextMenu)
})

const safeTitle = computed(() => sanitizeTitle(props.entry.title))
const safeTranslatedTitle = computed(() => sanitizeTitle(props.translatedTitle))

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
      'border-l-2 border-l-[rgba(255,122,24,0.85)] dark:border-l-[rgba(255,138,61,0.9)]': !active && !entry.read
    }"
    @contextmenu="handleContextMenu"
  >
    <button class="flex-1 flex flex-col gap-1.5 cursor-pointer bg-transparent border-none p-0 text-left c-inherit font-inherit min-w-0" @click="emit('select', entry.id)">
      <!-- Title display area -->
      <template v-if="showTranslation && translatedTitle">
        <!-- Mode 1: Replace - show translation only -->
        <div v-if="titleDisplayMode === 'replace'" class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]" v-html="safeTranslatedTitle"></div>

        <!-- Mode 2: Translation first -->
        <template v-else-if="titleDisplayMode === 'translation-first'">
          <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]" v-html="safeTranslatedTitle"></div>
          <div class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)] italic dark:c-white/60">
            <span class="text-[0.75rem] op-70">🌐</span>
            <span v-html="safeTitle || '未命名文章'"></span>
          </div>
        </template>

        <!-- Mode 3: Original first (default) -->
        <template v-else>
          <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]" v-html="safeTitle || '未命名文章'"></div>
          <div class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)] dark:c-white/75">
            <span class="inline-flex items-center h-[1.35rem] px-[0.45rem] rounded-full text-[0.72rem] tracking-wider font-semibold uppercase border border-[rgba(255,122,24,0.35)] bg-[rgba(255,122,24,0.14)] c-[#ff7a18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:bg-white/10 dark:border-white/25 dark:c-[#ffe4d3]">{{ t('articles.translationLabel', { language: translationLanguageLabel }) }}</span>
            <span v-html="safeTranslatedTitle"></span>
          </div>
        </template>
      </template>

      <!-- No translation or loading -->
      <template v-else>
        <div class="font-semibold leading-relaxed break-words [overflow-wrap:anywhere]" v-html="safeTitle || '未命名文章'"></div>
        <div v-if="showTranslation && isTranslationLoading" class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[var(--text-secondary)]">
          <span class="inline-block c-[var(--text-secondary)] italic animate-pulse">{{ t('articles.translatingTitle') }}</span>
        </div>
        <div v-else-if="showTranslation && isTranslationFailed" class="mt-1.5 flex items-center gap-1.5 text-[0.85rem] c-[#c43838]">
          <span class="inline-block italic">{{ t('ai.titleTranslationFailed') }}</span>
        </div>
      </template>
      
      <div class="text-xs c-[var(--text-secondary)] flex gap-1.5 items-center flex-wrap gap-y-0.5 min-w-0">
        <span
          v-if="!entry.read"
          class="inline-flex items-center gap-1 text-[0.7rem] font-medium c-[var(--accent)] shrink-0"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] op-80"></span>
          {{ t('navigation.unread') }}
        </span>
        <span>{{ entry.feed_title }}</span>
        <span>{{ t('articles.timeSeparator') }}</span>
        <span>{{ formatDate(entry.published_at, entry.inserted_at) }}</span>
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

  <!-- Context Menu -->
  <Teleport to="body">
    <div
      v-if="showContextMenu"
      class="entry-context-menu fixed z-[9999] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] py-1.5 min-w-[200px]"
      :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }"
    >
      <!-- Toggle Read -->
      <button
        @click="emit('toggle-read', entry); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path v-if="entry.read" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="entry.read" cx="12" cy="12" r="3"/>
          <polyline v-else points="20 6 9 17 4 12"/>
        </svg>
        <span>{{ entry.read ? t('articles.markAsUnread') : t('articles.markAsRead') }}</span>
      </button>

      <!-- Toggle Star -->
      <button
        @click="emit('toggle-star', entry); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" :fill="entry.starred ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>{{ entry.starred ? t('articles.unstar') : t('articles.star') }}</span>
      </button>

      <div class="h-px bg-[var(--border-color)] my-1.5"></div>

      <!-- Add to Collection -->
      <button
        @click="emit('add-to-collection', entry); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        <span>{{ t('collections.addTo') }}</span>
      </button>

      <div class="h-px bg-[var(--border-color)] my-1.5"></div>

      <!-- Copy Link -->
      <button
        @click="emit('copy-link', entry); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span>{{ t('articles.copyLink') }}</span>
      </button>

      <!-- Open External -->
      <button
        @click="emit('open-external', entry); closeContextMenu()"
        class="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,122,24,0.1)] transition-colors c-[var(--text-primary)]"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <span>{{ t('articles.openInBrowser') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
