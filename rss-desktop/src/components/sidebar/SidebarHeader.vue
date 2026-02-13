<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LogoMark from '../LogoMark.vue'

defineProps<{
  logoSize: number
  darkMode: boolean
  compact: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'reset-layout'): void
  (e: 'toggle-compact'): void
  (e: 'open-add-feed'): void
  (e: 'open-more-menu'): void
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Compact Header -->
  <header v-if="compact" class="flex items-center gap-1.5 mb-2">
    <LogoMark class="shrink-0" :size="28" />
    <div class="flex-1" />

    <!-- Add Feed button -->
    <button
      @click="emit('open-add-feed')"
      class="icon-btn"
      :title="t('sidebar.addFeed')"
    >
      <svg class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>

    <!-- More menu button -->
    <button
      @click="emit('open-more-menu')"
      class="icon-btn"
      :title="t('sidebar.moreActions')"
    >
      <svg class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
      </svg>
    </button>

    <!-- Theme toggle -->
    <button
      @click="emit('toggle-theme')"
      class="icon-btn"
      :title="darkMode ? t('layout.themeToggleTitle') : t('layout.themeToggleTitleDark')"
    >
      <svg v-if="darkMode" class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
      </svg>
      <svg v-else class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8z"/>
      </svg>
    </button>

    <!-- Settings -->
    <button @click="emit('open-settings')" class="icon-btn" :title="t('layout.settingsTitle')">
      <svg class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l-.01.08a2 2 0 1 1-3.32 0l-.01-.08a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1 1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.08.01a2 2 0 1 1 0-3.32l.08-.01a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1 .33 1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82l.01-.08a2 2 0 1 1 3.32 0l.01.08a1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1 .65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.82.33l.08-.01a2 2 0 1 1 0 3.32l-.08.01a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.6 1z"/>
      </svg>
    </button>

    <!-- Density toggle (expand) -->
    <button
      @click="emit('toggle-compact')"
      class="icon-btn"
      :title="t('sidebar.expanded')"
    >
      <svg class="w-[18px] h-[18px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </header>

  <!-- Expanded Header (current design) -->
  <header v-else class="flex justify-between items-center mb-3 gap-3">
    <div class="flex items-start gap-[clamp(8px,1vw,14px)] flex-1">
      <LogoMark class="shrink-0" :size="logoSize" />
      <div>
        <h1 class="text-[clamp(16px,1.6vw,20px)] mb-1 leading-tight">{{ t('common.appName') }}</h1>
        <p class="c-[var(--text-secondary)] text-xs text-[clamp(11px,1.2vw,13px)] leading-snug m-0">{{ t('common.local') }} {{ t('common.private') }} · {{ t('common.ai') }} {{ t('common.smart') }} {{ t('common.reading') }} {{ t('common.platform') }}</p>
      </div>
    </div>
    <div class="flex gap-1 self-start -mt-1">
      <!-- Density toggle (compact) -->
      <button
        @click="emit('toggle-compact')"
        class="icon-btn"
        :title="t('sidebar.compact')"
      >
        <svg class="w-[17px] h-[17px] block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/>
        </svg>
      </button>
      <button
        @click="emit('toggle-theme')" 
        class="icon-btn"
        :title="darkMode ? t('layout.themeToggleTitle') : t('layout.themeToggleTitleDark')"
      >
        <svg
          v-if="darkMode"
          class="w-5 h-5 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
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
        <svg
          v-else
          class="w-5 h-5 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8z" />
        </svg>
      </button>
      <button @click="emit('open-settings')" class="icon-btn" :title="t('layout.settingsTitle')">
        <svg
          class="w-5 h-5 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l-.01.08a2 2 0 1 1-3.32 0l-.01-.08a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1 1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.08.01a2 2 0 1 1 0-3.32l.08-.01a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1 .33 1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82l.01-.08a2 2 0 1 1 3.32 0l.01.08a1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1 .65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.82.33l.08-.01a2 2 0 1 1 0 3.32l-.08.01a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.6 1z"
          />
        </svg>
      </button>
      <button @click="emit('reset-layout')" class="icon-btn" :title="t('layout.resetLayoutTitle')">
        <svg
          class="w-5 h-5 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M3 10h18" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.icon-btn {
  border: none;
  background: transparent;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background-color 0.2s, color 0.2s;
  color: var(--text-primary);
}
.icon-btn:hover {
  background: rgba(255, 122, 24, 0.1);
  color: var(--accent);
}
:global(.dark) .icon-btn {
  color: rgba(255, 255, 255, 0.9);
}
:global(.dark) .icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffe5d0;
}
</style>
