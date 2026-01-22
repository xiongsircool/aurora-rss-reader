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
  <section class="mb-6 p-[18px_20px] rounded-xl bg-[#f8faff] border border-[rgba(76,116,255,0.08)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] last:mb-0 dark:bg-[rgba(255,255,255,0.04)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-[0_0_16px_0] text-base font-semibold c-[var(--text-primary)]">{{ t('settings.aiFeatures') }}</h3>
    
    <!-- Auto Summary -->
    <div class="mb-4">
      <label class="flex items-start gap-2 cursor-pointer py-1 c-[var(--text-primary)]">
        <input v-model="features.auto_summary" type="checkbox" class="mr-2 accent-[var(--settings-accent)]" />
        <div>
          {{ t('settings.autoSummary') }}
          <span class="text-xs c-[var(--text-secondary)] block mt-0.5 leading-snug">{{ t('settings.autoSummaryHint') }}</span>
        </div>
      </label>
    </div>

    <!-- Auto Title Translation -->
    <div class="mb-4">
      <label class="flex items-start gap-2 cursor-pointer py-1 c-[var(--text-primary)]">
        <input v-model="features.auto_title_translation" type="checkbox" class="mr-2 accent-[var(--settings-accent)]" />
        <div>
          {{ t('settings.autoTitleTranslation') }}
          <span class="text-xs c-[var(--text-secondary)] block mt-0.5 leading-snug">{{ t('settings.autoTitleTranslationHint') }}</span>
        </div>
      </label>
    </div>

    <!-- Title Display Mode -->
    <div class="mb-4" v-if="features.auto_title_translation">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)]">{{ t('settings.titleDisplayMode') }}</label>
      <div class="flex gap-2 mt-2">
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] c-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-[rgba(76,116,255,0.08)] hover:border-[rgba(76,116,255,0.3)] hover:c-[#4c74ff] dark:bg-white/6 dark:border-white/12 dark:c-[var(--text-primary)] dark:hover:bg-[rgba(76,116,255,0.15)] dark:hover:border-[rgba(76,116,255,0.4)]"
          :class="{ 'bg-gradient-to-br from-[#4c74ff] to-[#2f54ff] border-transparent! c-white! shadow-[0_4px_12px_rgba(76,116,255,0.3)] hover:bg-gradient-to-br hover:from-[#2f54ff] hover:to-[#4c74ff] hover:c-white dark:bg-gradient-to-br dark:from-[#4c74ff] dark:to-[#2f54ff] dark:c-white dark:shadow-[0_4px_12px_rgba(76,116,255,0.4)]': features.title_display_mode === 'replace' }"
          @click="features.title_display_mode = 'replace'"
          :title="t('settings.displayModeReplaceHint')"
        >
          {{ t('settings.displayModeReplace') }}
        </button>
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] c-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-[rgba(76,116,255,0.08)] hover:border-[rgba(76,116,255,0.3)] hover:c-[#4c74ff] dark:bg-white/6 dark:border-white/12 dark:c-[var(--text-primary)] dark:hover:bg-[rgba(76,116,255,0.15)] dark:hover:border-[rgba(76,116,255,0.4)]"
          :class="{ 'bg-gradient-to-br from-[#4c74ff] to-[#2f54ff] border-transparent! c-white! shadow-[0_4px_12px_rgba(76,116,255,0.3)] hover:bg-gradient-to-br hover:from-[#2f54ff] hover:to-[#4c74ff] hover:c-white dark:bg-gradient-to-br dark:from-[#4c74ff] dark:to-[#2f54ff] dark:c-white dark:shadow-[0_4px_12px_rgba(76,116,255,0.4)]': features.title_display_mode === 'translation-first' }"
          @click="features.title_display_mode = 'translation-first'"
          :title="t('settings.displayModeTranslationFirstHint')"
        >
          {{ t('settings.displayModeTranslationFirst') }}
        </button>
        <button
          type="button"
          class="flex-1 p-[10px_12px] border border-[var(--border-color)] rounded-lg bg-[var(--bg-surface)] c-[var(--text-primary)] text-[13px] font-medium cursor-pointer transition-all ease text-center whitespace-nowrap hover:bg-[rgba(76,116,255,0.08)] hover:border-[rgba(76,116,255,0.3)] hover:c-[#4c74ff] dark:bg-white/6 dark:border-white/12 dark:c-[var(--text-primary)] dark:hover:bg-[rgba(76,116,255,0.15)] dark:hover:border-[rgba(76,116,255,0.4)]"
          :class="{ 'bg-gradient-to-br from-[#4c74ff] to-[#2f54ff] border-transparent! c-white! shadow-[0_4px_12px_rgba(76,116,255,0.3)] hover:bg-gradient-to-br hover:from-[#2f54ff] hover:to-[#4c74ff] hover:c-white dark:bg-gradient-to-br dark:from-[#4c74ff] dark:to-[#2f54ff] dark:c-white dark:shadow-[0_4px_12px_rgba(76,116,255,0.4)]': features.title_display_mode === 'original-first' }"
          @click="features.title_display_mode = 'original-first'"
          :title="t('settings.displayModeOriginalFirstHint')"
        >
          {{ t('settings.displayModeOriginalFirst') }}
        </button>
      </div>
    </div>

    <!-- Translation Target Language -->
    <div class="mb-4" v-if="features.auto_title_translation">
      <label class="block mb-2 text-sm font-medium c-[var(--text-primary)]">{{ t('settings.translationTargetLanguage') }}</label>
      <select v-model="features.translation_language" class="w-full p-[11px_14px] border border-[rgba(92,106,138,0.22)] rounded-lg text-sm bg-[#fefefe] c-[var(--text-primary)] transition-all shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)] dark:bg-[var(--bg-surface)] dark:border-[rgba(255,255,255,0.12)] dark:shadow-none">
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
        <label class="block text-sm font-medium c-[var(--text-primary)]">{{ t('settings.autoTitleTranslationLimitLabel', { count: autoTitleTranslationLimit }) }}</label>
        <span class="text-lg font-semibold c-[#4c74ff]">{{ autoTitleTranslationLimit }}</span>
      </div>
      <input
        type="range"
        class="w-full mt-1 accent-[#4c74ff]"
        :value="autoTitleTranslationLimit"
        @input="autoTitleTranslationLimit = Number(($event.target as HTMLInputElement).value)"
        :min="limitBounds.min"
        :max="limitBounds.max"
        :disabled="!features.auto_title_translation"
      />
      <div class="flex justify-between text-[11px] c-[var(--text-secondary)] mt-1">
        <span>{{ limitBounds.min }}</span>
        <span>{{ limitBounds.max }}</span>
      </div>
      <p class="mt-1.5 text-xs c-[var(--text-secondary)]">{{ t('settings.autoTitleTranslationLimitHint', { count: autoTitleTranslationLimit }) }}</p>
    </div>
  </section>
</template>
