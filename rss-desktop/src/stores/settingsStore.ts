import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
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
  // 时间线筛选区密度
  timeline_filter_density: 'compact' | 'standard'
  // 语言设置
  language: string // 'zh' | 'en' | 'ja' | 'ko'
  summary_prompt_preference: string
  translation_prompt_preference: string
  outbound_proxy_mode: 'system' | 'custom' | 'off'
  outbound_proxy_url: string
  scope_summary_enabled: boolean
  scope_summary_auto_generate: boolean
  scope_summary_auto_interval_minutes: number
  scope_summary_default_window: '24h' | '3d' | '7d' | '30d'
  scope_summary_max_entries: number
  scope_summary_chunk_size: number
  scope_summary_model_name: string
  scope_summary_use_custom: boolean
  scope_summary_base_url: string
  scope_summary_api_key: string
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
    timeline_filter_density: 'compact',
    language: 'zh',
    summary_prompt_preference: '',
    translation_prompt_preference: '',
    outbound_proxy_mode: 'system',
    outbound_proxy_url: '',
    scope_summary_enabled: true,
    scope_summary_auto_generate: true,
    scope_summary_auto_interval_minutes: 60,
    scope_summary_default_window: '24h',
    scope_summary_max_entries: 100,
    scope_summary_chunk_size: 10,
    scope_summary_model_name: '',
    scope_summary_use_custom: false,
    scope_summary_base_url: '',
    scope_summary_api_key: ''
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  function getApiErrorMessage(err: unknown, fallback: string) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as { error?: string; invalid_fields?: string[] } | undefined
      if (data?.error && Array.isArray(data.invalid_fields) && data.invalid_fields.length > 0) {
        return `${data.error}: ${data.invalid_fields.join(', ')}`
      }
      if (data?.error) return data.error
      if (err.message) return err.message
    }
    if (err instanceof Error && err.message) return err.message
    return fallback
  }

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
      error.value = getApiErrorMessage(err, '获取设置失败')
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
      error.value = getApiErrorMessage(err, '更新设置失败')
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
