<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { getApiErrorMessage } from '../api/errors'
import { useSettingsModal } from '../composables/useSettingsModal'
import { useRSSHubSettings } from '../composables/useRSSHubSettings'
import { useAIConfigSettings } from '../composables/useAIConfigSettings'
import { useRefreshSettings } from '../composables/useRefreshSettings'
import { useProxySettings } from '../composables/useProxySettings'
import { clampAutoTitleTranslationLimit } from '../constants/translation'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import ConfirmModal from './common/ConfirmModal.vue'
import type { AutomationTarget } from '../composables/useSettingsModal'

const SettingsLanguage = defineAsyncComponent(() => import('./settings/SettingsLanguage.vue'))
const SettingsProxy = defineAsyncComponent(() => import('./settings/SettingsProxy.vue'))
const SettingsRSSHub = defineAsyncComponent(() => import('./settings/SettingsRSSHub.vue'))
const SettingsAIConfig = defineAsyncComponent(() => import('./settings/SettingsAIConfig.vue'))
const SettingsAIFeatures = defineAsyncComponent(() => import('./settings/SettingsAIFeatures.vue'))
const SettingsAIAutomation = defineAsyncComponent(() => import('./settings/SettingsAIAutomation.vue'))
const SettingsTagRerun = defineAsyncComponent(() => import('./settings/SettingsTagRerun.vue'))
const SettingsRefresh = defineAsyncComponent(() => import('./settings/SettingsRefresh.vue'))
const SettingsDisplay = defineAsyncComponent(() => import('./settings/SettingsDisplay.vue'))
const SettingsAbout = defineAsyncComponent(() => import('./settings/SettingsAbout.vue'))

type Category = 'general' | 'display' | 'sync' | 'intelligence'

const props = withDefaults(defineProps<{
  show: boolean
  initialCategory?: Category
  initialAutomationTarget?: AutomationTarget | null
}>(), {
  initialCategory: 'general',
  initialAutomationTarget: null,
})

