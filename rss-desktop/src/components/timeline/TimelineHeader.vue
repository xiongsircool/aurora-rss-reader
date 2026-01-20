<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  title: string
  subtitle: string
  showFavoritesOnly: boolean
  unreadCount?: number
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'back-to-feeds'): void
  (e: 'mark-all-read'): void
}>()

const { t } = useI18n()
</script>

<template>
  <header class="flex justify-between items-center px-[clamp(16px,2vw,22px)] py-[clamp(12px,1.5vw,18px)] border-b border-[var(--border-color)] gap-4 flex-wrap">
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <h2 class="m-0 text-xl font-bold">{{ title }}</h2>
      <p class="m-0 text-xs c-[var(--text-secondary)]">{{ subtitle }}</p>
    </div>
    <div class="flex gap-2.5 flex-wrap items-center justify-end">
      <!-- Mark All as Read Button -->
      <button 
        v-if="!showFavoritesOnly"
        class="inline-flex items-center gap-1.5 border-none rounded-full px-2.5 py-1.5 bg-[linear-gradient(120deg,#34c759,#30d158)] c-white text-xs font-semibold tracking-wide cursor-pointer shadow-[0_6px_16px_rgba(52,199,89,0.3)] dark:shadow-[0_8px_20px_rgba(52,199,89,0.25)] transition-all duration-200 hover:-translate-y-0.25 hover:shadow-[0_8px_20px_rgba(52,199,89,0.4)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(52,199,89,0.28)]"
        @click="emit('mark-all-read')"
        :title="t('articles.markAllAsRead')"
      >
        <span class="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.2)] inline-flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" class="w-4 h-4 text-white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
          </svg>
        </span>
        <span class="hidden sm:inline">{{ t('articles.markAllAsRead') }}</span>
      </button>

      <button class="inline-flex items-center gap-1.5 border-none rounded-full px-2.5 py-1.5 bg-[linear-gradient(120deg,#ff7a18,#ffbe30)] c-white text-xs font-semibold tracking-wide cursor-pointer shadow-[0_6px_16px_rgba(255,122,24,0.3)] dark:shadow-[0_8px_20px_rgba(255,122,24,0.25)] transition-all duration-200 hover:-translate-y-0.25 hover:shadow-[0_8px_20px_rgba(255,122,24,0.4)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(255,122,24,0.28)]" @click="emit('refresh')">
        <span class="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.2)] inline-flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" class="w-4 h-4 text-white">
            <path d="M4 4v6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M20 20v-6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M20 10a8 8 0 0 0-13.66-4.66L4 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M4 14a8 8 0 0 0 13.66 4.66L20 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </span>
        <span class="hidden sm:inline">{{ showFavoritesOnly ? t('navigation.refreshFavorites') : t('navigation.refreshSubscription') }}</span>
      </button>
      <button
        v-if="showFavoritesOnly"
        @click="emit('back-to-feeds')"
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 bg-[rgba(255,255,255,0.7)] dark:bg-[rgba(15,17,21,0.8)] c-[var(--text-primary)] text-xs font-semibold tracking-wide cursor-pointer shadow-[0_4px_14px_rgba(15,17,21,0.1)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.4)] border border-[rgba(15,17,21,0.08)] dark:border-[rgba(255,255,255,0.12)] pr-4 transition-transform duration-200 transition-shadow duration-200 hover:bg-white hover:-translate-y-0.25 hover:shadow-[0_6px_18px_rgba(15,17,21,0.15)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(255,122,24,0.28)]"
      >
        <span class="w-7 h-7 rounded-full bg-[rgba(15,17,21,0.08)] dark:bg-[rgba(255,255,255,0.08)] inline-flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" class="w-4 h-4 text-white">
            <path d="M8 5l-5 7 5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M21 12H4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </span>
        <span>{{ t('navigation.backToSubscription') }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>
