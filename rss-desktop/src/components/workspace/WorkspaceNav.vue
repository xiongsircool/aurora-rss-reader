<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  activeModule: string
}>()

const emit = defineEmits<{
  (e: 'select', module: string): void
}>()

const { t } = useI18n()

const modules = [
  { id: 'collections', icon: 'folder', labelKey: 'workspace.collections' },
  { id: 'search', icon: 'search', labelKey: 'workspace.search' }
]
</script>

<template>
  <nav class="w-[200px] shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
    <div class="space-y-1">
      <button
        v-for="mod in modules"
        :key="mod.id"
        @click="emit('select', mod.id)"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors"
        :class="activeModule === mod.id
          ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)] font-medium'
          : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
      >
        <svg v-if="mod.icon === 'folder'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <svg v-else-if="mod.icon === 'search'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        {{ t(mod.labelKey) }}
      </button>
    </div>
  </nav>
</template>
