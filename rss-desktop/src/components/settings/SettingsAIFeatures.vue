<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalFeatureConfig } from '../../composables/useSettingsModal'
import {
  MIN_AUTO_TITLE_TRANSLATIONS,
  MAX_AUTO_TITLE_TRANSLATIONS
} from '../../constants/translation'

const features = defineModel<LocalFeatureConfig>('features', { required: true })
const autoTitleTranslationLimit = defineModel<number>('autoTitleTranslationLimit', { required: true })

const { t } = useI18n()

const limitBounds = {
  min: MIN_AUTO_TITLE_TRANSLATIONS,
  max: MAX_AUTO_TITLE_TRANSLATIONS
}

</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_16px_0] text-base font-semibold text-[var(--text-primary)] hidden md:block">{{ t('settings.aiFeatures') }}</h3>

    <!-- Auto Summary -->
    <div class="mb-4">
      <label class="flex items-start gap-2 cursor-pointer py-1 text-[var(--text-primary)]">
        <input v-model="features.auto_summary" type="checkbox" class="mr-2 accent-orange-500" />
        <div>
          {{ t('settings.autoSummary') }}
          <span class="text-xs text-[var(--text-secondary)] block mt-0.5 leading-snug">{{ t('settings.autoSummaryHint') }}</span>
        </div>
      </label>
    </div>

    <!-- Auto Title Translation -->
    <div class="mb-4">
      <label class="flex items-start gap-2 cursor-pointer py-1 text-[var(--text-primary)]">
        <input v-model="features.auto_title_translation" type="checkbox" class="mr-2 accent-orange-500" />
        <div>
          {{ t('settings.autoTitleTranslation') }}
          <span class="text-xs text-[var(--text-secondary)] block mt-0.5 leading-snug">{{ t('settings.autoTitleTranslationHint') }}</span>
        </div>
      </label>
    </div>

    <!-- Title Display Mode -->
    <div class="mb-4" v-if="features.auto_title_translation">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.titleDisplayMode') }}</label>
      <div class="flex gap-2 mt-2">
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-500"
          :class="{ 'bg-gradient-to-br from-orange-500 to-orange-600 border-transparent! text-white! shadow-[0_4px_12px_rgba(255,122,24,0.3)] hover:bg-gradient-to-br hover:from-orange-600 hover:to-orange-500': features.title_display_mode === 'replace' }"
          @click="features.title_display_mode = 'replace'"
          :title="t('settings.displayModeReplaceHint')"
        >
          {{ t('settings.displayModeReplace') }}
        </button>
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-500"
          :class="{ 'bg-gradient-to-br from-orange-500 to-orange-600 border-transparent! text-white! shadow-[0_4px_12px_rgba(255,122,24,0.3)] hover:bg-gradient-to-br hover:from-orange-600 hover:to-orange-500': features.title_display_mode === 'translation-first' }"
          @click="features.title_display_mode = 'translation-first'"
          :title="t('settings.displayModeTranslationFirstHint')"
        >
          {{ t('settings.displayModeTranslationFirst') }}
        </button>
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-500"
          :class="{ 'bg-gradient-to-br from-orange-500 to-orange-600 border-transparent! text-white! shadow-[0_4px_12px_rgba(255,122,24,0.3)] hover:bg-gradient-to-br hover:from-orange-600 hover:to-orange-500': features.title_display_mode === 'original-first' }"
          @click="features.title_display_mode = 'original-first'"
          :title="t('settings.displayModeOriginalFirstHint')"
        >
          {{ t('settings.displayModeOriginalFirst') }}
        </button>
      </div>
    </div>

    <!-- Translation Target Language -->
    <div class="mb-4" v-if="features.auto_title_translation">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.translationTargetLanguage') }}</label>
      <select v-model="features.translation_language" class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]">
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
    <div class="mb-4">
      <div class="flex justify-between items-center mb-1">
        <label class="block text-sm font-medium text-[var(--text-primary)]">{{ t('settings.autoTitleTranslationLimitLabel', { count: autoTitleTranslationLimit }) }}</label>
        <span class="text-lg font-semibold text-orange-500">{{ autoTitleTranslationLimit }}</span>
      </div>
      <input
        type="range"
        class="w-full mt-1 accent-orange-500"
        :value="autoTitleTranslationLimit"
        @input="autoTitleTranslationLimit = Number(($event.target as HTMLInputElement).value)"
        :min="limitBounds.min"
        :max="limitBounds.max"
        :disabled="!features.auto_title_translation"
      />
      <div class="flex justify-between text-[11px] text-[var(--text-secondary)] mt-1">
        <span>{{ limitBounds.min }}</span>
        <span>{{ limitBounds.max }}</span>
      </div>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.autoTitleTranslationLimitHint', { count: autoTitleTranslationLimit }) }}</p>
    </div>
  </section>
</template>
