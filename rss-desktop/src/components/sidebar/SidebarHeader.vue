<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LogoMark from '../LogoMark.vue'

defineProps<{
  logoSize: number
  darkMode: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'open-settings'): void
  (e: 'reset-layout'): void
}>()

const { t } = useI18n()
</script>

<template>
  <header class="sidebar__header">
    <div class="brand">
      <LogoMark class="brand__icon" :size="logoSize" />
      <div>
        <h1>Aurora Feeds</h1>
        <p class="muted">{{ t('common.local') }} {{ t('common.private') }} · {{ t('common.ai') }} {{ t('common.smart') }} {{ t('common.reading') }} {{ t('common.platform') }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button 
        @click="emit('toggle-theme')" 
        class="theme-toggle" 
        :title="darkMode ? t('layout.themeToggleTitle') : t('layout.themeToggleTitleDark')"
      >
        <svg
          v-if="darkMode"
          class="icon icon-20"
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
          class="icon icon-20"
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
      <button @click="emit('open-settings')" class="settings-btn" :title="t('layout.settingsTitle')">
        <svg
          class="icon icon-20"
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
      <button @click="emit('reset-layout')" class="layout-reset-btn" :title="t('layout.resetLayoutTitle')">
        <svg
          class="icon icon-20"
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
.sidebar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: flex-start;
  gap: clamp(8px, 1vw, 14px);
  flex: 1;
}

.brand__icon {
  flex-shrink: 0;
}

.sidebar__header h1 {
  font-size: clamp(16px, 1.6vw, 20px);
  margin-bottom: 4px;
  line-height: 1.2;
}

.brand p {
  font-size: clamp(11px, 1.2vw, 13px);
  line-height: 1.4;
  margin: 0;
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-self: flex-start;
  margin-top: -4px;
}

.icon {
  width: 16px;
  height: 16px;
  display: block;
}

.icon-20 {
  width: 20px;
  height: 20px;
}

.theme-toggle,
.settings-btn,
.layout-reset-btn {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
  color: var(--text-primary);
}

.theme-toggle:hover,
.settings-btn:hover,
.layout-reset-btn:hover {
  background: rgba(255, 122, 24, 0.1);
  color: var(--accent);
}

:global(.dark) .theme-toggle,
:global(.dark) .settings-btn,
:global(.dark) .layout-reset-btn {
  color: rgba(255, 255, 255, 0.9);
}

:global(.dark) .theme-toggle:hover,
:global(.dark) .settings-btn:hover,
:global(.dark) .layout-reset-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffe5d0;
}
</style>
