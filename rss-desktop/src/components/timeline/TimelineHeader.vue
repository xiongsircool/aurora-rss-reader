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
  <header class="timeline__header">
    <div class="timeline__title-block">
      <h2>{{ title }}</h2>
      <p class="muted">{{ subtitle }}</p>
    </div>
    <div class="timeline__actions">
      <!-- Mark All as Read Button -->
      <button 
        v-if="!showFavoritesOnly"
        class="timeline-action-btn timeline-action-btn--mark-read"
        @click="emit('mark-all-read')"
        :title="t('articles.markAllAsRead')"
      >
        <span class="timeline-action-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
          </svg>
        </span>
        <span>{{ t('articles.markAllAsRead') }}</span>
      </button>

      <button class="timeline-action-btn" @click="emit('refresh')">
        <span class="timeline-action-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4 4v6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M20 20v-6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M20 10a8 8 0 0 0-13.66-4.66L4 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            <path d="M4 14a8 8 0 0 0 13.66 4.66L20 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        </span>
        <span>{{ showFavoritesOnly ? t('navigation.refreshFavorites') : t('navigation.refreshSubscription') }}</span>
      </button>
      <button
        v-if="showFavoritesOnly"
        @click="emit('back-to-feeds')"
        class="timeline-action-btn timeline-action-btn--ghost"
      >
        <span class="timeline-action-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
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
.timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(12px, 1.5vw, 18px) clamp(16px, 2vw, 22px);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-wrap: wrap;
}

.timeline__title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline__title-block h2 {
  margin: 0;
  font-size: 1.25rem;
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
  margin: 0;
}

.timeline__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.timeline-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  background: linear-gradient(120deg, #ff7a18, #ffbe30);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(255, 122, 24, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.timeline-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.4);
}

.timeline-action-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(255, 122, 24, 0.28);
}

.timeline-action-btn__icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timeline-action-btn__icon svg {
  width: 16px;
  height: 16px;
  color: #fff;
}

.timeline-action-btn--ghost {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  box-shadow: 0 4px 14px rgba(15, 17, 21, 0.1);
  border: 1px solid rgba(15, 17, 21, 0.08);
  padding-right: 16px;
}

.timeline-action-btn--ghost .timeline-action-btn__icon {
  background: rgba(15, 17, 21, 0.08);
}

.timeline-action-btn--ghost:hover {
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 17, 21, 0.15);
}

/* Mark as read button - green accent */
.timeline-action-btn--mark-read {
  background: linear-gradient(120deg, #34c759, #30d158);
  box-shadow: 0 6px 16px rgba(52, 199, 89, 0.3);
}

.timeline-action-btn--mark-read:hover {
  box-shadow: 0 8px 20px rgba(52, 199, 89, 0.4);
}

:global(.dark) .timeline-action-btn {
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.25);
}

:global(.dark) .timeline-action-btn--mark-read {
  box-shadow: 0 8px 20px rgba(52, 199, 89, 0.25);
}

:global(.dark) .timeline-action-btn--ghost {
  background: rgba(15, 17, 21, 0.8);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

:global(.dark) .timeline-action-btn--ghost .timeline-action-btn__icon {
  background: rgba(255, 255, 255, 0.08);
}
</style>
