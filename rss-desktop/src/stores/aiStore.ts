import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

export interface AIConfig {
  api_key: string
  base_url: string
  model_name: string
  auto_summary: boolean
  auto_translation: boolean
  auto_title_translation: boolean
  translation_language: string
  has_api_key?: boolean
}

export const useAIStore = defineStore('ai', () => {
  const config = ref<AIConfig>({
    api_key: '',
    base_url: '',
    model_name: '',
    auto_summary: false,
    auto_translation: false,
    auto_title_translation: false,
    translation_language: 'zh'
  })

  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchConfig() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<AIConfig>('/ai/config')
      config.value = { ...config.value, ...data }
    } catch (err) {
      console.error('Failed to fetch AI config:', err)
      error.value = '获取AI配置失败'
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(updates: Partial<AIConfig>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.patch<{ success: boolean; message: string }>('/ai/config', updates)
      if (data.success) {
        // 更新本地配置
        config.value = { ...config.value, ...updates }
        return true
      } else {
        error.value = data.message || '更新AI配置失败'
        return false
      }
    } catch (err) {
      console.error('Failed to update AI config:', err)
      error.value = '更新AI配置失败'
      return false
    } finally {
      loading.value = false
    }
  }

  async function testConnection() {
    if (!config.value.api_key || !config.value.base_url || !config.value.model_name) {
      error.value = '请先完善API配置'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<{ success: boolean; message: string }>('/ai/test', {
        api_key: config.value.api_key,
        base_url: config.value.base_url,
        model_name: config.value.model_name
      })
      if (data.success) {
        return true
      } else {
        error.value = data.message
        return false
      }
    } catch (err) {
      console.error('Failed to test AI connection:', err)
      error.value = '连接测试失败'
      return false
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  function resetConfig() {
    config.value = {
      api_key: '',
      base_url: '',
      model_name: '',
      auto_summary: false,
      auto_translation: false,
      auto_title_translation: false,
      translation_language: 'zh'
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    testConnection,
    clearError,
    resetConfig
  }
})
