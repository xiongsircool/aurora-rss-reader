import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, type LocaleCode } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'

export function useLanguage() {
  const { locale, t } = useI18n()
  const settingsStore = useSettingsStore()

  const isValidLocale = (lang?: string | null): lang is LocaleCode =>
    !!lang && availableLocales.some(localeOption => localeOption.code === lang)

  // 当前语言
  const currentLanguage = computed(() => {
    return availableLocales.find(lang => lang.code === locale.value) || availableLocales[0]
  })

  // 切换语言
  const setLanguage = async (langCode: LocaleCode) => {
    locale.value = langCode
    settingsStore.settings.language = langCode
    localStorage.setItem('rss-reader-language', langCode)

    // 保存到后端数据库
    try {
      await settingsStore.updateSettings({ language: langCode })
    } catch (error) {
      console.error('Failed to save language preference:', error)
    }
  }

  // 从后端加载语言设置
  const loadLanguage = async () => {
    const localLanguage = localStorage.getItem('rss-reader-language')
    const settingsLanguage = settingsStore.settings.language

    if (settingsStore.error && isValidLocale(localLanguage)) {
      locale.value = localLanguage
      settingsStore.settings.language = localLanguage
      return
    }

    if (isValidLocale(settingsLanguage)) {
      locale.value = settingsLanguage
      localStorage.setItem('rss-reader-language', settingsLanguage)
      return
    }

    if (isValidLocale(localLanguage)) {
      locale.value = localLanguage
      settingsStore.settings.language = localLanguage
      return
    }

    // 如果都失败，使用默认语言
    locale.value = 'zh'
  }

  // 获取语言显示名称
  const getLanguageDisplayName = (langCode: LocaleCode) => {
    const lang = availableLocales.find(l => l.code === langCode)
    return lang ? lang.name : langCode
  }

  // 获取语言旗帜表情
  const getLanguageFlag = (langCode: LocaleCode) => {
    const lang = availableLocales.find(l => l.code === langCode)
    return lang ? lang.flag : '🌐'
  }

  return {
    currentLanguage,
    setLanguage,
    loadLanguage,
    getLanguageDisplayName,
    getLanguageFlag,
    availableLocales,
    t
  }
}
