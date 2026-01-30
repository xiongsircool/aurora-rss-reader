<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LogoMark from '../LogoMark.vue'

defineProps<{
  darkMode: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'go-back'): void
}>()

const { t } = useI18n()
</script>

<template>
  <header class="h-[60px] flex items-center justify-between px-5 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
    <div class="flex items-center gap-3">
      <LogoMark :size="32" />
      <h1 class="text-lg font-semibold">{{ t('workspace.title') }}</h1>
    </div>

    <div class="flex items-center gap-2">
      <button
        @click="emit('toggle-theme')"
        class="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        :title="darkMode ? t('layout.themeToggleTitle') : t('layout.themeToggleTitleDark')"
      >
        <svg v-if="darkMode" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
        </svg>
        <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8z" />
        </svg>
      </button>

      <button
        @click="emit('go-back')"
        class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm c-[var(--accent)] hover:bg-[rgba(255,122,24,0.1)] transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {{ t('workspace.backToReader') }}
      </button>
    </div>
  </header>
</template>
