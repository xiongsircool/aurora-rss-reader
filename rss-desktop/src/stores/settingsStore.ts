import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

export interface AppSettings {
  fetch_interval_minutes: number
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    fetch_interval_minutes: 15
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  // 获取应用设置
  async function fetchSettings() {
    loading.value = true
    error.value = null

    try {
      const { data } = await api.get<AppSettings>('/settings')
      settings.value = data
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
      const { data } = await api.patch('/settings', newSettings)

      // 更新本地状态
      settings.value = { ...settings.value, ...newSettings }

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