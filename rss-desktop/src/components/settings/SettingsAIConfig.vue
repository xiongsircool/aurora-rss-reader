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
  <section class="settings-section">
    <h3>{{ t('settings.aiConfig') }}</h3>
    <div class="ai-config-grid">
      <!-- Summary Config Card -->
      <div class="ai-config-card">
        <div class="ai-config-card__content">
          <div class="ai-config-card__header">
            <div>
              <p class="ai-config-card__title">{{ t('settings.summaryGeneration') }}</p>
              <p class="ai-config-card__subtitle">{{ t('settings.summarySubtitle') }}</p>
            </div>
            <button
              @click="emit('testConnection', 'summary')"
              :disabled="serviceTesting.summary || !summaryConfig.api_key || !summaryConfig.base_url || !summaryConfig.model_name"
              class="test-btn"
              :class="{
                loading: serviceTesting.summary,
                success: serviceTestResult.summary?.success,
                error: serviceTestResult.summary?.success === false
              }"
            >
              {{ serviceTesting.summary ? t('common.testing') : t('settings.testConnection') }}
            </button>
          </div>

          <div class="form-group">
            <label>{{ t('settings.apiKey') }}</label>
            <input
              v-model="summaryConfig.api_key"
              type="password"
              :placeholder="t('settings.apiKeyPlaceholder')"
              class="form-input"
            />
            <p class="form-hint">
              {{ t('settings.getApiKey') }}
              <a href="https://open.bigmodel.cn" target="_blank">https://open.bigmodel.cn</a>
            </p>
          </div>

          <div class="form-group">
            <label>{{ t('settings.apiUrl') }}</label>
            <input
              v-model="summaryConfig.base_url"
              type="text"
              :placeholder="t('settings.apiUrlPlaceholder')"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('settings.modelName') }}</label>
            <input
              v-model="summaryConfig.model_name"
              type="text"
              :placeholder="t('settings.modelPlaceholder')"
              class="form-input"
            />
            <p class="form-hint">{{ t('settings.supportedModels') }}</p>
          </div>
        </div>

        <div
          v-if="serviceTestResult.summary"
          class="test-result"
          :class="{ success: serviceTestResult.summary.success, error: !serviceTestResult.summary.success }"
        >
          {{ serviceTestResult.summary.message }}
        </div>
      </div>

      <!-- Translation Config Card -->
      <div class="ai-config-card">
        <div class="ai-config-card__content">
          <div class="ai-config-card__header">
            <div>
              <p class="ai-config-card__title">{{ t('settings.contentTranslation') }}</p>
              <p class="ai-config-card__subtitle">{{ t('settings.translationSubtitle') }}</p>
            </div>
            <div class="ai-config-card__actions">
              <button class="ghost-btn" type="button" @click="emit('copySummaryToTranslation')">
                {{ t('settings.useSummaryConfig') }}
              </button>
              <button
                @click="emit('testConnection', 'translation')"
                :disabled="serviceTesting.translation || !translationConfig.api_key || !translationConfig.base_url || !translationConfig.model_name"
                class="test-btn"
                :class="{
                  loading: serviceTesting.translation,
                  success: serviceTestResult.translation?.success,
                  error: serviceTestResult.translation?.success === false
                }"
              >
                {{ serviceTesting.translation ? t('common.testing') : t('settings.testConnection') }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('settings.apiKey') }}</label>
            <input
              v-model="translationConfig.api_key"
              type="password"
              :placeholder="t('settings.translationApiKeyPlaceholder')"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('settings.apiUrl') }}</label>
            <input
              v-model="translationConfig.base_url"
              type="text"
              :placeholder="t('settings.apiUrlPlaceholder')"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('settings.modelName') }}</label>
            <input
              v-model="translationConfig.model_name"
              type="text"
              :placeholder="t('settings.translationModelPlaceholder')"
              class="form-input"
            />
          </div>
        </div>

        <div
          v-if="serviceTestResult.translation"
          class="test-result"
          :class="{ success: serviceTestResult.translation.success, error: !serviceTestResult.translation.success }"
        >
          {{ serviceTestResult.translation.message }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-config-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.ai-config-card__content {
  flex: 1;
}

.ai-config-card__header {
  min-height: 52px; /* Ensure alignment despite text diff */
}
</style>

