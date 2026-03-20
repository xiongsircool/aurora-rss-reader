<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RSSHubMirror, RSSHubTestResult } from '../../composables/useRSSHubSettings'

defineProps<{
  rsshubUrl: string
  isTestingRSSHub: boolean
  rsshubTestResult: RSSHubTestResult | null
  rsshubMirrors: RSSHubMirror[]
  rsshubMirrorsLoading: boolean
}>()

const emit = defineEmits<{
  'update:rsshubUrl': [value: string]
  testConnection: []
  selectMirror: [value: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600 hidden md:block">{{ t('settings.rssHubConfig') }}</h3>
    <div class="mb-4">
      <label class="block mb-2 text-3.5 text-[var(--text-primary)] font-500">RSSHub URL</label>
      <input
        :value="rsshubUrl"
        @input="emit('update:rsshubUrl', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="t('settings.rssHubPlaceholder')"
        class="w-full py-2.75 px-3.5 border border-[var(--border-color)] rounded-2.5 text-3.5 bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 shadow-none placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
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
      <div class="mb-2 flex items-center justify-between gap-3">
        <label class="text-3.5 text-[var(--text-primary)] font-500">{{ t('settings.rssHubMirrorPresets') }}</label>
        <span v-if="rsshubMirrorsLoading" class="text-3 text-[var(--text-secondary)]">
          {{ t('settings.rssHubMirrorLoading') }}
        </span>
      </div>
      <div class="grid gap-2">
        <button
          v-for="mirror in rsshubMirrors"
          :key="mirror.base_url"
          type="button"
          class="w-full text-left p-3 rounded-xl border transition-all duration-200 bg-[var(--bg-input)] hover:border-orange-500/40 hover:bg-[var(--bg-elevated)]"
          :class="rsshubUrl === mirror.base_url
            ? 'border-orange-500/60 shadow-[0_0_0_2px_rgba(255,122,24,0.08)]'
            : 'border-[var(--border-color)]'"
          @click="emit('selectMirror', mirror.base_url)"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-3.5 text-[var(--text-primary)] font-600">{{ mirror.name }}</span>
                <span
                  v-if="mirror.is_default"
                  class="px-1.5 py-0.5 rounded-full text-2.75 bg-[rgba(255,122,24,0.12)] text-orange-600"
                >
                  Default
                </span>
                <span
                  v-if="rsshubUrl === mirror.base_url"
                  class="px-1.5 py-0.5 rounded-full text-2.75 bg-[rgba(52,199,89,0.12)] text-[#0f7a39]"
                >
                  {{ t('settings.rssHubMirrorCurrent') }}
                </span>
              </div>
              <div class="mt-1 text-3 text-[var(--text-secondary)] break-all">{{ mirror.base_url }}</div>
              <div class="mt-1 text-3 text-[var(--text-secondary)]">{{ mirror.description }}</div>
            </div>
            <span class="text-3 text-[var(--accent)] shrink-0">{{ t('settings.rssHubMirrorUse') }}</span>
          </div>
        </button>
      </div>
    </div>

    <div class="mb-4">
      <button
        @click="emit('testConnection')"
        :disabled="isTestingRSSHub || !rsshubUrl"
        class="border-none py-2.5 px-4.5 rounded-2.5 text-3.5 font-600 cursor-pointer transition-all duration-200 text-white shadow-[0_10px_20px_rgba(255,122,24,0.25)] hover:not-disabled:translate-y--0.25 hover:not-disabled:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        :class="{
          'bg-gradient-to-br from-orange-500 to-orange-600': !rsshubTestResult,
          'opacity-70 transform-none': isTestingRSSHub,
          'bg-[#34c759] shadow-none': rsshubTestResult?.success,
          'bg-[#ff4d4f] shadow-none': rsshubTestResult?.success === false
        }"
      >
        {{ isTestingRSSHub ? t('settings.testingRssHub') : t('settings.testRssHub') }}
      </button>
      <div
        v-if="rsshubTestResult"
        class="mt-2 p-3 rounded-2.5 text-3.25 font-500 border border-transparent bg-[var(--bg-elevated)] shadow-[0_10px_20px_rgba(15,20,25,0.08)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
        :class="{
          'text-[#0f7a39] border-[rgba(52,199,89,0.35)]': rsshubTestResult.success,
          'text-[#c43838] border-[rgba(255,77,79,0.35)]': !rsshubTestResult.success
        }"
        v-html="rsshubTestResult.message"
      />
    </div>
  </section>
</template>
