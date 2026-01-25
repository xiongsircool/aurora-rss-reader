<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isStarred: boolean
  translationLanguage: string
  // 全文翻译相关
  isFullTextTranslating?: boolean
  showFullTextTranslation?: boolean
  fullTextTranslationProgress?: number
}>()

const emit = defineEmits<{
  (e: 'open-external'): void
  (e: 'toggle-star'): void
  (e: 'update:translationLanguage', value: string): void
  (e: 'toggle-full-text-translation'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="actions-container flex flex-wrap justify-start gap-1.5 p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-lg mb-3.5">
    <button
      @click="emit('open-external')"
      class="action-btn h-[clamp(28px,3.2vw,34px)] px-[clamp(10px,1.3vw,14px)] rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] font-medium text-[clamp(0.72rem,1vw,0.8rem)] tracking-tight cursor-pointer transition-all duration-200 min-w-17 whitespace-nowrap shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:c-white hover:shadow-lg"
    >{{ t('feeds.openOriginal') }}</button>
    <button
      @click="emit('toggle-star')"
      class="action-btn h-[clamp(28px,3.2vw,34px)] px-[clamp(10px,1.3vw,14px)] rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] font-medium text-[clamp(0.72rem,1vw,0.8rem)] tracking-tight cursor-pointer transition-all duration-200 min-w-17 whitespace-nowrap shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:c-white hover:shadow-lg"
    >
      {{ isStarred ? t('articles.cancelFavorite') : t('articles.addFavorite') }}
    </button>
    <!-- 全文翻译按钮（包含标题翻译） -->
    <button
      @click="emit('toggle-full-text-translation')"
      :disabled="isFullTextTranslating"
      class="action-btn h-[clamp(28px,3.2vw,34px)] px-[clamp(10px,1.3vw,14px)] rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] c-[var(--text-primary)] font-medium text-[clamp(0.72rem,1vw,0.8rem)] tracking-tight cursor-pointer transition-all duration-200 min-w-17 whitespace-nowrap shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:c-white hover:shadow-lg disabled:op-60 disabled:cursor-not-allowed disabled:c-[var(--text-secondary)] disabled:bg-[var(--bg-surface)] disabled:border-[var(--border-color)] disabled:shadow-none"
      :class="{ 'is-active': showFullTextTranslation && !isFullTextTranslating }"
    >
      <template v-if="isFullTextTranslating">
        {{ t('ai.translating') }} ({{ fullTextTranslationProgress }}%)
      </template>
      <template v-else-if="showFullTextTranslation">
        {{ t('ai.hideFullTextTranslation') }}
      </template>
      <template v-else>
        {{ t('ai.translateFullText') }}
      </template>
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
/* Migrated to UnoCSS - only select dropdown and responsive styles remain */
.lang-select {
  height: clamp(28px, 3.2vw, 34px);
  padding: 0 28px 0 clamp(10px, 1.3vw, 14px);
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 500;
  font-size: clamp(0.72rem, 1vw, 0.8rem);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 78px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  appearance: none;
  text-align: left;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-primary) 50%), linear-gradient(135deg, var(--text-primary) 50%, transparent 50%);
  background-position: calc(100% - 13px) 11px, calc(100% - 9px) 11px;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.lang-select:hover {
  border-color: var(--accent);
  background-color: var(--accent);
  color: #fff;
  box-shadow: 0 8px 20px rgba(255, 122, 24, 0.25);
}

.lang-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.action-btn.is-active {
  border-color: var(--accent);
  background-color: var(--accent);
  color: #fff;
}

@media (max-width: 560px) {
  .actions-container {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn,
  .lang-select {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
