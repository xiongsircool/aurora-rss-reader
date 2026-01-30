<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
const router = useRouter()

function goToWorkspace() {
  router.push('/workspace')
}
</script>

<template>
  <header class="flex justify-between items-center mb-3 gap-3">
    <div class="flex items-start gap-[clamp(8px,1vw,14px)] flex-1">
      <LogoMark class="shrink-0" :size="logoSize" />
      <div>
        <h1 class="text-[clamp(16px,1.6vw,20px)] mb-1 leading-tight">{{ t('common.appName') }}</h1>
        <p class="c-[var(--text-secondary)] text-xs text-[clamp(11px,1.2vw,13px)] leading-snug m-0">{{ t('common.local') }} {{ t('common.private') }} · {{ t('common.ai') }} {{ t('common.smart') }} {{ t('common.reading') }} {{ t('common.platform') }}</p>
      </div>
    </div>
    <div class="flex gap-2 self-start -mt-1">
      <button
        @click="goToWorkspace()"
        class="border-none bg-transparent text-xl cursor-pointer py-1 px-2 rounded-md transition-colors c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] hover:c-[var(--accent)] dark:c-[rgba(255,255,255,0.9)] dark:hover:bg-[rgba(255,255,255,0.12)] dark:hover:c-[#ffe5d0]"
        :title="t('workspace.title')"
      >
        <svg
          class="w-5 h-5 block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.69a.979.979 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
        </svg>
      </button>
      <button
        @click="emit('toggle-theme')" 
        class="border-none bg-transparent text-xl cursor-pointer py-1 px-2 rounded-md transition-colors c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] hover:c-[var(--accent)] dark:c-[rgba(255,255,255,0.9)] dark:hover:bg-[rgba(255,255,255,0.12)] dark:hover:c-[#ffe5d0]" 
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
      <button @click="emit('open-settings')" class="border-none bg-transparent text-xl cursor-pointer py-1 px-2 rounded-md transition-colors c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] hover:c-[var(--accent)] dark:c-[rgba(255,255,255,0.9)] dark:hover:bg-[rgba(255,255,255,0.12)] dark:hover:c-[#ffe5d0]" :title="t('layout.settingsTitle')">
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
      <button @click="emit('reset-layout')" class="border-none bg-transparent text-xl cursor-pointer py-1 px-2 rounded-md transition-colors c-[var(--text-primary)] hover:bg-[rgba(255,122,24,0.1)] hover:c-[var(--accent)] dark:c-[rgba(255,255,255,0.9)] dark:hover:bg-[rgba(255,255,255,0.12)] dark:hover:c-[#ffe5d0]" :title="t('layout.resetLayoutTitle')">
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
/* Migrated to UnoCSS */
</style>
