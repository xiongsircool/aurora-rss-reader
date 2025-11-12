import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import jaJP from './locales/ja-JP.json'
import koKR from './locales/ko-KR.json'

// 支持的语言列表
export const availableLocales = [
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' }
] as const

export type LocaleCode = typeof availableLocales[number]['code']

// 获取浏览器语言偏好
export function getBrowserLocale(): LocaleCode {
  const navigator = window.navigator
  const browserLang = navigator.language || (navigator as any).userLanguage

  // 尝试精确匹配
  if (browserLang.startsWith('zh')) return 'zh'
  if (browserLang.startsWith('en')) return 'en'
  if (browserLang.startsWith('ja')) return 'ja'
  if (browserLang.startsWith('ko')) return 'ko'

  // 默认返回中文
  return 'zh'
}

// 创建i18n实例
const i18n = createI18n({
  legacy: false, // 使用Composition API模式
  locale: 'zh', // 默认语言
  fallbackLocale: 'zh', // 回退语言
  messages: {
    'zh': zhCN,
    'en': enUS,
    'ja': jaJP,
    'ko': koKR
  },
  globalInjection: true // 全局注入$t函数
})

export default i18n