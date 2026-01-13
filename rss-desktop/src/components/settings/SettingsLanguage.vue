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
  <section class="settings-section">
    <h3>{{ t('settings.language') }}</h3>
    <div class="form-group">
      <select v-model="selectedLanguage" class="form-select">
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
