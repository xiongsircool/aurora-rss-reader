import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, type LocaleCode } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import api from '../api/client'

export function useLanguage() {
  const { locale, t } = useI18n()
  const settingsStore = useSettingsStore()

  // 当前语言
  const currentLanguage = computed(() => {
    return availableLocales.find(lang => lang.code === locale.value) || availableLocales[0]
  })

  // 切换语言
  const setLanguage = async (langCode: LocaleCode) => {
    locale.value = langCode

    // 保存到后端数据库
    try {
      await api.post('/settings/language', { language: langCode })
      // 同时更新 settingsStore
      await settingsStore.updateSettings({ language: langCode })
      // 同步到 localStorage 作为离线备份
      localStorage.setItem('rss-reader-language', langCode)
    } catch (error) {
      console.error('Failed to save language preference:', error)
      // 如果保存失败，仍然保留到 localStorage 作为备份
      localStorage.setItem('rss-reader-language', langCode)
    }
  }

  // 从后端加载语言设置
  const loadLanguage = async () => {
    try {
      // 优先从后端数据库加载
      const { data } = await api.get('/settings/language')
      const savedLanguage = data.language as LocaleCode

      if (savedLanguage && availableLocales.some(lang => lang.code === savedLanguage)) {
        locale.value = savedLanguage
        localStorage.setItem('rss-reader-language', savedLanguage)
        return
      }
    } catch (error) {
      console.error('Failed to load language from backend:', error)
      // 如果后端加载失败，尝试从 localStorage 加载作为备份
      const localLanguage = localStorage.getItem('rss-reader-language') as LocaleCode
      if (localLanguage && availableLocales.some(lang => lang.code === localLanguage)) {
        locale.value = localLanguage
        return
      }
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
