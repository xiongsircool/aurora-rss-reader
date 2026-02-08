<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  activeModule: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'select', module: string): void
  (e: 'toggle-collapse'): void
}>()

const { t } = useI18n()

const modules = [
  { id: 'collections', icon: 'folder', labelKey: 'workspace.collections' },
  { id: 'tags', icon: 'tag', labelKey: 'workspace.tags' },
  { id: 'search', icon: 'search', labelKey: 'workspace.search' }
]
</script>

<template>
  <nav
    class="shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-surface)] p-3 flex flex-col"
    :class="collapsed ? 'w-[72px]' : 'w-[200px]'"
  >
    <div class="space-y-1 flex-1">
      <button
        v-for="mod in modules"
        :key="mod.id"
        @click="emit('select', mod.id)"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors"
        :class="activeModule === mod.id
          ? 'bg-[rgba(255,122,24,0.12)] c-[var(--accent)] font-medium'
          : 'hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]'"
        :title="t(mod.labelKey)"
      >
        <svg v-if="mod.icon === 'folder'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <svg v-else-if="mod.icon === 'tag'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
        </svg>
        <svg v-else-if="mod.icon === 'search'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span v-if="!collapsed">{{ t(mod.labelKey) }}</span>
      </button>
    </div>

    <button
      @click="emit('toggle-collapse')"
      class="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] c-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors"
      :title="collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')"
    >
      <svg v-if="collapsed" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <polyline points="8 4 16 12 8 20" />
      </svg>
      <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <polyline points="16 4 8 12 16 20" />
      </svg>
      <span v-if="!collapsed">{{ t('common.collapseSidebar') }}</span>
    </button>
  </nav>
</template>
