<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalFeatureConfig } from '../../composables/useSettingsModal'
import {
  MIN_AUTO_TITLE_TRANSLATIONS,
  MAX_AUTO_TITLE_TRANSLATIONS,
  TITLE_TRANSLATION_CONCURRENCY_FALLBACK
} from '../../constants/translation'

const features = defineModel<LocalFeatureConfig>('features', { required: true })

defineProps<{
  autoTitleTranslationLimit: number
}>()

const emit = defineEmits<{
  'update:autoTitleTranslationLimit': [value: number]
}>()

const { t } = useI18n()

const limitBounds = {
  min: MIN_AUTO_TITLE_TRANSLATIONS,
  max: MAX_AUTO_TITLE_TRANSLATIONS
}

const concurrencyHint = Math.max(1, TITLE_TRANSLATION_CONCURRENCY_FALLBACK)
</script>

<template>
  <section class="settings-section">
    <h3>{{ t('settings.aiFeatures') }}</h3>
    
    <!-- Auto Summary -->
    <div class="form-group">
      <label class="checkbox-label">
        <input v-model="features.auto_summary" type="checkbox" class="form-checkbox" />
        {{ t('settings.autoSummary') }}
        <span class="checkbox-hint">{{ t('settings.autoSummaryHint') }}</span>
      </label>
    </div>

    <!-- Auto Translation -->
    <div class="form-group">
      <label class="checkbox-label">
        <input v-model="features.auto_translation" type="checkbox" class="form-checkbox" />
        {{ t('settings.autoTranslation') }}
        <span class="checkbox-hint">{{ t('settings.autoTranslationHint') }}</span>
      </label>
    </div>

    <!-- Auto Title Translation -->
    <div class="form-group">
      <label class="checkbox-label">
        <input v-model="features.auto_title_translation" type="checkbox" class="form-checkbox" />
        {{ t('settings.autoTitleTranslation') }}
        <span class="checkbox-hint">{{ t('settings.autoTitleTranslationHint') }}</span>
      </label>
    </div>

    <!-- Title Display Mode -->
    <div class="form-group" v-if="features.auto_title_translation">
      <label>{{ t('settings.titleDisplayMode') }}</label>
      <div class="display-mode-group">
        <button
          type="button"
          class="display-mode-btn"
          :class="{ active: features.title_display_mode === 'replace' }"
          @click="features.title_display_mode = 'replace'"
          :title="t('settings.displayModeReplaceHint')"
        >
          {{ t('settings.displayModeReplace') }}
        </button>
        <button
          type="button"
          class="display-mode-btn"
          :class="{ active: features.title_display_mode === 'translation-first' }"
          @click="features.title_display_mode = 'translation-first'"
          :title="t('settings.displayModeTranslationFirstHint')"
        >
          {{ t('settings.displayModeTranslationFirst') }}
        </button>
        <button
          type="button"
          class="display-mode-btn"
          :class="{ active: features.title_display_mode === 'original-first' }"
          @click="features.title_display_mode = 'original-first'"
          :title="t('settings.displayModeOriginalFirstHint')"
        >
          {{ t('settings.displayModeOriginalFirst') }}
        </button>
      </div>
    </div>

    <!-- Translation Target Language -->
    <div class="form-group" v-if="features.auto_translation || features.auto_title_translation">
      <label>{{ t('settings.translationTargetLanguage') }}</label>
      <select v-model="features.translation_language" class="form-select">
        <option value="zh">{{ t('languages.zh') }}</option>
        <option value="en">{{ t('languages.en') }}</option>
        <option value="ja">{{ t('languages.ja') }}</option>
        <option value="ko">{{ t('languages.ko') }}</option>
        <option value="fr">{{ t('languages.fr') }}</option>
        <option value="de">{{ t('languages.de') }}</option>
        <option value="es">{{ t('languages.es') }}</option>
      </select>
    </div>

    <!-- Title Translation Limit -->
    <div class="form-group title-translation-limit">
      <div class="title-translation-limit__label">
        <label>{{ t('settings.autoTitleTranslationLimitLabel', { count: autoTitleTranslationLimit }) }}</label>
        <span class="limit-value">{{ autoTitleTranslationLimit }}</span>
      </div>
      <input
        type="range"
        class="form-range"
        :value="autoTitleTranslationLimit"
        @input="emit('update:autoTitleTranslationLimit', Number(($event.target as HTMLInputElement).value))"
        :min="limitBounds.min"
        :max="limitBounds.max"
        :disabled="!features.auto_title_translation"
      />
      <div class="range-scale">
        <span>{{ limitBounds.min }}</span>
        <span>{{ limitBounds.max }}</span>
      </div>
      <p class="form-hint">{{ t('settings.autoTitleTranslationLimitHint', { concurrency: concurrencyHint }) }}</p>
    </div>
  </section>
</template>
