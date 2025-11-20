import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'
import { clampAutoTitleTranslationLimit, getDefaultAutoTitleTranslationLimit } from '../constants/translation'

export interface AppSettings {
  fetch_interval_minutes: number
  items_per_page: number
  // 时间过滤相关设置
  enable_date_filter: boolean
  default_date_range: string
  time_field: string
  show_entry_summary: boolean
  max_auto_title_translations: number
  // 翻译显示模式
  translation_display_mode: string
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    fetch_interval_minutes: 15,
    items_per_page: 50,
    enable_date_filter: true,
    default_date_range: '30d',
    time_field: 'inserted_at',
    show_entry_summary: true,
    max_auto_title_translations: getDefaultAutoTitleTranslationLimit(),
    translation_display_mode: localStorage.getItem('translation_display_mode') || 'replace'
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取应用设置
  async function fetchSettings() {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.get<Partial<AppSettings>>('/settings')
      const merged = {
        ...settings.value,
        ...data
      }

      // 优先使用本地存储的翻译显示模式（如果后端未持久化该字段）
      const localMode = localStorage.getItem('translation_display_mode')
      if (localMode) {
        merged.translation_display_mode = localMode
      }

      merged.max_auto_title_translations = clampAutoTitleTranslationLimit(
        merged.max_auto_title_translations
      )
      settings.value = merged
      return data
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      error.value = '获取设置失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新应用设置
  async function updateSettings(newSettings: Partial<AppSettings>) {
    loading.value = true
    error.value = null

    // 如果更新了翻译显示模式，保存到本地存储
    if (newSettings.translation_display_mode) {
      localStorage.setItem('translation_display_mode', newSettings.translation_display_mode)
    }

    // 乐观更新：先更新本地状态
    const previousSettings = { ...settings.value }
    settings.value = {
      ...settings.value,
      ...newSettings
    }

    try {
      const { data } = await api.patch<Partial<AppSettings>>('/settings', newSettings)

      // 使用后端返回的数据确认更新
      const merged = {
        ...settings.value,
        ...data
      }

      // 再次确认本地存储的值（防止后端返回旧值覆盖）
      if (newSettings.translation_display_mode) {
        merged.translation_display_mode = newSettings.translation_display_mode
      } else {
        const localMode = localStorage.getItem('translation_display_mode')
        if (localMode) {
          merged.translation_display_mode = localMode
        }
      }

      merged.max_auto_title_translations = clampAutoTitleTranslationLimit(
        merged.max_auto_title_translations
      )
      settings.value = merged

      return data
    } catch (err) {
      console.error('Failed to update settings:', err)
      error.value = '更新设置失败'
      // 回滚状态
      settings.value = previousSettings
      throw err
    } finally {
      loading.value = false
    }
  }

  // 清除错误
  function clearError() {
    error.value = null
  }

  return {
    // 状态
    settings,
    loading,
    error,

    // 方法
    fetchSettings,
    updateSettings,
    clearError
  }
})
