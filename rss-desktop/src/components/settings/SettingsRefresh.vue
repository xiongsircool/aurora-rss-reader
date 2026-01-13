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
  <section class="settings-section">
    <h3>{{ t('settings.subscriptionUpdate') }}</h3>
    
    <div class="form-group">
      <label>{{ t('settings.refreshInterval') }}</label>
      <input
        :value="fetchIntervalInput"
        @input="handleInput"
        @change="emit('change')"
        type="number"
        min="5"
        max="1440"
        class="form-input"
      />
      <p class="form-hint">{{ t('settings.refreshIntervalDescription') }}</p>
      <p v-if="fetchIntervalError" class="form-error">{{ fetchIntervalError }}</p>
    </div>
  </section>
</template>
