import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, type LocaleCode } from '../i18n'

export function useLanguage() {
  const { locale, t } = useI18n()

  // 当前语言
  const currentLanguage = computed(() => {
    return availableLocales.find(lang => lang.code === locale.value) || availableLocales[0]
  })

  // 切换语言
  const setLanguage = (langCode: LocaleCode) => {
    locale.value = langCode
    // 保存到本地存储
    localStorage.setItem('rss-reader-language', langCode)
  }

  // 从本地存储加载语言设置
  const loadLanguage = () => {
    const savedLanguage = localStorage.getItem('rss-reader-language') as LocaleCode

    if (savedLanguage && availableLocales.some(lang => lang.code === savedLanguage)) {
      locale.value = savedLanguage
    } else {
      // 如果没有有效的保存设置，使用默认语言
      locale.value = 'zh'
    }
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