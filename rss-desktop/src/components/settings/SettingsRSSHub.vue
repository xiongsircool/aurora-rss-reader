<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RSSHubTestResult } from '../../composables/useRSSHubSettings'

defineProps<{
  rsshubUrl: string
  isTestingRSSHub: boolean
  rsshubTestResult: RSSHubTestResult | null
}>()

const emit = defineEmits<{
  'update:rsshubUrl': [value: string]
  testConnection: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="settings-section">
    <h3>{{ t('settings.rssHubConfig') }}</h3>
    <div class="form-group">
      <label>RSSHub URL</label>
      <input
        :value="rsshubUrl"
        @input="emit('update:rsshubUrl', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="t('settings.rssHubPlaceholder')"
        class="form-input"
      />
      <p class="form-hint">
        {{ t('settings.rssHubDescription') }}
      </p>
      <p class="form-hint">
        {{ t('settings.rssHubDeployGuide') }}: 
        <a href="https://docs.rsshub.app/zh/deploy/" target="_blank">RSSHub部署指南</a>
      </p>
    </div>

    <div class="form-group">
      <button
        @click="emit('testConnection')"
        :disabled="isTestingRSSHub || !rsshubUrl"
        class="test-btn"
        :class="{
          loading: isTestingRSSHub,
          success: rsshubTestResult?.success,
          error: rsshubTestResult?.success === false
        }"
      >
        {{ isTestingRSSHub ? t('settings.testingRssHub') : t('settings.testRssHub') }}
      </button>
      <div 
        v-if="rsshubTestResult" 
        class="test-result" 
        :class="{
          success: rsshubTestResult.success,
          error: !rsshubTestResult.success
        }"
        v-html="rsshubTestResult.message"
      />
    </div>
  </section>
</template>
