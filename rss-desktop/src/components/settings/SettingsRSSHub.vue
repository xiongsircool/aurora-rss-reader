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
  <section class="mb-6 px-5 py-4.5 rounded-3.5 bg-[#f8faff] dark:bg-white/4 border border-[rgba(76,116,255,0.08)] dark:border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600">{{ t('settings.rssHubConfig') }}</h3>
    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">RSSHub URL</label>
      <input
        :value="rsshubUrl"
        @input="emit('update:rsshubUrl', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="t('settings.rssHubPlaceholder')"
        class="w-full py-2.75 px-3.5 border border-[rgba(92,106,138,0.22)] dark:border-white/12 rounded-2.5 text-3.5 bg-[#fefefe] dark:bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-200 shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] dark:shadow-none placeholder:text-[rgba(90,98,118,0.62)] dark:placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)]"
      />
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">
        {{ t('settings.rssHubDescription') }}
      </p>
      <p class="mt-1.5 text-3 text-[var(--text-secondary)]">
        {{ t('settings.rssHubDeployGuide') }}: 
        <a href="https://docs.rsshub.app/zh/deploy/" target="_blank" class="text-[var(--accent)] no-underline hover:underline">RSSHub部署指南</a>
      </p>
    </div>

    <div class="mb-4">
      <button
        @click="emit('testConnection')"
        :disabled="isTestingRSSHub || !rsshubUrl"
        class="border-none py-2.5 px-4.5 rounded-2.5 text-3.5 font-600 cursor-pointer transition-all duration-200 text-white shadow-[0_10px_20px_rgba(76,116,255,0.25)] hover:not-disabled:translate-y--0.25 hover:not-disabled:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        :class="{
          'bg-gradient-to-br from-[#4c74ff] to-[#2f54ff]': !rsshubTestResult,
          'opacity-70 transform-none': isTestingRSSHub,
          'bg-[#34c759] shadow-none': rsshubTestResult?.success,
          'bg-[#ff4d4f] shadow-none': rsshubTestResult?.success === false
        }"
      >
        {{ isTestingRSSHub ? t('settings.testingRssHub') : t('settings.testRssHub') }}
      </button>
      <div 
        v-if="rsshubTestResult" 
        class="mt-2 p-3 rounded-2.5 text-3.25 font-500 border border-transparent bg-white dark:bg-white/4 shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
        :class="{
          'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': rsshubTestResult.success,
          'text-[#c43838] border-[rgba(255,77,79,0.35)]': !rsshubTestResult.success
        }"
        v-html="rsshubTestResult.message"
      />
    </div>
  </section>
</template>
