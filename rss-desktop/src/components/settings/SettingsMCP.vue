<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getApiBaseUrl } from '../../api/base'

interface McpStatusPayload {
  connected: boolean
  message: string
  transport: string
  endpoint_path: string
  endpoint_url: string
  recommended_tools: string[]
  legacy_aliases: string[]
  recommended_tool_count: number
  legacy_alias_count: number
}

interface TestResult {
  success: boolean
  message: string
}

const { t } = useI18n()

const loading = ref(false)
const status = ref<McpStatusPayload | null>(null)
const testResult = ref<TestResult | null>(null)

const isConnected = computed(() => status.value?.connected === true)
const endpointUrl = computed(() => status.value?.endpoint_url || '')

async function loadStatus(options: { markAsTest?: boolean } = {}) {
  loading.value = true
  if (options.markAsTest) {
    testResult.value = null
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/settings/mcp-status`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json() as McpStatusPayload
    status.value = payload

    if (options.markAsTest) {
      testResult.value = {
        success: payload.connected,
        message: payload.connected ? t('settings.mcpConnectionOk') : payload.message || t('settings.mcpConnectionFailed'),
      }
    }
  } catch (error) {
    if (options.markAsTest) {
      testResult.value = {
        success: false,
        message: error instanceof Error ? error.message : t('settings.mcpConnectionFailed'),
      }
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadStatus()
})
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 class="m-0 text-base font-semibold text-[var(--text-primary)]">{{ t('settings.mcpService') }}</h3>
        <p class="m-[6px_0_0] text-xs leading-5 text-[var(--text-secondary)]">{{ t('settings.mcpSubtitle') }}</p>
      </div>
      <span
        class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
        :class="isConnected
          ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="isConnected ? 'bg-green-500' : 'bg-gray-400'"></span>
        {{ isConnected ? t('settings.mcpConnected') : t('settings.mcpDisconnected') }}
      </span>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div class="text-xs font-medium text-[var(--text-secondary)] mb-2">{{ t('settings.mcpEndpoint') }}</div>
        <div class="text-sm font-mono break-all text-[var(--text-primary)]">{{ endpointUrl || '...' }}</div>
      </div>
      <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div class="text-xs font-medium text-[var(--text-secondary)] mb-2">{{ t('settings.mcpTransport') }}</div>
        <div class="text-sm text-[var(--text-primary)]">{{ status?.transport || 'streamable-http' }}</div>
      </div>
      <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div class="text-xs font-medium text-[var(--text-secondary)] mb-2">{{ t('settings.mcpTools') }}</div>
        <div class="text-sm text-[var(--text-primary)]">
          {{ status?.recommended_tool_count ?? 0 }} {{ t('settings.mcpToolCountSuffix') }}
        </div>
      </div>
    </div>

    <div class="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <div class="text-sm font-medium text-[var(--text-primary)] mb-3">{{ t('settings.mcpRecommendedTools') }}</div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="tool in status?.recommended_tools || []"
          :key="tool"
          class="px-2.5 py-1 rounded-lg text-xs border border-orange-500/20 bg-orange-500/8 text-orange-600 dark:text-orange-400"
        >
          {{ tool }}
        </span>
      </div>
    </div>

    <div class="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <div class="text-sm font-medium text-[var(--text-primary)] mb-2">{{ t('settings.mcpLegacyAliases') }}</div>
      <p class="m-0 text-xs leading-5 text-[var(--text-secondary)]">{{ t('settings.mcpLegacyAliasesHint') }}</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <span
          v-for="tool in status?.legacy_aliases || []"
          :key="tool"
          class="px-2.5 py-1 rounded-lg text-xs border border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--text-secondary)]"
        >
          {{ tool }}
        </span>
      </div>
    </div>

    <div
      v-if="testResult"
      class="mt-4 p-3 rounded-lg text-sm"
      :class="testResult.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'"
    >
      {{ testResult.message }}
    </div>

    <div class="mt-5 pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p class="m-0 text-xs leading-5 text-[var(--text-secondary)]">{{ t('settings.mcpStandaloneHint') }}</p>
      <button
        type="button"
        @click="loadStatus({ markAsTest: true })"
        :disabled="loading"
        class="w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-medium transition-all border-none cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:not-disabled:shadow-lg hover:not-disabled:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none whitespace-normal break-words text-center"
      >
        {{ loading ? t('common.testing') : t('settings.testMcp') }}
      </button>
    </div>
  </section>
</template>
