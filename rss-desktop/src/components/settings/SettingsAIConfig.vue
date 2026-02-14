<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocalGlobalConfig, LocalServiceConfig } from '../../composables/useSettingsModal'
import type { TestResult } from '../../composables/useAIConfigSettings'
import { PROVIDER_PRESETS, type AIServiceKey } from '../../stores/aiStore'

const props = defineProps<{
  globalTesting: boolean
  globalTestResult: TestResult | null
  serviceTesting: Record<AIServiceKey, boolean>
  serviceTestResult: Record<AIServiceKey, TestResult | null>
  rebuildingVectors: boolean
  rebuildResult: TestResult | null
  mcpTesting: boolean
  mcpTestResult: TestResult | null
}>()

const emit = defineEmits<{
  testGlobalConnection: []
  testConnection: [service: AIServiceKey]
  rebuildVectors: []
  testMcp: []
}>()

const { t } = useI18n()

const globalConfig = defineModel<LocalGlobalConfig>('globalConfig', { required: true })
const summaryConfig = defineModel<LocalServiceConfig>('summaryConfig', { required: true })
const translationConfig = defineModel<LocalServiceConfig>('translationConfig', { required: true })
const taggingConfig = defineModel<LocalServiceConfig>('taggingConfig', { required: true })
const embeddingConfig = defineModel<LocalServiceConfig>('embeddingConfig', { required: true })

// Tab navigation for service overrides
type ServiceTab = 'summary' | 'translation' | 'tagging' | 'embedding' | 'mcp'
const activeTab = ref<ServiceTab>('summary')

// API Key visibility state
const showGlobalApiKey = ref(false)
const showServiceApiKey = reactive<Record<ServiceTab, boolean>>({
  summary: false,
  translation: false,
  tagging: false,
  embedding: false,
  mcp: false
})

// Provider dropdown
const showProviderDropdown = ref(false)

const serviceTabs: { id: ServiceTab; icon: string; labelKey: string }[] = [
  { id: 'summary', icon: 'i-carbon-document', labelKey: 'settings.summaryGeneration' },
  { id: 'translation', icon: 'i-carbon-translate', labelKey: 'settings.contentTranslation' },
  { id: 'tagging', icon: 'i-carbon-tag-group', labelKey: 'settings.taggingClassification' },
  { id: 'embedding', icon: 'i-carbon-data-vis-4', labelKey: 'settings.embeddingService' },
  { id: 'mcp', icon: 'i-carbon-plug', labelKey: 'settings.mcpService' },
]

// Embedding is always custom — it uses a different model type (not a chat/LLM model)
const isAlwaysCustomTab = (tab: ServiceTab) => tab === 'embedding'

const currentServiceConfig = computed(() => {
  const map: Record<string, LocalServiceConfig> = {
    summary: summaryConfig.value,
    translation: translationConfig.value,
    tagging: taggingConfig.value,
    embedding: embeddingConfig.value,
  }
  return map[activeTab.value]
})

const selectedPreset = computed(() => {
  return PROVIDER_PRESETS.find(p => p.id === globalConfig.value.provider) || null
})

function selectProvider(preset: typeof PROVIDER_PRESETS[0]) {
  globalConfig.value.provider = preset.id
  if (preset.baseUrl) {
    globalConfig.value.base_url = preset.baseUrl
  }
  if (preset.defaultModel) {
    globalConfig.value.model_name = preset.defaultModel
  }
  showProviderDropdown.value = false
}

function selectModel(model: string) {
  globalConfig.value.model_name = model
}

function isServiceConfigured(tab: ServiceTab): boolean {
  if (tab === 'mcp') return props.mcpTestResult?.success ?? false
  const config = {
    summary: summaryConfig.value,
    translation: translationConfig.value,
    tagging: taggingConfig.value,
    embedding: embeddingConfig.value,
  }[tab]
  if (!config) return false
  // Embedding always uses its own config
  if (isAlwaysCustomTab(tab) || config.use_custom) {
    return !!(config.api_key && config.base_url && config.model_name)
  }
  return !!(globalConfig.value.api_key && globalConfig.value.base_url && globalConfig.value.model_name)
}
</script>

