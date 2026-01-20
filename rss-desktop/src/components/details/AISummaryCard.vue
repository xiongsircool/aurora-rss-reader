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
  <div
    class="summary-card flex flex-col gap-2 mb-4.5 py-3.5 pr-3.5 pl-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] relative shadow-lg"
    :class="{ 'summary-card--loading': summaryLoading }"
  >
    <div class="flex-1">
      <p class="summary-card__label text-xs tracking-wide uppercase c-[var(--text-secondary)] mb-0.5 font-semibold">{{ t('ai.summaryLabel') }}</p>
      <p v-if="summaryText" class="summary-card__text text-sm leading-relaxed c-[var(--text-primary)]">{{ summaryText }}</p>
      <p v-else class="summary-card__placeholder c-[var(--text-secondary)] text-xs leading-relaxed">
        {{ t('ai.summaryDescription') }}
      </p>
    </div>
    <button
      class="border-none rounded-full py-1.5 px-3.5 bg-[#ff8a3d] c-white font-medium text-xs cursor-pointer transition-all duration-200 self-start hover:shadow-xl hover:-translate-y-0.5 disabled:op-60 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
      @click="emit('generate-summary')"
      :disabled="summaryLoading"
    >
      {{ summaryLoading ? t('ai.generating') : (summaryText ? t('ai.regenerateButton') : t('ai.generateButton')) }}
    </button>
  </div>
</template>

<style scoped>
/* Decorative left bar - requires ::before pseudo-element */
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

/* Label sparkle icon */
.summary-card__label::before {
  content: '✨';
  margin-right: 6px;
}

/* Loading shimmer effect */
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
