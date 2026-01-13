// AI 服务配置接口
export interface AIServiceConfig {
  base_url: string
  model: string
  api_key: string | null
  enabled: boolean
}

// 标题显示模式类型
export type TitleDisplayMode = 'replace' | 'translation-first' | 'original-first'

// AI 功能配置接口
export interface AIFeatureConfig {
  auto_summary: boolean
  auto_translation: boolean
  auto_title_translation: boolean
  title_display_mode: TitleDisplayMode
  translation_target_language: string
}

// AI 配置响应接口
export interface AIConfigResponse {
  summary: AIServiceConfig
  translation: AIServiceConfig
  features: AIFeatureConfig
  config_source: 'database' | 'environment'
  database_ready: boolean
}