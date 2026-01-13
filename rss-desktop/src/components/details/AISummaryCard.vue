<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  summaryText: string
  summaryLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'generate-summary'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="summary-card summary-card--inline" :class="{ 'summary-card--loading': summaryLoading }">
    <div class="summary-card__content">
      <p class="summary-card__label">{{ t('ai.summaryLabel') }}</p>
      <p v-if="summaryText" class="summary-card__text">{{ summaryText }}</p>
      <p v-else class="summary-card__placeholder">
        {{ t('ai.summaryDescription') }}
      </p>
    </div>
    <button
      class="summary-card__action"
      @click="emit('generate-summary')"
      :disabled="summaryLoading"
    >
      {{ summaryLoading ? t('ai.generating') : (summaryText ? t('ai.regenerateButton') : t('ai.generateButton')) }}
    </button>
  </div>
</template>

<style scoped>
.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 18px;
  padding: 14px 14px 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255, 122, 24, 0.06), rgba(255, 122, 24, 0.02)), var(--bg-surface);
  position: relative;
}

.summary-card--inline {
  box-shadow: 0 10px 30px rgba(15, 17, 21, 0.08);
}

.summary-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent), rgba(255, 122, 24, 0.4));
  opacity: 0.9;
}

.summary-card__content {
  flex: 1;
}

.summary-card__label {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 2px;
  font-weight: 600;
}

.summary-card__label::before {
  content: '✨';
  margin-right: 6px;
}

.summary-card__text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

.summary-card__placeholder {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.summary-card__action {
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  background: #ff8a3d;
  color: #fff;
  font-weight: 500;
  font-size: 0.75rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  align-self: flex-start;
}

.summary-card__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.summary-card__action:not(:disabled):hover {
  box-shadow: 0 8px 20px rgba(255, 138, 61, 0.35);
  transform: translateY(-1px);
}

.summary-card--loading .summary-card__text,
.summary-card--loading .summary-card__placeholder {
  position: relative;
}

.summary-card--loading .summary-card__text::after,
.summary-card--loading .summary-card__placeholder::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.35) 40%, rgba(255, 255, 255, 0.35) 60%, transparent 100%);
  animation: summaryShimmer 1.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes summaryShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
