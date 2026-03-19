<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalFeatureConfig } from '../../composables/useSettingsModal'
import {
  MIN_AUTO_TITLE_TRANSLATIONS,
  MAX_AUTO_TITLE_TRANSLATIONS
} from '../../constants/translation'

const features = defineModel<LocalFeatureConfig>('features', { required: true })
const autoTitleTranslationLimit = defineModel<number>('autoTitleTranslationLimit', { required: true })
const summaryPromptPreference = defineModel<string>('summaryPromptPreference', { required: true })
const aiSummaryMaxTokens = defineModel<number>('aiSummaryMaxTokens', { required: true })
const translationPromptPreference = defineModel<string>('translationPromptPreference', { required: true })
const scopeSummaryEnabled = defineModel<boolean>('scopeSummaryEnabled', { required: true })
const scopeSummaryAutoGenerate = defineModel<boolean>('scopeSummaryAutoGenerate', { required: true })
const scopeSummaryAutoIntervalMinutes = defineModel<number>('scopeSummaryAutoIntervalMinutes', { required: true })
const scopeSummaryDefaultWindow = defineModel<'24h' | '3d' | '7d' | '30d'>('scopeSummaryDefaultWindow', { required: true })
const scopeSummaryMaxEntries = defineModel<number>('scopeSummaryMaxEntries', { required: true })
const scopeSummaryChunkSize = defineModel<number>('scopeSummaryChunkSize', { required: true })
const scopeSummaryModelName = defineModel<string>('scopeSummaryModelName', { required: true })
const scopeSummaryUseCustom = defineModel<boolean>('scopeSummaryUseCustom', { required: true })
const scopeSummaryBaseUrl = defineModel<string>('scopeSummaryBaseUrl', { required: true })
const scopeSummaryApiKey = defineModel<string>('scopeSummaryApiKey', { required: true })

const { t } = useI18n()

const limitBounds = {
  min: MIN_AUTO_TITLE_TRANSLATIONS,
  max: MAX_AUTO_TITLE_TRANSLATIONS
}

