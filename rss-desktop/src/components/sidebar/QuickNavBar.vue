<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useCollectionsStore } from '../../stores/collectionsStore'
import { useTagsStore } from '../../stores/tagsStore'

import type { ViewMode } from './SidebarPanel.vue'

defineProps<{
  viewMode: ViewMode
}>()

const emit = defineEmits<{
  (e: 'toggle-favorites'): void
  (e: 'toggle-collections'): void
  (e: 'toggle-tags'): void
}>()

const { t } = useI18n()
const favoritesStore = useFavoritesStore()
const collectionsStore = useCollectionsStore()
const tagsStore = useTagsStore()

const favoritesCount = computed(() => favoritesStore.totalStarred)
const collectionsCount = computed(() => collectionsStore.collections.length)
const tagsCount = computed(() => tagsStore.tags.length)
const tagsPending = computed(() => tagsStore.stats.pending)
</script>

<template>
  <div class="flex gap-1.5 mb-2 px-0.5">
    <!-- Favorites Pill -->
    <button
      @click="emit('toggle-favorites')"
      class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-all duration-200"
      :class="viewMode === 'favorites'
        ? 'bg-[rgba(255,122,24,0.15)] border-[rgba(255,122,24,0.35)] c-[#ff7a18] dark:bg-[rgba(255,122,24,0.25)] dark:border-[rgba(255,122,24,0.5)]'
        : 'bg-transparent border-[rgba(255,122,24,0.15)] c-[var(--text-secondary)] hover:bg-[rgba(255,122,24,0.08)] hover:border-[rgba(255,122,24,0.25)] hover:c-[#ff7a18] dark:border-[rgba(255,122,24,0.2)] dark:hover:bg-[rgba(255,122,24,0.15)]'"
      :title="t('groups.myFavorites')"
    >
      <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3.5l2.7 5.61 6.3.92-4.55 4.44 1.08 6.28L12 17.77l-5.53 2.98 1.08-6.28L3 10.03l6.3-.92L12 3.5z"/>
      </svg>
      <span v-if="favoritesCount > 0" class="tabular-nums">{{ favoritesCount }}</span>
    </button>

    <!-- Collections Pill -->
    <button
      @click="emit('toggle-collections')"
      class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-all duration-200"
      :class="viewMode === 'collection'
        ? 'bg-[rgba(59,130,246,0.15)] border-[rgba(59,130,246,0.35)] c-[#3b82f6] dark:bg-[rgba(59,130,246,0.25)] dark:border-[rgba(59,130,246,0.5)]'
        : 'bg-transparent border-[rgba(59,130,246,0.15)] c-[var(--text-secondary)] hover:bg-[rgba(59,130,246,0.08)] hover:border-[rgba(59,130,246,0.25)] hover:c-[#3b82f6] dark:border-[rgba(59,130,246,0.2)] dark:hover:bg-[rgba(59,130,246,0.15)]'"
      :title="t('collections.title')"
    >
      <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.17l1.42 1.42a2 2 0 0 0 1.41.58H20a2 2 0 0 1 2 2v10z"/>
      </svg>
      <span v-if="collectionsCount > 0" class="tabular-nums">{{ collectionsCount }}</span>
    </button>

    <!-- Tags Pill -->
    <button
      @click="emit('toggle-tags')"
      class="relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[12px] font-medium cursor-pointer transition-all duration-200"
      :class="viewMode === 'tag'
        ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.35)] c-[#8b5cf6] dark:bg-[rgba(139,92,246,0.25)] dark:border-[rgba(139,92,246,0.5)]'
        : 'bg-transparent border-[rgba(139,92,246,0.15)] c-[var(--text-secondary)] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.25)] hover:c-[#8b5cf6] dark:border-[rgba(139,92,246,0.2)] dark:hover:bg-[rgba(139,92,246,0.15)]'"
      :title="t('tags.title')"
    >
      <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <circle cx="7" cy="7" r="1.5"/>
      </svg>
      <span v-if="tagsCount > 0" class="tabular-nums">{{ tagsCount }}</span>
      <!-- Pending badge -->
      <span
        v-if="tagsPending > 0"
        class="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold bg-[var(--accent)] c-white rounded-full leading-none"
      >
        {{ tagsPending > 99 ? '99+' : tagsPending }}
      </span>
    </button>
  </div>
</template>
