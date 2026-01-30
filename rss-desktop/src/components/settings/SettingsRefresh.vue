<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  fetchIntervalInput: number | null
  fetchIntervalError: string
  autoRefresh: boolean
}>()

const emit = defineEmits<{
  'update:fetchIntervalInput': [value: number | null]
  'update:autoRefresh': [value: boolean]
  change: []
  'auto-refresh-change': []
}>()

const { t } = useI18n()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value === '' ? null : Number(target.value)
  emit('update:fetchIntervalInput', value)
}

function handleAutoRefreshChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:autoRefresh', target.checked)
  emit('auto-refresh-change')
}
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600 hidden md:block">{{ t('settings.subscriptionUpdate') }}</h3>

    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500 flex items-center gap-2 cursor-pointer">
        <input
          :checked="autoRefresh"
          @change="handleAutoRefreshChange"
          type="checkbox"
          class="mr-2 accent-orange-500"
        />
        {{ t('settings.autoRefresh') }}
      </label>
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">{{ t('settings.autoRefreshDescription') }}</p>
    </div>

    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">{{ t('settings.refreshInterval') }}</label>
      <input
        :value="fetchIntervalInput"
        @input="handleInput"
        @change="emit('change')"
        type="number"
        min="5"
        max="1440"
        :disabled="!autoRefresh"
        class="w-full py-2.75 px-3.5 border border-[var(--border-color)] rounded-2.5 text-3.5 bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)] disabled:op-60 disabled:cursor-not-allowed"
      />
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">{{ t('settings.refreshIntervalDescription') }}</p>
      <p v-if="fetchIntervalError && autoRefresh" class="mt-1.5 text-3 text-[#c43838]">{{ fetchIntervalError }}</p>
    </div>
  </section>
</template>
