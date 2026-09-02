<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProxyStatusResult } from '../../composables/useProxySettings'

const props = defineProps<{
  proxyMode: 'system' | 'custom' | 'off'
  proxyUrl: string
  proxyStatus: ProxyStatusResult | null
  proxyStatusLoading: boolean
  proxyError: string
}>()

const emit = defineEmits<{
  'update:proxyMode': [value: 'system' | 'custom' | 'off']
  'update:proxyUrl': [value: string]
  refreshStatus: []
}>()

const { t } = useI18n()

const hasPendingChanges = computed(() => {
  if (!props.proxyStatus) return false

  const normalizedConfiguredUrl = props.proxyStatus.configured_url || ''
  const normalizedInputUrl = props.proxyMode === 'custom' ? props.proxyUrl.trim() : ''

  return props.proxyMode !== props.proxyStatus.mode || normalizedInputUrl !== normalizedConfiguredUrl
})

const statusLabel = computed(() => {
  switch (props.proxyStatus?.source) {
    case 'custom':
      return t('settings.proxyStatusCustom')
    case 'environment':
      return t('settings.proxyStatusEnvironment')
    case 'system':
      return t('settings.proxyStatusSystem')
    case 'disabled':
      return t('settings.proxyStatusDisabled')
    case 'custom-invalid':
      return t('settings.proxyStatusInvalid')
    default:
      return t('settings.proxyStatusDirect')
  }
})

const statusTone = computed(() => {
  if (!props.proxyStatus) return 'text-[var(--text-secondary)]'
  if (props.proxyStatus.source === 'custom-invalid') return 'text-[#c43838]'
  if (props.proxyStatus.active) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-[var(--text-secondary)]'
})
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600 hidden md:block">{{ t('settings.proxyConfig') }}</h3>

    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">{{ t('settings.proxyMode') }}</label>
      <select
        :value="proxyMode"
        @change="emit('update:proxyMode', ($event.target as HTMLSelectElement).value as 'system' | 'custom' | 'off')"
        class="w-full py-2.75 px-3.5 border border-[var(--border-color)] rounded-2.5 text-3.5 bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      >
        <option value="system">{{ t('settings.proxyModeSystem') }}</option>
        <option value="custom">{{ t('settings.proxyModeCustom') }}</option>
        <option value="off">{{ t('settings.proxyModeOff') }}</option>
      </select>
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">{{ t('settings.proxyModeDescription') }}</p>
    </div>

    <div v-if="proxyMode === 'custom'" class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">{{ t('settings.proxyUrl') }}</label>
      <input
        :value="proxyUrl"
        @input="emit('update:proxyUrl', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="t('settings.proxyUrlPlaceholder')"
        class="w-full py-2.75 px-3.5 border border-[var(--border-color)] rounded-2.5 text-3.5 bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
      />
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">{{ t('settings.proxyUrlDescription') }}</p>
    </div>

    <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-base)] p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-3 text-[var(--text-secondary)]">{{ t('settings.proxyCurrentStatus') }}</div>
          <div class="mt-1 text-3.5 font-600" :class="statusTone">{{ statusLabel }}</div>
        </div>
        <button
          type="button"
          class="py-2 px-3 rounded-lg text-3 bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-orange-500 transition-all duration-200"
          @click="emit('refreshStatus')"
          :disabled="proxyStatusLoading"
        >
          {{ proxyStatusLoading ? t('settings.testingRssHub') : t('settings.refreshProxyStatus') }}
        </button>
      </div>

      <div class="mt-3 space-y-2 text-3 text-[var(--text-secondary)]">
        <div>{{ t('settings.proxyEffective') }}: {{ proxyStatus?.effective_url || t('settings.proxyDirectConnection') }}</div>
        <div v-if="proxyStatus?.env_proxy_url">{{ t('settings.proxyEnvDetected') }}: {{ proxyStatus.env_proxy_url }}</div>
        <div v-if="proxyStatus?.system_proxy_url">{{ t('settings.proxySystemDetected') }}: {{ proxyStatus.system_proxy_url }}</div>
      </div>
    </div>

    <p v-if="hasPendingChanges" class="mt-3 text-3 text-amber-600 dark:text-amber-400">
      {{ t('settings.proxyPendingChanges') }}
    </p>

    <p v-if="proxyError" class="mt-3 text-3 text-[#c43838]">{{ proxyError }}</p>
  </section>
</template>
