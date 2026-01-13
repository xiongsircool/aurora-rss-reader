<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useSettingsModal } from '../composables/useSettingsModal'
import { useRSSHubSettings } from '../composables/useRSSHubSettings'
import { useAIConfigSettings } from '../composables/useAIConfigSettings'
import { useRefreshSettings } from '../composables/useRefreshSettings'
import { clampAutoTitleTranslationLimit } from '../constants/translation'

// Section Components
import {
  SettingsLanguage,
  SettingsRSSHub,
  SettingsAIConfig,
  SettingsAIFeatures,
  SettingsRefresh,
  SettingsDisplay,
  SettingsAbout
} from './settings'

// Import shared styles
import './settings/settings.css'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// Initialize composables
const { localConfig, initializeSettings, saveAIConfig } = useSettingsModal()
const rsshub = useRSSHubSettings()
const aiConfig = useAIConfigSettings(localConfig)
const refresh = useRefreshSettings()

// Display settings - synced with store
const showEntrySummary = computed({
  get: () => settingsStore.settings.show_entry_summary,
  set: (value) => settingsStore.updateSettings({ show_entry_summary: value })
})

const enableDateFilter = computed({
  get: () => settingsStore.settings.enable_date_filter,
  set: (value) => settingsStore.updateSettings({ enable_date_filter: value })
})

const defaultDateRange = computed({
  get: () => settingsStore.settings.default_date_range,
  set: (value) => settingsStore.updateSettings({ default_date_range: value })
})

const timeField = computed({
  get: () => settingsStore.settings.time_field,
  set: (value) => settingsStore.updateSettings({ time_field: value })
})

const autoTitleTranslationLimit = computed({
  get: () => settingsStore.settings.max_auto_title_translations,
  set: (value: number) => {
    const clamped = clampAutoTitleTranslationLimit(value)
    settingsStore.updateSettings({ max_auto_title_translations: clamped })
  }
})

const markAsReadRange = computed({
  get: () => settingsStore.settings.mark_as_read_range,
  set: (value) => settingsStore.updateSettings({ mark_as_read_range: value })
})

// Watch modal visibility
watch(() => props.show, async (show) => {
  if (show) {
    await initializeSettings(
      rsshub.fetchRSSHubUrl,
      () => {
        aiConfig.resetTestResults()
        rsshub.resetTestResult()
      }
    )
    refresh.syncFromStore()
  }
})

// Event handlers
function handleClose() {
  emit('close')
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

async function saveSettings() {
  try {
    const fetchIntervalValid = await refresh.commitFetchInterval()
    if (!fetchIntervalValid) return

    if (rsshub.rsshubUrl.value) {
      await rsshub.saveRSSHubUrl()
    }

    await saveAIConfig()
    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-backdrop" @click="handleBackdropClick">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ t('settings.title') }}</h2>
          <button @click="handleClose" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <SettingsLanguage />

          <SettingsRSSHub
            v-model:rsshubUrl="rsshub.rsshubUrl.value"
            :isTestingRSSHub="rsshub.isTestingRSSHub.value"
            :rsshubTestResult="rsshub.rsshubTestResult.value"
            @testConnection="rsshub.testRSSHubConnection"
          />

          <SettingsAIConfig
            v-model:summaryConfig="localConfig.summary"
            v-model:translationConfig="localConfig.translation"
            :serviceTesting="aiConfig.serviceTesting.value"
            :serviceTestResult="aiConfig.serviceTestResult.value"
            @testConnection="aiConfig.testConnection"
            @copySummaryToTranslation="aiConfig.copySummaryToTranslation"
          />

          <SettingsAIFeatures
            v-model:features="localConfig.features"
            :autoTitleTranslationLimit="autoTitleTranslationLimit"
            @update:autoTitleTranslationLimit="autoTitleTranslationLimit = $event"
          />

          <SettingsRefresh
            v-model:fetchIntervalInput="refresh.fetchIntervalInput.value"
            :fetchIntervalError="refresh.fetchIntervalError.value"
            @change="refresh.handleFetchIntervalChange"
          />

          <SettingsDisplay
            v-model:showEntrySummary="showEntrySummary"
            v-model:enableDateFilter="enableDateFilter"
            v-model:defaultDateRange="defaultDateRange"
            v-model:timeField="timeField"
            v-model:markAsReadRange="markAsReadRange"
          />

          <SettingsAbout />
        </div>

        <div class="modal-footer">
          <button @click="handleClose" class="btn btn-secondary">{{ t('settings.cancel') }}</button>
          <button @click="saveSettings" class="btn btn-primary">{{ t('settings.save') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  --settings-accent: #4c74ff;
  --settings-accent-strong: #2f54ff;
  --settings-muted: #5a6276;
  background: var(--settings-modal-bg, linear-gradient(180deg, #ffffff 0%, #f5f7fc 100%));
  color: var(--text-primary, #0f1419);
  border-radius: 18px;
  width: 92%;
  max-width: 640px;
  max-height: 82vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--settings-modal-border, rgba(15, 20, 25, 0.08));
  box-shadow:
    0 20px 60px rgba(15, 20, 25, 0.25),
    0 2px 8px rgba(15, 20, 25, 0.08);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.close-btn {
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--settings-modal-body-bg, rgba(255, 255, 255, 0.7));
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f2f4fb;
  color: var(--settings-muted, #5a6276);
  border: 1px solid rgba(92, 106, 138, 0.2);
}

.btn-secondary:hover {
  background: #e4e8f4;
}

.btn-primary {
  background: linear-gradient(130deg, var(--settings-accent, #4c74ff), var(--settings-accent-strong, #2f54ff));
  color: white;
  box-shadow: 0 12px 24px rgba(76, 116, 255, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(76, 116, 255, 0.3);
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
}

/* Modal body scrollbar */
.modal-body::-webkit-scrollbar { width: 8px; height: 8px; }
.modal-body::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.18); border-radius: 8px; }
.modal-body:hover::-webkit-scrollbar-thumb { background: rgba(15, 17, 21, 0.28); }
.modal-body { scrollbar-width: thin; scrollbar-color: rgba(15, 17, 21, 0.28) transparent; }

/* Dark mode */
:global(.dark) .modal-backdrop {
  background: rgba(0, 0, 0, 0.6);
}

:global(.dark) .modal-content {
  --settings-modal-bg: linear-gradient(180deg, #1c1f26 0%, #12151a 100%);
  --settings-modal-border: rgba(255, 255, 255, 0.12);
  --settings-modal-body-bg: rgba(18, 21, 26, 0.95);
  --settings-muted: #9ba1b3;
  background: var(--settings-modal-bg);
  border-color: var(--settings-modal-border);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

:global(.dark) .modal-header {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

:global(.dark) .modal-header h2 {
  color: var(--text-primary);
}

:global(.dark) .close-btn {
  color: var(--text-secondary);
}

:global(.dark) .close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

:global(.dark) .modal-body {
  background: var(--settings-modal-body-bg);
}

:global(.dark) .modal-footer {
  border-color: var(--border-color);
}

:global(.dark) .btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

:global(.dark) .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .modal-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .modal-body:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
:global(.dark) .modal-body { scrollbar-color: rgba(255, 255, 255, 0.36) transparent; }
</style>
