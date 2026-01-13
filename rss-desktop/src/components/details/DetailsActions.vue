<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isStarred: boolean
  isTranslating: boolean
  showTranslation: boolean
  translationLanguage: string
}>()

const emit = defineEmits<{
  (e: 'open-external'): void
  (e: 'toggle-star'): void
  (e: 'toggle-translation'): void
  (e: 'update:translationLanguage', value: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="details__actions">
    <button @click="emit('open-external')">{{ t('feeds.openOriginal') }}</button>
    <button @click="emit('toggle-star')">
      {{ isStarred ? t('articles.cancelFavorite') : t('articles.addFavorite') }}
    </button>
    <button @click="emit('toggle-translation')" :disabled="isTranslating">
      {{ isTranslating ? t('ai.translating') : (showTranslation ? t('articles.showOriginal') : t('ai.translate')) }}
    </button>
    <select 
      :value="translationLanguage" 
      @change="emit('update:translationLanguage', ($event.target as HTMLSelectElement).value)"
      class="lang-select"
    >
      <option value="zh">{{ t('languages.zh') }}</option>
      <option value="en">{{ t('languages.en') }}</option>
      <option value="ja">{{ t('languages.ja') }}</option>
      <option value="ko">{{ t('languages.ko') }}</option>
    </select>
  </div>
</template>

<style scoped>
.details__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  margin-bottom: 14px;
}

.details__actions button,
.details__actions .lang-select {
  height: clamp(28px, 3.2vw, 34px);
  padding: 0 clamp(10px, 1.3vw, 14px);
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 500;
  font-size: clamp(0.72rem, 1vw, 0.8rem);
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  flex: 0 1 auto;
  min-width: 68px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.details__actions button:hover,
.details__actions .lang-select:hover {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.25);
}

.details__actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border-color: var(--border-color);
  box-shadow: none;
}

.details__actions button:focus-visible,
.details__actions .lang-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.details__actions .lang-select {
  appearance: none;
  padding-right: 28px;
  min-width: 78px;
  text-align: left;
  background-color: var(--bg-surface);
  background-image: linear-gradient(45deg, transparent 50%, var(--text-primary) 50%), linear-gradient(135deg, var(--text-primary) 50%, transparent 50%);
  background-position: calc(100% - 13px) 11px, calc(100% - 9px) 11px;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

@media (max-width: 560px) {
  .details__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .details__actions button,
  .details__actions .lang-select {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
