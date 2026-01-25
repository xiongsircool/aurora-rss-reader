<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLanguage } from '../../composables/useLanguage'
import type { LocaleCode } from '../../i18n'

const { t } = useI18n()
const { setLanguage, currentLanguage, availableLocales } = useLanguage()

const selectedLanguage = computed({
  get: () => currentLanguage.value?.code || 'zh',
  set: async (value: string) => {
    if (!value || !availableLocales.some(locale => locale.code === value)) {
      return
    }
    if (currentLanguage.value?.code !== value) {
      await setLanguage(value as LocaleCode)
    }
  }
})
</script>

<template>
  <section class="mb-6 p-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] last:mb-0">
    <h3 class="m-0 mb-4 text-4 text-[var(--text-primary)] font-600 hidden md:block">{{ t('settings.language') }}</h3>
    <div class="mb-4">
      <select
        v-model="selectedLanguage"
        class="w-full py-2.75 px-3.5 border border-[var(--border-color)] rounded-2.5 text-3.5 bg-[var(--bg-input)] text-[var(--text-primary)] transition-all duration-200 shadow-none focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_3px_rgba(255,122,24,0.15)]"
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
