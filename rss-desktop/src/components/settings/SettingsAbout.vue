<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="mb-6 px-5 py-4.5 rounded-3.5 bg-[#f8faff] dark:bg-white/4 border border-[rgba(76,116,255,0.08)] dark:border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600">{{ t('settings.about') }}</h3>
    <div class="bg-gradient-to-br from-[rgba(255,122,24,0.05)] to-[rgba(88,86,214,0.05)] rounded-3 p-5 border border-[var(--border-color)]">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-3">
        <h4 class="m-0 text-5 font-700 bg-gradient-to-r from-[#ff7a18] to-[#5856d6] bg-clip-text text-transparent">{{ t('settings.appName', { name: 'Aurora Feeds' }) }}</h4>
        <span class="inline-block py-1 px-2.5 bg-[rgba(0,122,255,0.1)] dark:bg-[rgba(0,122,255,0.15)] text-[#007aff] dark:text-[#71b3ff] text-3 font-600 rounded-1.5 border border-[rgba(0,122,255,0.2)] dark:border-[rgba(0,122,255,0.35)]">{{ t('settings.appVersion', { version: '0.1.3' }) }}</span>
      </div>
      
      <!-- App name note -->
      <p class="mt-2 mb-0 text-3.25 text-[var(--settings-muted)]">{{ t('settings.appNameDescription', { name: 'Aurora Feeds' }) }}</p>
      
      <!-- Description -->
      <p class="text-3.5 text-[var(--text-primary)] leading-relaxed m-0 mb-4">{{ t('settings.aboutDescription') }}</p>
      
      <!-- Features -->
      <div class="flex flex-wrap gap-2 mb-4">
        <span class="inline-flex items-center py-1.5 px-3 bg-[var(--bg-surface)] dark:bg-white/4 border border-[var(--border-color)] dark:border-white/12 rounded-5 text-3 text-[var(--text-secondary)] font-500 transition-all duration-200 hover:translate-y--0.25 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-[var(--accent)]">📰 {{ t('settings.features.rss') }}</span>
        <span class="inline-flex items-center py-1.5 px-3 bg-[var(--bg-surface)] dark:bg-white/4 border border-[var(--border-color)] dark:border-white/12 rounded-5 text-3 text-[var(--text-secondary)] font-500 transition-all duration-200 hover:translate-y--0.25 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-[var(--accent)]">🤖 {{ t('settings.features.ai') }}</span>
        <span class="inline-flex items-center py-1.5 px-3 bg-[var(--bg-surface)] dark:bg-white/4 border border-[var(--border-color)] dark:border-white/12 rounded-5 text-3 text-[var(--text-secondary)] font-500 transition-all duration-200 hover:translate-y--0.25 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-[var(--accent)]">🌐 {{ t('settings.features.translation') }}</span>
        <span class="inline-flex items-center py-1.5 px-3 bg-[var(--bg-surface)] dark:bg-white/4 border border-[var(--border-color)] dark:border-white/12 rounded-5 text-3 text-[var(--text-secondary)] font-500 transition-all duration-200 hover:translate-y--0.25 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-[var(--accent)]">⭐ {{ t('settings.features.favorites') }}</span>
      </div>
      
      <!-- Links -->
      <div class="flex flex-col gap-2.5 mb-4">
        <a href="https://github.com/xiongsircool/aurora-rss-reader" target="_blank" class="flex items-center gap-2 py-2.5 px-3.5 bg-white dark:bg-[rgba(0,0,0,0.3)] border border-[rgba(92,106,138,0.16)] dark:border-white/15 rounded-2.5 text-[#0f1419] dark:text-[var(--text-primary)] no-underline text-3.5 font-500 transition-all duration-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:border-[#4c74ff] hover:bg-[rgba(76,116,255,0.08)] dark:hover:bg-white/10 hover:translate-x-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="shrink-0 opacity-70">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          {{ t('settings.projectHomepage') }}
        </a>
        <a href="https://github.com/xiongsircool/aurora-rss-reader/issues" target="_blank" class="flex items-center gap-2 py-2.5 px-3.5 bg-white dark:bg-[rgba(0,0,0,0.3)] border border-[rgba(92,106,138,0.16)] dark:border-white/15 rounded-2.5 text-[#0f1419] dark:text-[var(--text-primary)] no-underline text-3.5 font-500 transition-all duration-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:border-[#4c74ff] hover:bg-[rgba(76,116,255,0.08)] dark:hover:bg-white/10 hover:translate-x-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="shrink-0 opacity-70">
            <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zM8 4a.905.905 0 00-.9.995l.35 3.507a.552.552 0 001.1 0l.35-3.507A.905.905 0 008 4z"/>
          </svg>
          {{ t('settings.feedbackIssue') }}
        </a>
      </div>
      
      <!-- Footer -->
      <p class="m-0 pt-4 border-t border-[var(--border-color)] text-3.25 text-[var(--text-secondary)] text-center italic">Made with ❤️ using Vue 3 + FastAPI</p>
    </div>
  </section>
</template>
