<script setup lang="ts">
import { computed } from 'vue'
import { useFeedStore } from '../../stores/feedStore'
import { VIEW_TYPES, VIEW_TYPE_LABELS } from '../../types'
import type { ViewType } from '../../types'

const feedStore = useFeedStore()

const emit = defineEmits<{
  (e: 'select', viewType: ViewType): void
}>()

function handleSelect(viewType: ViewType) {
  emit('select', viewType)
}

const activeLabel = computed(() => VIEW_TYPE_LABELS[feedStore.activeViewType])
</script>

<template>
  <div class="view-type-nav mb-2">
    <!-- Current Selection Indicator -->
    <div class="current-selection flex items-center gap-1.5 px-2 py-1 mb-1.5 text-[12px]">
      <span class="c-[var(--text-secondary)]">视图:</span>
      <span class="font-medium c-[var(--accent)]">{{ activeLabel }}</span>
    </div>

    <!-- Navigation Buttons -->
    <div class="nav-buttons flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg">
      <button
        v-for="type in VIEW_TYPES"
        :key="type"
        class="nav-btn"
        :class="{ active: feedStore.activeViewType === type }"
        :title="VIEW_TYPE_LABELS[type]"
        @click="handleSelect(type)"
      >
        <!-- Articles Icon -->
        <svg v-if="type === 'articles'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>

        <!-- Social Icon -->
        <svg v-else-if="type === 'social'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>

        <!-- Pictures Icon -->
        <svg v-else-if="type === 'pictures'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>

        <!-- Videos Icon -->
        <svg v-else-if="type === 'videos'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>

        <!-- Audio Icon -->
        <svg v-else-if="type === 'audio'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>

        <!-- Notifications Icon -->
        <svg v-else-if="type === 'notifications'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        <!-- Unread Badge -->
        <span
          v-if="feedStore.viewTypeStats[type]?.unread"
          class="unread-badge"
        >
          {{ feedStore.viewTypeStats[type].unread > 99 ? '99+' : feedStore.viewTypeStats[type].unread }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.nav-btn {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn .icon {
  width: 18px;
  height: 18px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-btn:hover {
  background: rgba(255, 122, 24, 0.1);
  color: var(--text-primary);
}

.nav-btn.active {
  background: linear-gradient(135deg, #ff7a18 0%, #ff9a44 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 122, 24, 0.35);
}

.nav-btn.active:hover {
  background: linear-gradient(135deg, #ff8a2e 0%, #ffaa54 100%);
}

.unread-badge {
  position: absolute;
  top: 0px;
  right: 0px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 600;
  line-height: 14px;
  text-align: center;
  color: white;
  background: #ff3b30;
  border-radius: 7px;
}

.nav-btn.active .unread-badge {
  background: rgba(255, 255, 255, 0.9);
  color: #ff7a18;
}

:global(.dark) .nav-btn:hover {
  background: rgba(255, 122, 24, 0.15);
}

:global(.dark) .nav-btn.active {
  box-shadow: 0 4px 16px rgba(255, 122, 24, 0.4);
}
</style>