<template>
  <div class="space-y-5 min-w-0">
    <!-- ==================== Global Default Config ==================== -->
    <section class="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] overflow-hidden">
      <!-- Header -->
      <div class="px-5 py-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
        <div class="flex items-center gap-2">
          <span class="i-carbon-settings-adjust text-orange-500 text-lg"></span>
          <h3 class="m-0 text-sm font-semibold text-[var(--text-primary)]">{{ t('settings.globalDefaultConfig') }}</h3>
        </div>
        <p class="m-0 mt-1 text-xs text-[var(--text-tertiary)]">{{ t('settings.globalDefaultConfigHint') }}</p>
      </div>

      <div class="p-5">
        <!-- Provider Presets -->
        <div class="mb-5">
          <label class="block mb-2 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.providerPreset') }}</label>
          <div class="relative">
            <button
              type="button"
              @click="showProviderDropdown = !showProviderDropdown"
              class="w-full flex items-center justify-between px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] cursor-pointer hover:border-orange-500/50 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span v-if="selectedPreset" :class="selectedPreset.icon" class="text-base text-orange-500"></span>
                <span v-if="selectedPreset">{{ selectedPreset.name }}</span>
                <span v-else class="text-[var(--text-tertiary)]">{{ t('settings.selectProvider') }}</span>
              </div>
              <span class="i-carbon-chevron-down text-[var(--text-tertiary)] transition-transform" :class="{ 'rotate-180': showProviderDropdown }"></span>
            </button>

            <!-- Dropdown -->
            <Transition name="dropdown">
              <div
                v-if="showProviderDropdown"
                class="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
              >
                <button
                  v-for="preset in PROVIDER_PRESETS"
                  :key="preset.id"
                  @click="selectProvider(preset)"
                  class="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-none cursor-pointer transition-colors hover:bg-orange-500/5"
                  :class="{ 'bg-orange-500/10!': globalConfig.provider === preset.id }"
                >
                    <span :class="[preset.icon, 'text-lg shrink-0', globalConfig.provider === preset.id ? 'text-orange-500' : 'text-[var(--text-tertiary)]']"></span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-[var(--text-primary)]">{{ preset.name }}</div>
                    <div class="text-xs text-[var(--text-tertiary)] truncate">{{ preset.description }}</div>
                  </div>
                  <span v-if="globalConfig.provider === preset.id" class="i-carbon-checkmark text-orange-500 shrink-0"></span>
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- API Key -->
        <div class="mb-4">
          <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
          <div class="relative">
            <input
              v-model="globalConfig.api_key"
              :type="showGlobalApiKey ? 'text' : 'password'"
              :placeholder="t('settings.globalApiKeyPlaceholder')"
              class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
            <button
              type="button"
              @click="showGlobalApiKey = !showGlobalApiKey"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
            >
              <span :class="showGlobalApiKey ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
            </button>
          </div>
        </div>

        <!-- Base URL + Model -->
        <div class="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
            <input
              v-model="globalConfig.base_url"
              type="text"
              :placeholder="t('settings.apiUrlPlaceholder')"
              class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <div>
            <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
            <div class="relative">
              <input
                v-model="globalConfig.model_name"
                type="text"
                :placeholder="t('settings.modelPlaceholder')"
                class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>
            <!-- Quick model select chips -->
            <div v-if="selectedPreset && selectedPreset.models.length > 0" class="flex flex-wrap gap-1.5 mt-2">
              <button
                v-for="model in selectedPreset.models"
                :key="model"
                @click="selectModel(model)"
                type="button"
                class="px-2 py-0.5 rounded-md text-xs border transition-all cursor-pointer"
                :class="globalConfig.model_name === model
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 font-medium'
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-tertiary)] hover:border-orange-500/30 hover:text-orange-500'"
              >
                {{ model }}
              </button>
            </div>
          </div>
        </div>

        <!-- Test result -->
        <div
          v-if="globalTestResult"
          class="mb-4 p-3 rounded-lg text-sm"
          :class="globalTestResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
        >
          {{ globalTestResult.message }}
        </div>

        <!-- Footer -->
        <div class="pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.allProvidersOpenAICompat') }}</p>
          <button
            @click="emit('testGlobalConnection')"
            :disabled="globalTesting || !globalConfig.api_key || !globalConfig.base_url || !globalConfig.model_name"
            class="shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            :class="{
              'from-green-500! to-green-600!': globalTestResult?.success,
              'from-red-500! to-red-600!': globalTestResult?.success === false
            }"
          >
            {{ globalTesting ? t('common.testing') : t('settings.testConnection') }}
          </button>
        </div>
      </div>
    </section>

    <!-- ==================== Service Overrides ==================== -->
    <section class="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] overflow-hidden min-w-0">
      <!-- Tab Navigation -->
      <div class="relative bg-[var(--bg-surface)] overflow-hidden">
        <div class="flex overflow-x-auto scrollbar-hide px-1 min-w-0">
          <button
            v-for="tab in serviceTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-all relative border-none bg-transparent cursor-pointer shrink-0"
            :class="[
              activeTab === tab.id
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
            ]"
          >
            <span :class="tab.icon" class="text-base"></span>
            <span>{{ t(tab.labelKey) }}</span>
            <span v-if="isServiceConfigured(tab.id)" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span v-if="activeTab === tab.id" class="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-500 rounded-full"></span>
          </button>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-px bg-[var(--border-color)]"></div>
        <div class="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-b from-black/5 to-transparent dark:from-black/20 pointer-events-none"></div>
      </div>

      <!-- Tab Content -->
      <div class="p-5 pt-6">
        <Transition name="fade" mode="out-in">
          <!-- MCP Tab -->
          <div v-if="activeTab === 'mcp'" key="mcp">
            <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.mcpSubtitle') }}</p>

            <div class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.mcpEndpoint') }}</label>
                  <div class="px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-secondary)] font-mono">
                    http://127.0.0.1:15432/mcp
                  </div>
                </div>
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.mcpStatus') }}</label>
                  <div class="flex items-center gap-2 px-3.5 py-2.5">
                    <span class="w-2 h-2 rounded-full" :class="mcpTestResult?.success ? 'bg-green-500' : 'bg-gray-400'"></span>
                    <span class="text-sm" :class="mcpTestResult?.success ? 'text-green-600 dark:text-green-400' : 'text-[var(--text-secondary)]'">
                      {{ mcpTestResult?.success ? t('settings.mcpConnected') : t('settings.mcpDisconnected') }}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.mcpTools') }}</label>
                <p class="m-0 text-sm text-[var(--text-secondary)]">{{ t('settings.mcpToolsList') }}</p>
              </div>
            </div>

            <div
              v-if="mcpTestResult"
              class="mt-4 p-3 rounded-lg text-sm"
              :class="mcpTestResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
            >
              {{ mcpTestResult.message }}
            </div>

            <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-end">
              <button
                @click="emit('testMcp')"
                :disabled="mcpTesting"
                class="shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                :class="{
                  'from-green-500! to-green-600!': mcpTestResult?.success,
                  'from-red-500! to-red-600!': mcpTestResult?.success === false
                }"
              >
                {{ mcpTesting ? t('common.testing') : t('settings.testMcp') }}
              </button>
            </div>
          </div>

          <!-- Embedding Tab (always independent — not a chat/LLM model) -->
          <div v-else-if="activeTab === 'embedding'" key="embedding">
            <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.embeddingSubtitle') }}</p>

            <div class="space-y-4 mb-5">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
                <div class="relative">
                  <input
                    v-model="embeddingConfig.api_key"
                    :type="showServiceApiKey.embedding ? 'text' : 'password'"
                    :placeholder="t('settings.apiKeyPlaceholder')"
                    class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                  <button
                    type="button"
                    @click="showServiceApiKey.embedding = !showServiceApiKey.embedding"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <span :class="showServiceApiKey.embedding ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                  </button>
                </div>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                  <input
                    v-model="embeddingConfig.base_url"
                    type="text"
                    :placeholder="t('settings.embeddingApiUrlPlaceholder')"
                    class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.embeddingModelName') }}</label>
                  <input
                    v-model="embeddingConfig.model_name"
                    type="text"
                    :placeholder="t('settings.embeddingModelPlaceholder')"
                    class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <!-- Rebuild result -->
            <div
              v-if="rebuildResult"
              class="mb-4 p-3 rounded-lg text-sm"
              :class="rebuildResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
            >
              {{ rebuildResult.message }}
            </div>

            <!-- Test result -->
            <div
              v-if="serviceTestResult.embedding"
              class="mb-4 p-3 rounded-lg text-sm"
              :class="serviceTestResult.embedding.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
            >
              {{ serviceTestResult.embedding.message }}
            </div>

            <!-- Footer actions -->
            <div class="pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.embeddingNote') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="emit('rebuildVectors')"
                  :disabled="rebuildingVectors || !embeddingConfig.api_key"
                  class="px-3 py-2 rounded-lg text-sm font-medium transition-all border border-dashed border-blue-400/50 bg-blue-500/5 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-500/10 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ rebuildingVectors ? t('settings.rebuildingVectors') : t('settings.rebuildVectors') }}
                </button>
                <button
                  @click="emit('testConnection', 'embedding')"
                  :disabled="serviceTesting.embedding || !embeddingConfig.api_key || !embeddingConfig.base_url || !embeddingConfig.model_name"
                  class="px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  :class="{
                    'from-green-500! to-green-600!': serviceTestResult.embedding?.success,
                    'from-red-500! to-red-600!': serviceTestResult.embedding?.success === false
                  }"
                >
                  {{ serviceTesting.embedding ? t('common.testing') : t('settings.testConnection') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Service Config Tabs (summary / translation / tagging) -->
          <div v-else :key="activeTab">
            <!-- Config source toggle -->
            <div class="mb-5">
              <div class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <button
                  type="button"
                  @click="currentServiceConfig && (currentServiceConfig.use_custom = false)"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all border-none cursor-pointer"
                  :class="currentServiceConfig && !currentServiceConfig.use_custom
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 shadow-sm'
                    : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'"
                >
                  <span class="i-carbon-link text-base"></span>
                  {{ t('settings.useGlobalConfig') }}
                </button>
                <button
                  type="button"
                  @click="currentServiceConfig && (currentServiceConfig.use_custom = true)"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all border-none cursor-pointer"
                  :class="currentServiceConfig && currentServiceConfig.use_custom
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 shadow-sm'
                    : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'"
                >
                  <span class="i-carbon-settings text-base"></span>
                  {{ t('settings.useCustomConfig') }}
                </button>
              </div>
            </div>

            <!-- Using Global hint -->
            <div v-if="currentServiceConfig && !currentServiceConfig.use_custom" class="mb-5">
              <div class="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/15">
                <span class="i-carbon-information text-blue-500 text-lg shrink-0 mt-0.5"></span>
                <div>
                  <p class="m-0 text-sm text-[var(--text-primary)] font-medium">{{ t('settings.usingGlobalConfig') }}</p>
                  <p class="m-0 mt-1 text-xs text-[var(--text-secondary)]">
                    {{ t('settings.usingGlobalConfigHint') }}
                    <template v-if="selectedPreset">
                      — {{ selectedPreset.name }} / {{ globalConfig.model_name }}
                    </template>
                  </p>
                </div>
              </div>
            </div>

            <!-- Custom config form (shown when use_custom is true) -->
            <div v-if="currentServiceConfig && currentServiceConfig.use_custom" class="space-y-4 mb-5">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
                <div class="relative">
                  <input
                    v-model="currentServiceConfig.api_key"
                    :type="showServiceApiKey[activeTab] ? 'text' : 'password'"
                    :placeholder="t('settings.apiKeyPlaceholder')"
                    class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                  <button
                    type="button"
                    @click="showServiceApiKey[activeTab] = !showServiceApiKey[activeTab]"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <span :class="showServiceApiKey[activeTab] ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                  </button>
                </div>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                  <input
                    v-model="currentServiceConfig.base_url"
                    type="text"
                    :placeholder="t('settings.apiUrlPlaceholder')"
                    class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
                <div>
                  <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
                  <input
                    v-model="currentServiceConfig.model_name"
                    type="text"
                    :placeholder="t('settings.modelPlaceholder')"
                    class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <!-- Test result -->
            <div
              v-if="serviceTestResult[activeTab as AIServiceKey]"
              class="mb-4 p-3 rounded-lg text-sm"
              :class="serviceTestResult[activeTab as AIServiceKey]?.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
            >
              {{ serviceTestResult[activeTab as AIServiceKey]?.message }}
            </div>

            <!-- Footer actions -->
            <div class="pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.openaiCompatible') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="emit('testConnection', activeTab as AIServiceKey)"
                  :disabled="serviceTesting[activeTab as AIServiceKey]"
                  class="px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  :class="{
                    'from-green-500! to-green-600!': serviceTestResult[activeTab as AIServiceKey]?.success,
                    'from-red-500! to-red-600!': serviceTestResult[activeTab as AIServiceKey]?.success === false
                  }"
                >
                  {{ serviceTesting[activeTab as AIServiceKey] ? t('common.testing') : t('settings.testConnection') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
