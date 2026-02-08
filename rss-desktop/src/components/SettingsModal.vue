<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useSettingsModal } from '../composables/useSettingsModal'
import { useRSSHubSettings } from '../composables/useRSSHubSettings'
import { useAIConfigSettings } from '../composables/useAIConfigSettings'
import { useRefreshSettings } from '../composables/useRefreshSettings'
import { clampAutoTitleTranslationLimit } from '../constants/translation'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import ConfirmModal from './common/ConfirmModal.vue'

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
const {
  show: confirmShow,
  options: confirmOptions,
  requestConfirm,
  handleConfirm,
  handleCancel
} = useConfirmDialog()
const aiConfig = useAIConfigSettings(localConfig, requestConfirm)
const refresh = useRefreshSettings()

// Navigation
type Category = 'general' | 'display' | 'sync' | 'intelligence'
const activeCategory = ref<Category>('general')
const isMobileDetailOpen = ref(false)

const categories = [
  { id: 'general', label: 'settings.general', icon: 'i-carbon-settings' },
  { id: 'display', label: 'settings.displaySettings', icon: 'i-carbon-screen' },
  { id: 'sync', label: 'settings.sync', icon: 'i-carbon-renew' },
  { id: 'intelligence', label: 'settings.aiConfig', icon: 'i-carbon-machine-learning' },
]

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

const aiPromptPreference = ref(settingsStore.settings.ai_prompt_preference)

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
        aiConfig.resetMcpTestResult()
        rsshub.resetTestResult()
      }
    )
    refresh.syncFromStore()
    // Sync the local autoTitleTranslationLimit with store value
    autoTitleTranslationLimit.value = settingsStore.settings.max_auto_title_translations
    // Sync the local aiPromptPreference with store value
    aiPromptPreference.value = settingsStore.settings.ai_prompt_preference

    // Reset view state
    activeCategory.value = 'general'
    isMobileDetailOpen.value = false

    // Auto-test MCP connection on modal open
    aiConfig.testMcp()

    // Lock body scroll
    document.body.style.overflow = 'hidden'
  } else {
    // Unlock body scroll
    document.body.style.overflow = ''
  }
})

