import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

// Service keys available for configuration
export type AIServiceKey = 'summary' | 'translation' | 'embedding'

export interface AIServiceConfig {
  api_key: string
  base_url: string
  model_name: string
  has_api_key?: boolean
}

export interface AIFeatureConfig {
  auto_summary: boolean
  auto_title_translation: boolean
  title_display_mode: 'replace' | 'translation-first' | 'original-first'
  translation_language: string
}

export interface AIConfig {
  summary: AIServiceConfig
  translation: AIServiceConfig
  embedding: AIServiceConfig
  features: AIFeatureConfig
}

export type PartialAIConfig = {
  summary?: Partial<AIServiceConfig>
  translation?: Partial<AIServiceConfig>
  embedding?: Partial<AIServiceConfig>
  features?: Partial<AIFeatureConfig>
}

const createDefaultServiceConfig = (): AIServiceConfig => ({
  api_key: '',
  base_url: '',
  model_name: '',
  has_api_key: false
})

const createDefaultConfig = (): AIConfig => ({
  summary: createDefaultServiceConfig(),
  translation: createDefaultServiceConfig(),
  embedding: createDefaultServiceConfig(),
  features: {
    auto_summary: false,
    auto_title_translation: false,
    title_display_mode: 'original-first',
    translation_language: 'zh'
  }
})

function mergeConfig(target: AIConfig, updates: PartialAIConfig): AIConfig {
  return {
    summary: updates.summary ? { ...target.summary, ...updates.summary } : target.summary,
    translation: updates.translation ? { ...target.translation, ...updates.translation } : target.translation,
    embedding: updates.embedding ? { ...target.embedding, ...updates.embedding } : target.embedding,
    features: updates.features ? { ...target.features, ...updates.features } : target.features
  }
}

export const useAIStore = defineStore('ai', () => {
  const config = ref<AIConfig>(createDefaultConfig())

  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchConfig() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<AIConfig>('/ai/config')
      config.value = mergeConfig(config.value, data)
    } catch (err) {
      console.error('Failed to fetch AI config:', err)
      error.value = '获取AI配置失败'
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(updates: PartialAIConfig) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.patch<{ success: boolean; message: string }>('/ai/config', updates)
      if (data.success) {
        config.value = mergeConfig(config.value, updates)
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

  async function testConnection(service: AIServiceKey, overrides?: Partial<AIServiceConfig>) {
    const source = {
      ...config.value[service],
      ...overrides
    }

    if (!source.api_key || !source.base_url || !source.model_name) {
      error.value = '请先完善API配置'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<{ success: boolean; message: string }>('/ai/test', {
        service,
        api_key: source.api_key,
        base_url: source.base_url,
        model_name: source.model_name
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
    config.value = createDefaultConfig()
  }

  async function rebuildVectors() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<{
        success: boolean
        message: string
        total: number
        processed: number
        failed: number
      }>('/ai/vector/rebuild')

      if (data.success) {
        return {
          success: true,
          message: data.message,
          stats: {
            total: data.total,
            processed: data.processed,
            failed: data.failed
          }
        }
      } else {
        error.value = data.message || '重建向量库失败'
        return { success: false, message: error.value }
      }
    } catch (err) {
      console.error('Failed to rebuild vectors:', err)
      error.value = '重建向量库失败'
      return { success: false, message: error.value }
    } finally {
      loading.value = false
    }
  }

  async function getVectorStats() {
    try {
      const { data } = await api.get<{
        total_entries: number
        vectorized_entries: number
        pending_entries: number
      }>('/ai/vector/stats')
      return data
    } catch (err) {
      console.error('Failed to get vector stats:', err)
      return {
        total_entries: 0,
        vectorized_entries: 0,
        pending_entries: 0
      }
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
    resetConfig,
    rebuildVectors,
    getVectorStats
  }
})
