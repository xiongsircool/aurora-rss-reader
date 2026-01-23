<script setup lang="ts">
import { computed, watch, ref } from 'vue'
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

const openOriginalMode = computed({
  get: () => settingsStore.settings.open_original_mode,
  set: (value) => settingsStore.updateSettings({ open_original_mode: value })
})

const autoTitleTranslationLimit = ref(settingsStore.settings.max_auto_title_translations)

const markAsReadRange = computed({
  get: () => settingsStore.settings.mark_as_read_range,
  set: (value) => settingsStore.updateSettings({ mark_as_read_range: value })
})

const detailsPanelMode = computed({
  get: () => settingsStore.settings.details_panel_mode,
  set: (value) => settingsStore.updateSettings({ details_panel_mode: value })
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
    // Sync the local autoTitleTranslationLimit with store value
    autoTitleTranslationLimit.value = settingsStore.settings.max_auto_title_translations
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
    const autoRefreshValid = await refresh.commitAutoRefresh()
    if (!autoRefreshValid) return

    const fetchIntervalValid = await refresh.commitFetchInterval()
    if (!fetchIntervalValid) return

    if (rsshub.rsshubUrl.value) {
      await rsshub.saveRSSHubUrl()
    }

    await saveAIConfig()
    
    // Save autoTitleTranslationLimit to store
    const clampedLimit = clampAutoTitleTranslationLimit(autoTitleTranslationLimit.value)
    await settingsStore.updateSettings({ max_auto_title_translations: clampedLimit })
    
    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 bg-black/50 flex items-center justify-center z-1000 backdrop-blur-[4px] dark:bg-black/60" @click="handleBackdropClick">
      <div class="w-[92%] max-w-[640px] max-h-[82vh] overflow-hidden flex flex-col rounded-[18px] border border-[rgba(15,20,25,0.08)] bg-gradient-to-b from-white to-[#f5f7fc] shadow-[0_20px_60px_rgba(15,20,25,0.25),0_2px_8px_rgba(15,20,25,0.08)] dark:bg-[linear-gradient(180deg,#1c1f26_0%,#12151a_100%)] dark:border-[rgba(255,255,255,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)] modal-content">
        <div class="flex justify-between items-center p-6 border-b border-[var(--border-color)] dark:border-[rgba(255,255,255,0.1)] dark:bg-black/20">
          <h2 class="m-0 text-xl c-[var(--text-primary)]">{{ t('settings.title') }}</h2>
          <button @click="handleClose" class="border-none bg-transparent text-2xl cursor-pointer c-[var(--text-secondary)] p-1 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/8 dark:hover:c-[var(--text-primary)]">✕</button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 bg-[rgba(255,255,255,0.7)] dark:bg-[rgba(18,21,26,0.95)] modal-body">
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
            v-model:autoTitleTranslationLimit="autoTitleTranslationLimit"
          />

          <SettingsRefresh
            v-model:autoRefresh="refresh.autoRefresh.value"
            v-model:fetchIntervalInput="refresh.fetchIntervalInput.value"
            :fetchIntervalError="refresh.fetchIntervalError.value"
            @change="refresh.handleFetchIntervalChange"
            @auto-refresh-change="refresh.handleAutoRefreshChange"
          />

          <SettingsDisplay
            v-model:showEntrySummary="showEntrySummary"
            v-model:enableDateFilter="enableDateFilter"
            v-model:defaultDateRange="defaultDateRange"
            v-model:timeField="timeField"
            v-model:openOriginalMode="openOriginalMode"
            v-model:markAsReadRange="markAsReadRange"
            v-model:detailsPanelMode="detailsPanelMode"
          />

          <SettingsAbout />
        </div>

        <div class="flex justify-end gap-3 p-[16px_24px] border-t border-[var(--border-color)] dark:border-[var(--border-color)]">
          <button @click="handleClose" class="px-5 py-2.5 rounded-lg border-none text-sm font-medium cursor-pointer transition-all bg-[#f2f4fb] c-[#5a6276] border border-[rgba(92,106,138,0.2)] hover:bg-[#e4e8f4] dark:bg-white/6 dark:c-[var(--text-primary)] dark:border-white/16 dark:hover:bg-white/10">{{ t('settings.cancel') }}</button>
          <button @click="saveSettings" class="px-5 py-2.5 rounded-lg border-none text-sm font-medium cursor-pointer transition-all bg-gradient-to-br from-[#4c74ff] to-[#2f54ff] c-white shadow-[0_12px_24px_rgba(76,116,255,0.25)] hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(76,116,255,0.3)]">{{ t('settings.save') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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

:global(.dark) .modal-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); }
:global(.dark) .modal-body:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.36); }
:global(.dark) .modal-body { scrollbar-color: rgba(255, 255, 255, 0.36) transparent; }
</style>
