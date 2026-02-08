<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LocalServiceConfig } from '../../composables/useSettingsModal'
import type { TestResult } from '../../composables/useAIConfigSettings'
import type { AIServiceKey } from '../../stores/aiStore'

const props = defineProps<{
  serviceTesting: Record<AIServiceKey, boolean>
  serviceTestResult: Record<AIServiceKey, TestResult | null>
  rebuildingVectors: boolean
  rebuildResult: TestResult | null
  mcpTesting: boolean
  mcpTestResult: TestResult | null
}>()

const emit = defineEmits<{
  testConnection: [service: AIServiceKey]
  copySummaryToTranslation: []
  rebuildVectors: []
  testMcp: []
}>()

const { t } = useI18n()

const summaryConfig = defineModel<LocalServiceConfig>('summaryConfig', { required: true })
const translationConfig = defineModel<LocalServiceConfig>('translationConfig', { required: true })
const taggingConfig = defineModel<LocalServiceConfig>('taggingConfig', { required: true })
const embeddingConfig = defineModel<LocalServiceConfig>('embeddingConfig', { required: true })

// Tab navigation
type ServiceTab = 'summary' | 'translation' | 'tagging' | 'embedding' | 'mcp'
const activeTab = ref<ServiceTab>('summary')

// API Key visibility state
const showApiKey = reactive<Record<ServiceTab, boolean>>({
  summary: false,
  translation: false,
  tagging: false,
  embedding: false,
  mcp: false
})

const tabs: { id: ServiceTab; icon: string; label: string }[] = [
  { id: 'summary', icon: 'i-carbon-document', label: '摘要' },
  { id: 'translation', icon: 'i-carbon-translate', label: '翻译' },
  { id: 'tagging', icon: 'i-carbon-tag-group', label: '标签' },
  { id: 'embedding', icon: 'i-carbon-data-vis-4', label: '知识库' },
  { id: 'mcp', icon: 'i-carbon-plug', label: 'MCP' },
]

function isConfigured(tab: ServiceTab): boolean {
  if (tab === 'mcp') return props.mcpTestResult?.success ?? false
  const config = {
    summary: summaryConfig.value,
    translation: translationConfig.value,
    tagging: taggingConfig.value,
    embedding: embeddingConfig.value,
  }[tab]
  return !!(config?.api_key && config?.base_url && config?.model_name)
}

function copySummaryToCurrent() {
  if (activeTab.value === 'translation') {
    emit('copySummaryToTranslation')
  } else if (activeTab.value === 'tagging') {
    taggingConfig.value = { ...summaryConfig.value }
  } else if (activeTab.value === 'embedding') {
    embeddingConfig.value = { ...summaryConfig.value }
  }
}

function toggleApiKeyVisibility(tab: ServiceTab) {
  showApiKey[tab] = !showApiKey[tab]
}
</script>