const emit = defineEmits<{
  close: []
  notify: [message: string, type: 'success' | 'error' | 'info']
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// Initialize composables
const {
  localConfig,
  localAutomationRules,
  localScopedAutomationRules,
  currentAutomationTarget,
  initializeSettings,
  saveAIConfig,
  syncFromStore,
} = useSettingsModal()
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
const proxy = useProxySettings()

// Navigation
const activeCategory = ref<Category>(props.initialCategory)
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

const summaryPromptPreference = ref(settingsStore.settings.summary_prompt_preference)
const translationPromptPreference = ref(settingsStore.settings.translation_prompt_preference)
const scopeSummaryEnabled = ref(settingsStore.settings.scope_summary_enabled)
const scopeSummaryAutoGenerate = ref(settingsStore.settings.scope_summary_auto_generate)
const scopeSummaryAutoIntervalMinutes = ref(settingsStore.settings.scope_summary_auto_interval_minutes)
const scopeSummaryDefaultWindow = ref<'24h' | '3d' | '7d' | '30d'>(settingsStore.settings.scope_summary_default_window)
const scopeSummaryMaxEntries = ref(settingsStore.settings.scope_summary_max_entries)
const scopeSummaryChunkSize = ref(settingsStore.settings.scope_summary_chunk_size)
const scopeSummaryModelName = ref(settingsStore.settings.scope_summary_model_name)
const scopeSummaryUseCustom = ref(settingsStore.settings.scope_summary_use_custom)
const scopeSummaryBaseUrl = ref(settingsStore.settings.scope_summary_base_url)
const scopeSummaryApiKey = ref(settingsStore.settings.scope_summary_api_key)

const markAsReadRange = computed({
  get: () => settingsStore.settings.mark_as_read_range,
  set: (value) => settingsStore.updateSettings({ mark_as_read_range: value })
})

const detailsPanelMode = computed({
  get: () => settingsStore.settings.details_panel_mode,
  set: (value) => settingsStore.updateSettings({ details_panel_mode: value })
})

const timelineFilterDensity = computed({
  get: () => settingsStore.settings.timeline_filter_density,
  set: (value) => settingsStore.updateSettings({ timeline_filter_density: value })
})

const automationScopeTitle = computed(() => {
  const target = currentAutomationTarget.value
  if (!target) return ''
  const label = target.scope_type === 'feed'
    ? t('settings.aiAutomationFeedTitle')
    : target.scope_type === 'group'
      ? t('settings.aiAutomationGroupTitle')
      : t('settings.aiAutomationTagTitle')
  return `${label} · ${target.label}`
})

const automationScopeHint = computed(() => {
  const target = currentAutomationTarget.value
  if (!target) return ''
  return target.scope_type === 'feed'
    ? t('settings.aiAutomationFeedHint')
    : target.scope_type === 'group'
      ? t('settings.aiAutomationGroupHint')
      : t('settings.aiAutomationTagHint')
})

const automationScopeBadge = computed(() => {
  const target = currentAutomationTarget.value
  if (!target) return ''
  return target.scope_type === 'feed'
    ? t('settings.aiAutomationFeedBadge')
    : target.scope_type === 'group'
      ? t('settings.aiAutomationGroupBadge')
      : t('settings.aiAutomationTagBadge')
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
    proxy.syncFromStore()
    await proxy.fetchProxyStatus()
    // Sync the local autoTitleTranslationLimit with store value
    autoTitleTranslationLimit.value = settingsStore.settings.max_auto_title_translations
    summaryPromptPreference.value = settingsStore.settings.summary_prompt_preference
    translationPromptPreference.value = settingsStore.settings.translation_prompt_preference
    scopeSummaryEnabled.value = settingsStore.settings.scope_summary_enabled
    scopeSummaryAutoGenerate.value = settingsStore.settings.scope_summary_auto_generate
    scopeSummaryAutoIntervalMinutes.value = settingsStore.settings.scope_summary_auto_interval_minutes
    scopeSummaryDefaultWindow.value = settingsStore.settings.scope_summary_default_window
    scopeSummaryMaxEntries.value = settingsStore.settings.scope_summary_max_entries
    scopeSummaryChunkSize.value = settingsStore.settings.scope_summary_chunk_size
    scopeSummaryModelName.value = settingsStore.settings.scope_summary_model_name
    scopeSummaryUseCustom.value = settingsStore.settings.scope_summary_use_custom
    scopeSummaryBaseUrl.value = settingsStore.settings.scope_summary_base_url
    scopeSummaryApiKey.value = settingsStore.settings.scope_summary_api_key
    syncFromStore(props.initialAutomationTarget ?? null)

    // Reset view state
    activeCategory.value = props.initialCategory
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

watch(() => props.initialAutomationTarget, (target) => {
  if (!props.show) return
  syncFromStore(target ?? null)
}, { deep: true })

// Ensure scroll is unlocked when component is unmounted
onMounted(() => {
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

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

    const proxyValid = await proxy.commitProxySettings()
    if (!proxyValid) return

    const aiSaved = await saveAIConfig()
    if (!aiSaved) {
      emit('notify', t('toast.settingsSaveFailed'), 'error')
      return
    }
    
    // Save autoTitleTranslationLimit to store
    const clampedLimit = clampAutoTitleTranslationLimit(autoTitleTranslationLimit.value)
    const normalizedAutoInterval = Math.max(5, Math.min(240, Number(scopeSummaryAutoIntervalMinutes.value) || 60))
    const normalizedMaxEntries = Math.max(20, Math.min(200, Number(scopeSummaryMaxEntries.value) || 100))
    const normalizedChunkSize = Math.max(5, Math.min(25, Number(scopeSummaryChunkSize.value) || 10))
    await settingsStore.updateSettings({
      max_auto_title_translations: clampedLimit,
      summary_prompt_preference: summaryPromptPreference.value,
      translation_prompt_preference: translationPromptPreference.value,
      scope_summary_enabled: scopeSummaryEnabled.value,
      scope_summary_auto_generate: scopeSummaryAutoGenerate.value,
      scope_summary_auto_interval_minutes: normalizedAutoInterval,
      scope_summary_default_window: scopeSummaryDefaultWindow.value,
      scope_summary_max_entries: normalizedMaxEntries,
      scope_summary_chunk_size: normalizedChunkSize,
      scope_summary_model_name: scopeSummaryModelName.value,
      scope_summary_use_custom: scopeSummaryUseCustom.value,
      scope_summary_base_url: scopeSummaryBaseUrl.value,
      scope_summary_api_key: scopeSummaryApiKey.value
    })
    emit('notify', t('toast.settingsSaved'), 'success')
    emit('close')
  } catch (error) {
    console.error('保存设置失败:', error)
    emit('notify', getApiErrorMessage(error, t('toast.settingsSaveFailed')), 'error')
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-1000 flex items-center justify-center p-0 md:p-4 backdrop-blur-md bg-black/40 dark:bg-black/60" @click="handleBackdropClick">
      
      <!-- Main Modal Container -->
      <div
        class="
          w-full max-w-full md:max-w-[min(96vw,1100px)] h-[85vh] md:h-[85vh] h-full
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
              <div class="flex items-center gap-3 min-w-0">
                <span :class="[cat.icon, 'text-lg transition-colors', activeCategory === cat.id ? 'text-orange-500 dark:text-white' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]']"></span>
                <span class="min-w-0 break-words text-left leading-snug">{{ t(cat.label) }}</span>
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
              <div :key="activeCategory" class="w-full max-w-[min(100%,900px)] mx-auto space-y-6 min-w-0">
                
                <!-- General Section -->
                <div v-if="activeCategory === 'general'" class="space-y-6">
                   <div class="setting-group">
                      <h3 class="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider hidden md:block">{{ t('settings.general') }}</h3>
                      <SettingsLanguage />
                      <div class="h-6"></div>
                      <SettingsProxy
                        v-model:proxyMode="proxy.proxyMode.value"
                        v-model:proxyUrl="proxy.proxyUrl.value"
                        :proxyStatus="proxy.proxyStatus.value"
                        :proxyStatusLoading="proxy.proxyStatusLoading.value"
                        :proxyError="proxy.proxyError.value"
                        @refreshStatus="proxy.fetchProxyStatus"
                      />
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
                      v-model:timelineFilterDensity="timelineFilterDensity"
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
                      v-model:globalConfig="localConfig.global"
                      v-model:summaryConfig="localConfig.summary"
                      v-model:translationConfig="localConfig.translation"
                      v-model:taggingConfig="localConfig.tagging"
                      v-model:embeddingConfig="localConfig.embedding"
                      :globalTesting="aiConfig.globalTesting.value"
                      :globalTestResult="aiConfig.globalTestResult.value"
                      :serviceTesting="aiConfig.serviceTesting.value"
                      :serviceTestResult="aiConfig.serviceTestResult.value"
                      :rebuildingVectors="aiConfig.rebuildingVectors.value"
                      :rebuildResult="aiConfig.rebuildResult.value"
                      :mcpTesting="aiConfig.mcpTesting.value"
                      :mcpTestResult="aiConfig.mcpTestResult.value"
                      @testGlobalConnection="aiConfig.testGlobalConnection"
                      @testConnection="aiConfig.testConnection"
                      @rebuildVectors="aiConfig.rebuildVectors"
                      @testMcp="aiConfig.testMcp"
                    />
                    <div class="h-6"></div>
                    <SettingsAIFeatures
                      v-model:features="localConfig.features"
                      v-model:autoTitleTranslationLimit="autoTitleTranslationLimit"
                      v-model:summaryPromptPreference="summaryPromptPreference"
                      v-model:translationPromptPreference="translationPromptPreference"
                      v-model:scopeSummaryEnabled="scopeSummaryEnabled"
                      v-model:scopeSummaryAutoGenerate="scopeSummaryAutoGenerate"
                      v-model:scopeSummaryAutoIntervalMinutes="scopeSummaryAutoIntervalMinutes"
                      v-model:scopeSummaryDefaultWindow="scopeSummaryDefaultWindow"
                      v-model:scopeSummaryMaxEntries="scopeSummaryMaxEntries"
                      v-model:scopeSummaryChunkSize="scopeSummaryChunkSize"
                      v-model:scopeSummaryModelName="scopeSummaryModelName"
                      v-model:scopeSummaryUseCustom="scopeSummaryUseCustom"
                      v-model:scopeSummaryBaseUrl="scopeSummaryBaseUrl"
                      v-model:scopeSummaryApiKey="scopeSummaryApiKey"
                    />
                    <div class="h-6"></div>
                    <SettingsAIAutomation
                      v-model:rules="localAutomationRules"
                      :title="t('settings.aiAutomation')"
                      :hint="t('settings.aiAutomationHint')"
                      :badge="t('settings.aiAutomationGlobalOnly')"
                    />
                    <div v-if="currentAutomationTarget" class="h-6"></div>
                    <SettingsAIAutomation
                      v-if="currentAutomationTarget"
                      v-model:rules="localScopedAutomationRules"
                      :title="automationScopeTitle"
                      :hint="automationScopeHint"
                      :badge="automationScopeBadge"
                      :allow-inherit="true"
                    />
                    <div class="h-6"></div>
                    <SettingsTagRerun />
                  </div>
                </div>

              </div>
            </Transition>
          </div>

          <!-- Desktop Actions Footer -->
          <div class="hidden md:flex flex-wrap items-center justify-end gap-3 p-6 border-t border-[var(--border-color)] bg-white/50 dark:bg-[var(--bg-surface)]/50 backdrop-blur-sm">
            <button
              @click="handleClose"
              class="
                px-5 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-normal text-center
                text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
              "
            >
              {{ t('settings.cancel') }}
            </button>
            <button
              @click="saveSettings"
              class="
                px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all whitespace-normal text-center
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
