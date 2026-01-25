import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'
import { clampAutoTitleTranslationLimit, getDefaultAutoTitleTranslationLimit } from '../constants/translation'

export interface AppSettings {
  fetch_interval_minutes: number
  auto_refresh: boolean
  items_per_page: number
  // 时间过滤相关设置
  enable_date_filter: boolean
  default_date_range: string
  time_field: string
  show_entry_summary: boolean
  open_original_mode: 'system' | 'window'
  max_auto_title_translations: number
  // 一键已读相关设置
  mark_as_read_range: string // 'current' | '3d' | '7d' | '30d' | 'all'
  // 详情栏显示模式
  details_panel_mode: 'docked' | 'click'
  // 语言设置
  language: string // 'zh' | 'en' | 'ja' | 'ko'
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    fetch_interval_minutes: 720,
    auto_refresh: true,
    items_per_page: 50,
    enable_date_filter: true,
    default_date_range: '30d',
    time_field: 'published_at',
    show_entry_summary: true,
    open_original_mode: 'system',
    max_auto_title_translations: getDefaultAutoTitleTranslationLimit(),
    mark_as_read_range: 'current',
    details_panel_mode: 'docked',
    language: 'zh'
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

    try {
      const { data } = await api.patch<Partial<AppSettings>>('/settings', newSettings)

      // 使用后端返回的数据更新本地状态，确保数据一致性
      const merged = {
        ...settings.value,
        ...data
      }
      merged.max_auto_title_translations = clampAutoTitleTranslationLimit(
        merged.max_auto_title_translations
      )
      settings.value = merged

      return data
    } catch (err) {
      console.error('Failed to update settings:', err)
      error.value = '更新设置失败'
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