</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_16px_0] text-base font-semibold text-[var(--text-primary)] hidden md:block">{{ t('settings.aiFeatures') }}</h3>
    <p class="m-[0_0_16px_0] text-xs leading-5 text-[var(--text-secondary)]">
      {{ t('settings.aiFeaturesHint') }}
    </p>

    <!-- Title Display Mode -->
    <div class="mb-4">
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
    <div class="mb-4">
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
      />
      <div class="flex justify-between text-[11px] text-[var(--text-secondary)] mt-1">
        <span>{{ limitBounds.min }}</span>
        <span>{{ limitBounds.max }}</span>
      </div>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.autoTitleTranslationLimitHint', { count: autoTitleTranslationLimit }) }}</p>
    </div>

    <!-- AI Summary Max Output Length -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.aiSummaryMaxOutputLength') }}</label>
      <select
        v-model="aiSummaryMaxTokens"
        class="w-full p-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      >
        <option :value="0">{{ t('settings.aiSummaryMaxOutputLengthUnlimited') }}</option>
        <option :value="1024">1024 {{ t('settings.tokens') }}</option>
        <option :value="2048">2048 {{ t('settings.tokens') }}</option>
        <option :value="4096">4096 {{ t('settings.tokens') }}</option>
        <option :value="8192">8192 {{ t('settings.tokens') }}</option>
      </select>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.aiSummaryMaxOutputLengthHint') }}</p>
    </div>

    <!-- Summary Prompt Preference -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.summaryPromptPreference') }}</label>
      <textarea
        v-model="summaryPromptPreference"
        class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)] resize-none"
        rows="3"
        :placeholder="t('settings.summaryPromptPreferencePlaceholder')"
      ></textarea>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.summaryPromptPreferenceHint') }}</p>
    </div>

    <!-- Translation Prompt Preference -->
    <div class="mb-4">
      <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.translationPromptPreference') }}</label>
      <textarea
        v-model="translationPromptPreference"
        class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)] resize-none"
        rows="3"
        :placeholder="t('settings.translationPromptPreferencePlaceholder')"
      ></textarea>
      <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.translationPromptPreferenceHint') }}</p>
    </div>

    <div class="mt-5 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div>
          <div class="text-sm font-semibold text-[var(--text-primary)]">{{ t('settings.scopeSummaryTitle') }}</div>
          <div class="text-xs text-[var(--text-secondary)] mt-1">{{ t('settings.scopeSummaryHint') }}</div>
        </div>
        <label class="inline-flex items-center cursor-pointer">
          <input v-model="scopeSummaryEnabled" type="checkbox" class="sr-only peer">
          <div class="relative w-11 h-6 bg-[var(--border-color)] rounded-full peer peer-checked:bg-orange-500 transition-colors">
            <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </div>
        </label>
      </div>

      <div class="space-y-4 mt-3">
        <div class="flex items-center justify-between gap-2">
          <label class="text-sm text-[var(--text-primary)]">{{ t('settings.scopeSummaryAutoGenerate') }}</label>
          <label class="inline-flex items-center cursor-pointer">
            <input v-model="scopeSummaryAutoGenerate" type="checkbox" class="sr-only peer" :disabled="!scopeSummaryEnabled">
            <div class="relative w-10 h-5 bg-[var(--border-color)] rounded-full peer peer-checked:bg-orange-500 transition-colors peer-disabled:opacity-50">
              <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </div>
          </label>
        </div>

        <div>
          <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.scopeSummaryDefaultWindow') }}</label>
          <select
            v-model="scopeSummaryDefaultWindow"
            :disabled="!scopeSummaryEnabled"
            class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-all shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)] disabled:opacity-60"
          >
            <option value="24h">{{ t('scopeSummary.windows.24h') }}</option>
            <option value="3d">{{ t('scopeSummary.windows.3d') }}</option>
            <option value="7d">{{ t('scopeSummary.windows.7d') }}</option>
            <option value="30d">{{ t('scopeSummary.windows.30d') }}</option>
          </select>
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-sm font-medium text-[var(--text-primary)]">{{ t('settings.scopeSummaryAutoInterval', { minutes: scopeSummaryAutoIntervalMinutes }) }}</label>
            <span class="text-sm font-semibold text-orange-500">{{ scopeSummaryAutoIntervalMinutes }}m</span>
          </div>
          <input
            type="range"
            :value="scopeSummaryAutoIntervalMinutes"
            @input="scopeSummaryAutoIntervalMinutes = Number(($event.target as HTMLInputElement).value)"
            min="5"
            max="240"
            step="5"
            :disabled="!scopeSummaryEnabled || !scopeSummaryAutoGenerate"
            class="w-full mt-1 accent-orange-500 disabled:opacity-60"
          />
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-sm font-medium text-[var(--text-primary)]">{{ t('settings.scopeSummaryMaxEntries', { count: scopeSummaryMaxEntries }) }}</label>
            <span class="text-sm font-semibold text-orange-500">{{ scopeSummaryMaxEntries }}</span>
          </div>
          <input
            type="range"
            :value="scopeSummaryMaxEntries"
            @input="scopeSummaryMaxEntries = Number(($event.target as HTMLInputElement).value)"
            min="20"
            max="200"
            step="10"
            :disabled="!scopeSummaryEnabled"
            class="w-full mt-1 accent-orange-500 disabled:opacity-60"
          />
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-sm font-medium text-[var(--text-primary)]">{{ t('settings.scopeSummaryChunkSize', { count: scopeSummaryChunkSize }) }}</label>
            <span class="text-sm font-semibold text-orange-500">{{ scopeSummaryChunkSize }}</span>
          </div>
          <input
            type="range"
            :value="scopeSummaryChunkSize"
            @input="scopeSummaryChunkSize = Number(($event.target as HTMLInputElement).value)"
            min="5"
            max="25"
            step="1"
            :disabled="!scopeSummaryEnabled"
            class="w-full mt-1 accent-orange-500 disabled:opacity-60"
          />
        </div>

        <!-- Scope Summary Custom Model -->
        <div v-if="scopeSummaryUseCustom && scopeSummaryEnabled" class="mt-4 pt-4 border-t border-[var(--border-color)]">
          <div class="mb-3">
            <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.baseUrl') }}</label>
            <input
              v-model="scopeSummaryBaseUrl"
              type="text"
              :placeholder="t('settings.baseUrlPlaceholder')"
              class="w-full px-3 py-2 text-sm border rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] border-[var(--border-color)]"
            />
          </div>
          <div class="mb-3">
            <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
            <input
              v-model="scopeSummaryApiKey"
              type="password"
              :placeholder="t('settings.apiKeyPlaceholder')"
              class="w-full px-3 py-2 text-sm border rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] border-[var(--border-color)]"
            />
          </div>
          <div>
            <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
            <input
              v-model="scopeSummaryModelName"
              type="text"
              :placeholder="t('settings.modelPlaceholder')"
              class="w-full px-3 py-2 text-sm border rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] border-[var(--border-color)]"
            />
          </div>
        </div>
        <div v-else class="mt-4 pt-4 border-t border-[var(--border-color)]">
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-[var(--text-primary)]">{{ t('settings.scopeSummaryModel') }}</label>
            <label class="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                v-model="scopeSummaryUseCustom"
                type="checkbox"
                :disabled="!scopeSummaryEnabled"
                class="accent-orange-500 disabled:opacity-60"
              />
              {{ t('settings.useCustomModel') }}
            </label>
          </div>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">{{ t('settings.scopeSummaryModelHint') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