<template>
  <section class="mb-6 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0 overflow-hidden min-w-0">
    <!-- Tab Navigation -->
    <div class="relative bg-[var(--bg-surface)] overflow-hidden">
      <div class="flex overflow-x-auto scrollbar-hide px-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all relative border-none bg-transparent cursor-pointer"
          :class="[
            activeTab === tab.id
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          ]"
        >
          <span :class="tab.icon" class="text-base"></span>
          <span class="hidden sm:inline">{{ tab.label }}</span>
          <span v-if="isConfigured(tab.id)" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span v-if="activeTab === tab.id" class="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-full"></span>
        </button>
      </div>
      <!-- 底部分隔线和阴影 -->
      <div class="absolute bottom-0 left-0 right-0 h-px bg-[var(--border-color)]"></div>
      <div class="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-b from-black/5 to-transparent dark:from-black/20 pointer-events-none"></div>
    </div>

    <!-- Tab Content -->
    <div class="p-5 pt-6">
      <Transition name="fade" mode="out-in">
        <!-- Summary Tab -->
        <div v-if="activeTab === 'summary'" key="summary">
          <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.summarySubtitle') }}</p>

          <div class="space-y-4">
            <div>
              <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
              <div class="relative">
                <input
                  v-model="summaryConfig.api_key"
                  :type="showApiKey.summary ? 'text' : 'password'"
                  :placeholder="t('settings.apiKeyPlaceholder')"
                  class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <button
                  type="button"
                  @click="toggleApiKeyVisibility('summary')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span :class="showApiKey.summary ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                <input
                  v-model="summaryConfig.base_url"
                  type="text"
                  :placeholder="t('settings.apiUrlPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
                <input
                  v-model="summaryConfig.model_name"
                  type="text"
                  :placeholder="t('settings.modelPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <!-- 测试结果 -->
          <div
            v-if="serviceTestResult.summary"
            class="mt-4 p-3 rounded-lg text-sm"
            :class="serviceTestResult.summary.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
          >
            {{ serviceTestResult.summary.message }}
          </div>

          <!-- 底部操作栏 -->
          <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-4">
            <p class="m-0 text-xs text-[var(--text-tertiary)] shrink-0">{{ t('settings.openaiCompatible') }}</p>
            <button
              @click="emit('testConnection', 'summary')"
              :disabled="serviceTesting.summary || !summaryConfig.api_key || !summaryConfig.base_url || !summaryConfig.model_name"
              class="shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              :class="{
                'from-green-500! to-green-600!': serviceTestResult.summary?.success,
                'from-red-500! to-red-600!': serviceTestResult.summary?.success === false
              }"
            >
              {{ serviceTesting.summary ? t('common.testing') : t('settings.testConnection') }}
            </button>
          </div>
        </div>

        <!-- Translation Tab -->
        <div v-else-if="activeTab === 'translation'" key="translation">
          <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.translationSubtitle') }}</p>

          <div class="space-y-4">
            <div>
              <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
              <div class="relative">
                <input
                  v-model="translationConfig.api_key"
                  :type="showApiKey.translation ? 'text' : 'password'"
                  :placeholder="t('settings.translationApiKeyPlaceholder')"
                  class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <button
                  type="button"
                  @click="toggleApiKeyVisibility('translation')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span :class="showApiKey.translation ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                <input
                  v-model="translationConfig.base_url"
                  type="text"
                  :placeholder="t('settings.apiUrlPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
                <input
                  v-model="translationConfig.model_name"
                  type="text"
                  :placeholder="t('settings.translationModelPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div
            v-if="serviceTestResult.translation"
            class="mt-4 p-3 rounded-lg text-sm"
            :class="serviceTestResult.translation.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
          >
            {{ serviceTestResult.translation.message }}
          </div>

          <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.openaiCompatible') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                @click="copySummaryToCurrent"
                class="px-3 py-2 rounded-lg text-sm font-medium transition-all border border-dashed border-orange-400/50 bg-orange-500/5 text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-500/10 hover:border-orange-500"
              >
                {{ t('settings.useSummaryConfig') }}
              </button>
              <button
                @click="emit('testConnection', 'translation')"
                :disabled="serviceTesting.translation || !translationConfig.api_key || !translationConfig.base_url || !translationConfig.model_name"
                class="px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                :class="{
                  'from-green-500! to-green-600!': serviceTestResult.translation?.success,
                  'from-red-500! to-red-600!': serviceTestResult.translation?.success === false
                }"
              >
                {{ serviceTesting.translation ? t('common.testing') : t('settings.testConnection') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Tagging Tab -->
        <div v-else-if="activeTab === 'tagging'" key="tagging">
          <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.taggingSubtitle') }}</p>

          <div class="space-y-4">
            <div>
              <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
              <div class="relative">
                <input
                  v-model="taggingConfig.api_key"
                  :type="showApiKey.tagging ? 'text' : 'password'"
                  :placeholder="t('settings.apiKeyPlaceholder')"
                  class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <button
                  type="button"
                  @click="toggleApiKeyVisibility('tagging')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span :class="showApiKey.tagging ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                <input
                  v-model="taggingConfig.base_url"
                  type="text"
                  :placeholder="t('settings.apiUrlPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
                <input
                  v-model="taggingConfig.model_name"
                  type="text"
                  :placeholder="t('settings.modelPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div
            v-if="serviceTestResult.tagging"
            class="mt-4 p-3 rounded-lg text-sm"
            :class="serviceTestResult.tagging.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
          >
            {{ serviceTestResult.tagging.message }}
          </div>

          <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.openaiCompatible') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                @click="copySummaryToCurrent"
                class="px-3 py-2 rounded-lg text-sm font-medium transition-all border border-dashed border-orange-400/50 bg-orange-500/5 text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-500/10 hover:border-orange-500"
              >
                {{ t('settings.useSummaryConfig') }}
              </button>
              <button
                @click="emit('testConnection', 'tagging')"
                :disabled="serviceTesting.tagging || !taggingConfig.api_key || !taggingConfig.base_url || !taggingConfig.model_name"
                class="px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                :class="{
                  'from-green-500! to-green-600!': serviceTestResult.tagging?.success,
                  'from-red-500! to-red-600!': serviceTestResult.tagging?.success === false
                }"
              >
                {{ serviceTesting.tagging ? t('common.testing') : t('settings.testConnection') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Embedding Tab -->
        <div v-else-if="activeTab === 'embedding'" key="embedding">
          <p class="m-0 mb-5 text-sm text-[var(--text-secondary)]">{{ t('settings.embeddingSubtitle') }}</p>

          <div class="space-y-4">
            <div>
              <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiKey') }}</label>
              <div class="relative">
                <input
                  v-model="embeddingConfig.api_key"
                  :type="showApiKey.embedding ? 'text' : 'password'"
                  :placeholder="t('settings.apiKeyPlaceholder')"
                  class="w-full px-3.5 py-2.5 pr-10 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <button
                  type="button"
                  @click="toggleApiKeyVisibility('embedding')"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-transparent border-none cursor-pointer transition-colors"
                >
                  <span :class="showApiKey.embedding ? 'i-carbon-view-off' : 'i-carbon-view'" class="text-lg"></span>
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.apiUrl') }}</label>
                <input
                  v-model="embeddingConfig.base_url"
                  type="text"
                  :placeholder="t('settings.apiUrlPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <div>
                <label class="block mb-1.5 text-sm font-medium text-[var(--text-primary)]">{{ t('settings.modelName') }}</label>
                <input
                  v-model="embeddingConfig.model_name"
                  type="text"
                  :placeholder="t('settings.modelPlaceholder')"
                  class="w-full px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div
            v-if="serviceTestResult.embedding"
            class="mt-4 p-3 rounded-lg text-sm"
            :class="serviceTestResult.embedding.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
          >
            {{ serviceTestResult.embedding.message }}
          </div>
          <div
            v-if="rebuildResult"
            class="mt-2 p-3 rounded-lg text-sm"
            :class="rebuildResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
          >
            {{ rebuildResult.message }}
          </div>

          <div class="mt-6 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="m-0 text-xs text-[var(--text-tertiary)]">{{ t('settings.openaiCompatible') }}</p>
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

        <!-- MCP Tab -->
        <div v-else-if="activeTab === 'mcp'" key="mcp">
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
      </Transition>
    </div>
  </section>
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
</style>