// Ensure scroll is unlocked when component is unmounted
onMounted(() => {
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.body.style.overflow = ''
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

function selectCategory(id: string) {
  activeCategory.value = id as Category
  isMobileDetailOpen.value = true
}

function backToCategories() {
  isMobileDetailOpen.value = false
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
    await settingsStore.updateSettings({
      max_auto_title_translations: clampedLimit,
      ai_prompt_preference: aiPromptPreference.value
    })
    
    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-1000 flex items-center justify-center p-0 md:p-4 backdrop-blur-md bg-black/40 dark:bg-black/60" @click="handleBackdropClick">
      
      <!-- Main Modal Container -->
      <div
        class="
          w-full max-w-4xl h-[85vh] md:h-[85vh] h-full
          flex flex-col md:flex-row
          rounded-none md:rounded-2xl overflow-hidden
          bg-[var(--bg-base)] md:bg-white/80 md:dark:bg-[#0f1115]/75
          md:backdrop-blur-2xl
          border-0 md:border border-white/20 dark:border-white/10
          shadow-none md:shadow-2xl md:shadow-black/40
          relative top-0 md:top-auto
        "
      >

        <!-- Sidebar (Desktop) / Category List (Mobile) -->
        <div
          class="
            w-full md:w-64 shrink-0
            flex flex-col
            bg-[var(--bg-surface)]
            border-r border-[var(--border-color)]
            transition-transform duration-300 absolute inset-0 z-20 md:relative md:transform-none md:z-0
          "
          :class="isMobileDetailOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'"
        >
          <div class="p-6 pb-4">
            <h2 class="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent m-0">
              {{ t('settings.title') }}
            </h2>
          </div>

          <div class="flex-1 overflow-y-auto px-3 space-y-1">
            <button
              v-for="cat in categories"
              :key="cat.id"
              @click="selectCategory(cat.id)"
              class="
                w-full flex items-center justify-between px-4 py-3 rounded-xl
                text-sm font-medium transition-all duration-200
                group mb-1
              "
              :class="
                activeCategory === cat.id
                  ? 'bg-orange-500/10 dark:bg-white/5 text-orange-600 dark:text-white border-l-3 border-orange-500 dark:border-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border-l-3 border-transparent'
              "
            >
              <div class="flex items-center gap-3">
                <span :class="[cat.icon, 'text-lg transition-colors', activeCategory === cat.id ? 'text-orange-500 dark:text-white' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]']"></span>
                <span>{{ t(cat.label) }}</span>
              </div>
              <span class="i-carbon-chevron-right text-[var(--text-tertiary)] md:hidden"></span>
            </button>
          </div>

          <!-- Bottom Actions (Mobile only in list view) -->
          <div class="p-4 border-t border-[var(--border-color)] md:hidden space-y-3">
             <button @click="saveSettings" class="w-full py-3 rounded-xl font-medium bg-orange-500 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
              {{ t('settings.save') }}
            </button>
            <button @click="handleClose" class="w-full py-3 rounded-xl font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] active:scale-95 transition-transform">
              {{ t('settings.cancel') }}
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div
          class="
            flex-1 flex flex-col h-full relative
            bg-[var(--bg-base)] md:bg-transparent
          "
           :class="isMobileDetailOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'"
        >
          <!-- Mobile Header -->
          <div class="md:hidden flex items-center gap-3 p-4 sticky top-0 z-10 backdrop-blur-xl bg-[var(--bg-surface)]/80 dark:bg-[#0f1115]/80 border-b border-[var(--border-color)]">
            <button @click="backToCategories" class="p-1 -ml-1 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all flex items-center gap-1 bg-transparent">
              <span class="i-carbon-chevron-left text-2xl text-orange-500 dark:text-white"></span>
              <span class="text-base font-bold text-[var(--text-primary)]">{{ t('settings.title') }}</span>
            </button>
            <div class="flex-1"></div>
          </div>

          <!-- Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
            <Transition name="fade" mode="out-in">
              <div :key="activeCategory" class="max-w-3xl mx-auto space-y-6">
                
                <!-- General Section -->
                <div v-if="activeCategory === 'general'" class="space-y-6">
                   <div class="setting-group">
                      <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.general') }}</h3>
                      <SettingsLanguage />
                   </div>
                   <div class="setting-group">
                      <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.about') }}</h3>
                      <SettingsAbout />
                   </div>
                </div>

                <!-- Display Section -->
                <div v-if="activeCategory === 'display'" class="space-y-6">
                  <div class="setting-group">
                    <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.displaySettings') }}</h3>
                    <SettingsDisplay
                      v-model:showEntrySummary="showEntrySummary"
                      v-model:enableDateFilter="enableDateFilter"
                      v-model:defaultDateRange="defaultDateRange"
                      v-model:timeField="timeField"
                      v-model:openOriginalMode="openOriginalMode"
                      v-model:markAsReadRange="markAsReadRange"
                      v-model:detailsPanelMode="detailsPanelMode"
                    />
                  </div>
                </div>

                <!-- Sync Section -->
                <div v-if="activeCategory === 'sync'" class="space-y-6">
                  <div class="setting-group">
                    <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.sync') }}</h3>
                    <SettingsRSSHub
                      v-model:rsshubUrl="rsshub.rsshubUrl.value"
                      :isTestingRSSHub="rsshub.isTestingRSSHub.value"
                      :rsshubTestResult="rsshub.rsshubTestResult.value"
                      @testConnection="rsshub.testRSSHubConnection"
                    />
                    <div class="h-6"></div>
                    <SettingsRefresh
                      v-model:autoRefresh="refresh.autoRefresh.value"
                      v-model:fetchIntervalInput="refresh.fetchIntervalInput.value"
                      :fetchIntervalError="refresh.fetchIntervalError.value"
                      @change="refresh.handleFetchIntervalChange"
                      @auto-refresh-change="refresh.handleAutoRefreshChange"
                    />
                  </div>
                </div>

                <!-- Intelligence Section -->
                <div v-if="activeCategory === 'intelligence'" class="space-y-6">
                  <div class="setting-group">
                    <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.aiConfig') }}</h3>
                    <SettingsAIConfig
                      v-model:summaryConfig="localConfig.summary"
                      v-model:translationConfig="localConfig.translation"
                      v-model:taggingConfig="localConfig.tagging"
                      v-model:embeddingConfig="localConfig.embedding"
                      :serviceTesting="aiConfig.serviceTesting.value"
                      :serviceTestResult="aiConfig.serviceTestResult.value"
                      :rebuildingVectors="aiConfig.rebuildingVectors.value"
                      :rebuildResult="aiConfig.rebuildResult.value"
                      :mcpTesting="aiConfig.mcpTesting.value"
                      :mcpTestResult="aiConfig.mcpTestResult.value"
                      @testConnection="aiConfig.testConnection"
                      @copySummaryToTranslation="aiConfig.copySummaryToTranslation"
                      @rebuildVectors="aiConfig.rebuildVectors"
                      @testMcp="aiConfig.testMcp"
                    />
                    <div class="h-6"></div>
                    <SettingsAIFeatures
                      v-model:features="localConfig.features"
                      v-model:autoTitleTranslationLimit="autoTitleTranslationLimit"
                      v-model:aiPromptPreference="aiPromptPreference"
                    />
                  </div>
                </div>

              </div>
            </Transition>
          </div>

          <!-- Desktop Actions Footer -->
          <div class="hidden md:flex items-center justify-end gap-3 p-6 border-t border-[var(--border-color)] bg-white/50 dark:bg-[var(--bg-surface)]/50 backdrop-blur-sm">
            <button
              @click="handleClose"
              class="
                px-5 py-2.5 rounded-xl font-medium text-sm transition-all
                text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
              "
            >
              {{ t('settings.cancel') }}
            </button>
            <button
              @click="saveSettings"
              class="
                px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all
                bg-gradient-to-r from-orange-500 to-orange-600
                hover:shadow-lg hover:shadow-orange-500/25 hover:-translate-y-0.5
                active:translate-y-0
              "
            >
              {{ t('settings.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <ConfirmModal
    :show="confirmShow"
    :title="confirmOptions.title || ''"
    :message="confirmOptions.message"
    :confirm-text="confirmOptions.confirmText"
    :cancel-text="confirmOptions.cancelText"
    :danger="confirmOptions.danger"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<style scoped>
/* Modal Transitions */
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
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
  opacity: 0;
}

/* Fade Transition for Tab Content */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
