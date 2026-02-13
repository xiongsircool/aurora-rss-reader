<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocalServiceConfig } from '../../composables/useSettingsModal'
import type { TestResult } from '../../composables/useAIConfigSettings'

const props = defineProps<{
  config: LocalServiceConfig
  testing: boolean
  testResult: TestResult | null
  showCopyButton?: boolean
  subtitle?: string
}>()

const emit = defineEmits<{
  'update:config': [config: LocalServiceConfig]
  'test': []
  'copy': []
}>()

const { t } = useI18n()
const showApiKey = ref(false)

function updateField(field: keyof LocalServiceConfig, value: string) {
  emit('update:config', { ...props.config, [field]: value })
}

const isConfigComplete = computed(() => {
  return !!(props.config.api_key && props.config.base_url && props.config.model_name)
})
</script>

<template>
  <div class="ai-service-form">
    <!-- Subtitle -->
    <p v-if="subtitle" class="form-subtitle">{{ subtitle }}</p>

    <!-- Copy Button -->
    <button
      v-if="showCopyButton"
      @click="emit('copy')"
      class="copy-btn"
    >
      <span class="i-carbon-copy"></span>
      <span>{{ t('settings.copySummaryConfig') }}</span>
    </button>

    <!-- Form Fields -->
    <div class="form-grid">
      <!-- API Key -->
      <div class="form-field full-width">
        <label class="field-label">
          <span class="i-carbon-password"></span>
          <span>{{ t('settings.apiKey') }}</span>
        </label>
        <div class="input-wrapper">
          <input
            :value="config.api_key"
            @input="updateField('api_key', ($event.target as HTMLInputElement).value)"
            :type="showApiKey ? 'text' : 'password'"
            :placeholder="t('settings.apiKeyPlaceholder')"
            class="form-input"
          />
          <button
            type="button"
            @click="showApiKey = !showApiKey"
            class="input-icon-btn"
          >
            <span :class="showApiKey ? 'i-carbon-view-off' : 'i-carbon-view'"></span>
          </button>
        </div>
      </div>

      <!-- API URL -->
      <div class="form-field">
        <label class="field-label">
          <span class="i-carbon-cloud"></span>
          <span>{{ t('settings.apiUrl') }}</span>
        </label>
        <input
          :value="config.base_url"
          @input="updateField('base_url', ($event.target as HTMLInputElement).value)"
          type="text"
          :placeholder="t('settings.apiUrlPlaceholder')"
          class="form-input"
        />
      </div>

      <!-- Model Name -->
      <div class="form-field">
        <label class="field-label">
          <span class="i-carbon-model"></span>
          <span>{{ t('settings.modelName') }}</span>
        </label>
        <input
          :value="config.model_name"
          @input="updateField('model_name', ($event.target as HTMLInputElement).value)"
          type="text"
          :placeholder="t('settings.modelPlaceholder')"
          class="form-input"
        />
      </div>
    </div>

    <!-- Test Result -->
    <Transition name="slide-fade">
      <div
        v-if="testResult"
        class="test-result"
        :class="testResult.success ? 'success' : 'error'"
      >
        <span :class="testResult.success ? 'i-carbon-checkmark-filled' : 'i-carbon-warning-filled'"></span>
        <span>{{ testResult.message }}</span>
      </div>
    </Transition>

    <!-- Actions -->
    <div class="form-actions">
      <p class="hint-text">{{ t('settings.openaiCompatible') }}</p>
      <button
        @click="emit('test')"
        :disabled="testing || !isConfigComplete"
        class="test-btn"
        :class="{
          'success': testResult?.success,
          'error': testResult?.success === false
        }"
      >
        <span v-if="testing" class="i-carbon-circle-dash animate-spin"></span>
        <span v-else :class="testResult?.success ? 'i-carbon-checkmark' : 'i-carbon-flash'"></span>
        <span>{{ testing ? t('common.testing') : t('settings.testConnection') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-service-form {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
  border-color: var(--orange-500);
  transform: translateY(-1px);
}

.form-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.field-label > span:first-child {
  font-size: 1rem;
  color: var(--text-tertiary);
}

.input-wrapper {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  outline: none;
  transition: all 0.2s;
}

.input-wrapper .form-input {
  padding-right: 2.5rem;
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-input:focus {
  border-color: var(--orange-500);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.input-icon-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.375rem;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.input-icon-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-surface);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  margin-top: 1rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.test-result.success {
  color: var(--green-600);
  background: rgba(34, 197, 94, 0.1);
}

.test-result.error {
  color: var(--red-600);
  background: rgba(239, 68, 68, 0.1);
}

.test-result > span:first-child {
  font-size: 1.125rem;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-color);
}

.hint-text {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.test-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: linear-gradient(135deg, var(--orange-500), var(--orange-600));
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.2);
  transition: all 0.2s;
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.test-btn.success {
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);
}

.test-btn.error {
  background: linear-gradient(135deg, var(--red-500), var(--red-600));
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
