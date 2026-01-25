<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalServiceConfig } from '../../composables/useSettingsModal'
import type { TestResult } from '../../composables/useAIConfigSettings'
import type { AIServiceKey } from '../../stores/aiStore'

defineProps<{
  serviceTesting: Record<AIServiceKey, boolean>
  serviceTestResult: Record<AIServiceKey, TestResult | null>
}>()

const emit = defineEmits<{
  testConnection: [service: AIServiceKey]
  copySummaryToTranslation: []
}>()

const { t } = useI18n()

// Two-way binding for config objects
const summaryConfig = defineModel<LocalServiceConfig>('summaryConfig', { required: true })
const translationConfig = defineModel<LocalServiceConfig>('translationConfig', { required: true })
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-[0_0_16px_0] text-base font-semibold text-[var(--text-primary)] hidden md:block">{{ t('settings.aiConfig') }}</h3>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
      <!-- Summary Config Card -->
      <div class="border border-[var(--border-color)] rounded-xl p-4 bg-[var(--bg-surface)] flex flex-col justify-between h-full">
        <div class="flex-1">
          <div class="flex justify-between items-center gap-3 mb-3 flex-wrap min-h-[52px]">
            <div>
              <p class="m-0 text-[15px] font-semibold text-[var(--text-primary)]">{{ t('settings.summaryGeneration') }}</p>
              <p class="m-[4px_0_0_0] text-[13px] text-[var(--text-secondary)]">{{ t('settings.summarySubtitle') }}</p>
            </div>
            <button
              @click="emit('testConnection', 'summary')"
              :disabled="serviceTesting.summary || !summaryConfig.api_key || !summaryConfig.base_url || !summaryConfig.model_name"
              class="border-none p-[10px_18px] rounded-[10px] text-sm font-semibold cursor-pointer transition-transform,opacity bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_10px_20px_rgba(255,122,24,0.25)] hover:not-disabled:-translate-y-px hover:not-disabled:op-95 disabled:op-60 disabled:cursor-not-allowed disabled:shadow-none"
              :class="{
                'op-70 transform-none': serviceTesting.summary,
                'bg-[#34c759]! shadow-none!': serviceTestResult.summary?.success,
                'bg-[#ff4d4f]! shadow-none!': serviceTestResult.summary?.success === false
              }"
            >
              {{ serviceTesting.summary ? t('common.testing') : t('settings.testConnection') }}
            </button>
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
            <input
              v-model="summaryConfig.api_key"
              type="password"
              :placeholder="t('settings.apiKeyPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
            <p class="mt-1.5 text-xs text-[var(--text-secondary)]">
              {{ t('settings.getApiKey') }}
              <a href="https://open.bigmodel.cn" target="_blank" class="text-[var(--accent)] no-underline hover:underline">{{
                'https://open.bigmodel.cn'
              }}</a>
            </p>
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
            <input
              v-model="summaryConfig.base_url"
              type="text"
              :placeholder="t('settings.apiUrlPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
            <input
              v-model="summaryConfig.model_name"
              type="text"
              :placeholder="t('settings.modelPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
            <p class="mt-1.5 text-xs text-[var(--text-secondary)]">{{ t('settings.supportedModels') }}</p>
          </div>
        </div>

        <div
          v-if="serviceTestResult.summary"
          class="mt-2 p-3 rounded-[10px] text-[13px] font-medium border border-transparent bg-[var(--bg-elevated)] shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
          :class="{ 'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': serviceTestResult.summary.success, 'text-[#c43838] border-[rgba(255,77,79,0.35)]': !serviceTestResult.summary.success }"
        >
          {{ serviceTestResult.summary.message }}
        </div>
      </div>

      <!-- Translation Config Card -->
      <div class="border border-[var(--border-color)] rounded-xl p-4 bg-[var(--bg-surface)] flex flex-col justify-between h-full">
        <div class="flex-1">
          <div class="flex justify-between items-center gap-3 mb-3 flex-wrap min-h-[52px]">
            <div>
              <p class="m-0 text-[15px] font-semibold text-[var(--text-primary)]">{{ t('settings.contentTranslation') }}</p>
              <p class="m-[4px_0_0_0] text-[13px] text-[var(--text-secondary)]">{{ t('settings.translationSubtitle') }}</p>
            </div>
            <div class="flex gap-2 items-center flex-wrap justify-end">
              <button class="border border-dashed border-orange-500/40 bg-orange-500/10 text-orange-600 p-[7px_12px] rounded-lg text-[13px] cursor-pointer transition-all hover:bg-orange-500/20 hover:border-orange-600 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/8 dark:text-orange-400 dark:hover:bg-orange-500/15 dark:hover:border-orange-400" type="button" @click="emit('copySummaryToTranslation')">
                {{ t('settings.useSummaryConfig') }}
              </button>
              <button
                @click="emit('testConnection', 'translation')"
                :disabled="serviceTesting.translation || !translationConfig.api_key || !translationConfig.base_url || !translationConfig.model_name"
                class="border-none p-[10px_18px] rounded-[10px] text-sm font-semibold cursor-pointer transition-transform,opacity bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_10px_20px_rgba(255,122,24,0.25)] hover:not-disabled:-translate-y-px hover:not-disabled:op-95 disabled:op-60 disabled:cursor-not-allowed disabled:shadow-none"
                :class="{
                  'op-70 transform-none': serviceTesting.translation,
                  'bg-[#34c759]! shadow-none!': serviceTestResult.translation?.success,
                  'bg-[#ff4d4f]! shadow-none!': serviceTestResult.translation?.success === false
                }"
              >
                {{ serviceTesting.translation ? t('common.testing') : t('settings.testConnection') }}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
            <input
              v-model="translationConfig.api_key"
              type="password"
              :placeholder="t('settings.translationApiKeyPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
            <input
              v-model="translationConfig.base_url"
              type="text"
              :placeholder="t('settings.apiUrlPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
          </div>

          <div class="mb-4">
            <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
            <input
              v-model="translationConfig.model_name"
              type="text"
              :placeholder="t('settings.translationModelPlaceholder')"
              class="w-full p-[11px_14px] border border-[var(--border-color)] rounded-[10px] text-sm bg-[var(--bg-input)] text-[var(--text-primary)] transition-border-color,box-shadow shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
            />
          </div>
        </div>

        <div
          v-if="serviceTestResult.translation"
          class="mt-2 p-3 rounded-[10px] text-[13px] font-medium border border-transparent bg-[var(--bg-elevated)] shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
          :class="{ 'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': serviceTestResult.translation.success, 'text-[#c43838] border-[rgba(255,77,79,0.35)]': !serviceTestResult.translation.success }"
        >
          {{ serviceTestResult.translation.message }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Migrated to UnoCSS */
</style>

