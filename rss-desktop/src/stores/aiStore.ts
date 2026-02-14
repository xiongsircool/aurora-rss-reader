import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

// Service keys available for configuration
export type AIServiceKey = 'summary' | 'translation' | 'tagging' | 'embedding'

// Provider presets for quick configuration
export interface ProviderPreset {
  id: string
  name: string
  icon: string
  baseUrl: string
  defaultModel: string
  models: string[]
  description: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'i-simple-icons-openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o3-mini'],
    description: 'ChatGPT 系列模型',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'i-carbon-machine-learning-model',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: '高性价比推理模型',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'i-carbon-logo-google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    description: 'Google AI, aistudio.google.com 获取 Key',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: 'i-carbon-bot',
    baseUrl: 'https://api.anthropic.com/v1/',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    description: 'Claude 系列模型',
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    icon: 'i-carbon-ai-status',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4', 'glm-4-air', 'glm-3-turbo'],
    description: '智谱清言，glm-4-flash 免费',
  },
  {
    id: 'qwen',
    name: '通义千问',
    icon: 'i-carbon-cloud',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    description: '阿里云大模型',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    icon: 'i-carbon-flow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'THUDM/glm-4-9b-chat'],
    description: '国内聚合平台，支持多种开源模型',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: 'i-carbon-network-4',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    models: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini'],
    description: '海外聚合平台，统一接口访问多家模型',
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    icon: 'i-carbon-laptop',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'llama3.1:8b', 'gemma2:9b', 'mistral:7b'],
    description: '本地部署，无需 API Key',
  },
  {
    id: 'custom',
    name: '自定义',
    icon: 'i-carbon-settings-adjust',
    baseUrl: '',
    defaultModel: '',
    models: [],
    description: '任何 OpenAI 兼容接口',
  },
]

export interface AIGlobalConfig {
  provider: string
  api_key: string
  base_url: string
  model_name: string
  has_api_key?: boolean
}

export interface AIServiceConfig {
  use_custom: boolean
  api_key: string
  base_url: string
  model_name: string
}

export interface AIFeatureConfig {
  auto_summary: boolean
  auto_title_translation: boolean
  auto_tagging: boolean
  title_display_mode: 'replace' | 'translation-first' | 'original-first'
  translation_language: string
}

export interface AIConfig {
  global: AIGlobalConfig
  summary: AIServiceConfig
  translation: AIServiceConfig
  tagging: AIServiceConfig
  embedding: AIServiceConfig
  features: AIFeatureConfig
}

export type PartialAIConfig = {
  global?: Partial<AIGlobalConfig>
  summary?: Partial<AIServiceConfig>
  translation?: Partial<AIServiceConfig>
  tagging?: Partial<AIServiceConfig>
  embedding?: Partial<AIServiceConfig>
  features?: Partial<AIFeatureConfig>
}

const createDefaultServiceConfig = (): AIServiceConfig => ({
  use_custom: false,
  api_key: '',
  base_url: '',
  model_name: '',
})

const createDefaultConfig = (): AIConfig => ({
  global: {
    provider: '',
    api_key: '',
    base_url: '',
    model_name: '',
    has_api_key: false,
  },
  summary: createDefaultServiceConfig(),
  translation: createDefaultServiceConfig(),
  tagging: createDefaultServiceConfig(),
  embedding: createDefaultServiceConfig(),
  features: {
    auto_summary: false,
    auto_title_translation: false,
    auto_tagging: false,
    title_display_mode: 'original-first',
    translation_language: 'zh'
  }
})

function mergeConfig(target: AIConfig, updates: PartialAIConfig): AIConfig {
  return {
    global: updates.global ? { ...target.global, ...updates.global } : target.global,
    summary: updates.summary ? { ...target.summary, ...updates.summary } : target.summary,
    translation: updates.translation ? { ...target.translation, ...updates.translation } : target.translation,
    tagging: updates.tagging ? { ...target.tagging, ...updates.tagging } : target.tagging,
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
    // Resolve the effective config for testing
    const serviceConfig = config.value[service]
    let testApiKey: string
    let testBaseUrl: string
    let testModelName: string

    if (overrides) {
      testApiKey = overrides.api_key ?? serviceConfig.api_key
      testBaseUrl = overrides.base_url ?? serviceConfig.base_url
      testModelName = overrides.model_name ?? serviceConfig.model_name
    } else if (serviceConfig.use_custom) {
      testApiKey = serviceConfig.api_key
      testBaseUrl = serviceConfig.base_url
      testModelName = serviceConfig.model_name
    } else {
      testApiKey = config.value.global.api_key
      testBaseUrl = config.value.global.base_url
      testModelName = config.value.global.model_name
    }

    if (!testApiKey || !testBaseUrl || !testModelName) {
      error.value = '请先完善API配置'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<{ success: boolean; message: string }>('/ai/test', {
        service,
        api_key: testApiKey,
        base_url: testBaseUrl,
        model_name: testModelName
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

  // Test global config connection directly
  async function testGlobalConnection(overrides?: Partial<AIGlobalConfig>) {
    const globalCfg = config.value.global
    const testApiKey = overrides?.api_key ?? globalCfg.api_key
    const testBaseUrl = overrides?.base_url ?? globalCfg.base_url
    const testModelName = overrides?.model_name ?? globalCfg.model_name

    if (!testApiKey || !testBaseUrl || !testModelName) {
      error.value = '请先完善API配置'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const { data } = await api.post<{ success: boolean; message: string }>('/ai/test', {
        service: 'summary',
        api_key: testApiKey,
        base_url: testBaseUrl,
        model_name: testModelName
      })
      if (data.success) {
        return true
      } else {
        error.value = data.message
        return false
      }
    } catch (err) {
      console.error('Failed to test global AI connection:', err)
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
    testGlobalConnection,
    clearError,
    resetConfig,
    rebuildVectors,
    getVectorStats
  }
})
