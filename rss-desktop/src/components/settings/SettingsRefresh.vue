<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  fetchIntervalInput: number | null
  fetchIntervalError: string
}>()

const emit = defineEmits<{
  'update:fetchIntervalInput': [value: number | null]
  change: []
}>()

const { t } = useI18n()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value === '' ? null : Number(target.value)
  emit('update:fetchIntervalInput', value)
}
</script>

<template>
  <section class="mb-6 px-5 py-4.5 rounded-3.5 bg-[#f8faff] dark:bg-white/4 border border-[rgba(76,116,255,0.08)] dark:border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600">{{ t('settings.subscriptionUpdate') }}</h3>
    
    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">{{ t('settings.refreshInterval') }}</label>
      <input
        :value="fetchIntervalInput"
        @input="handleInput"
        @change="emit('change')"
        type="number"
        min="5"
        max="1440"
        class="w-full py-2.75 px-3.5 border border-[rgba(92,106,138,0.22)] dark:border-white/12 rounded-2.5 text-3.5 bg-[#fefefe] dark:bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-200 shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] dark:shadow-none placeholder:text-[rgba(90,98,118,0.62)] dark:placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)]"
      />
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">{{ t('settings.refreshIntervalDescription') }}</p>
      <p v-if="fetchIntervalError" class="mt-1.5 text-3 text-[#c43838]">{{ fetchIntervalError }}</p>
    </div>
  </section>
</template>
