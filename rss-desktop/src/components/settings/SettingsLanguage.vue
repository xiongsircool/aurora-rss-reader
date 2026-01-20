<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../../composables/useLanguage'
import type { LocaleCode } from '../../i18n'

const { t } = useI18n()
const { setLanguage, currentLanguage, availableLocales } = useLanguage()

const selectedLanguage = computed({
  get: () => currentLanguage.value?.code || 'zh',
  set: (value: string) => {
    if (!value || !availableLocales.some(locale => locale.code === value)) {
      return
    }
    if (currentLanguage.value?.code !== value) {
      setLanguage(value as LocaleCode)
    }
  }
})
</script>

<template>
  <section class="mb-6 px-5 py-4.5 rounded-3.5 bg-[#f8faff] dark:bg-white/4 border border-[rgba(76,116,255,0.08)] dark:border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600">{{ t('settings.language') }}</h3>
    <div class="mb-4">
      <select 
        v-model="selectedLanguage" 
        class="w-full py-2.75 px-3.5 border border-[rgba(92,106,138,0.22)] dark:border-white/12 rounded-2.5 text-3.5 bg-[#fefefe] dark:bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-200 shadow-[inset_0_1px_2px_rgba(15,20,25,0.04)] dark:shadow-none focus:outline-none focus:border-[#4c74ff] focus:shadow-[0_0_0_3px_rgba(76,116,255,0.15)]"
      >
        <option
          v-for="locale in availableLocales"
          :key="locale.code"
          :value="locale.code"
        >
          {{ locale.flag }} {{ locale.name }}
        </option>
      </select>
    </div>
  </section>
</template>
