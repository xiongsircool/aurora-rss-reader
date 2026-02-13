/**
 * Article Translation Composable
 *
 * Manages full-text paragraph-by-paragraph translation state and API calls.
 */

import { ref, computed, watch, type Ref } from 'vue'
import api from '../api/client'
import { parseArticleContent, getTranslatableBlocks, type ContentBlock } from './useArticleParser'

export type TranslationStatus = 'idle' | 'translating' | 'showing' | 'error'

export interface ArticleTranslationState {
  status: TranslationStatus
  progress: number // 0-100
  translationMap: Map<string, string> // block_id -> translated_text
  failedBlocks: Set<string>
  blocks: ContentBlock[]
}

interface SSETranslationEvent {
  id: string
  text?: string
  error?: string
}

interface SSEProgressEvent {
  total: number
  completed: number
  cached: number
}

/**
 * 创建文章翻译 composable
 */
export function useArticleTranslation(
  entryId: Ref<string | null>,
  entryContent: Ref<string | null>,
  targetLanguage: Ref<string>,
  sourceLang: string = 'en'
) {
  // 状态
  const status = ref<TranslationStatus>('idle')
  const progress = ref(0)
  const translationMap = ref<Map<string, string>>(new Map())
  const failedBlocks = ref<Set<string>>(new Set())
  const blocks = ref<ContentBlock[]>([])
  const abortController = ref<AbortController | null>(null)

  // 计算属性
  const isTranslating = computed(() => status.value === 'translating')
  const showTranslation = computed(() => status.value === 'showing' || status.value === 'translating')
  const hasError = computed(() => status.value === 'error' || failedBlocks.value.size > 0)

  const translatableBlocks = computed(() => getTranslatableBlocks(blocks.value))

  const translatedCount = computed(() => {
    let count = 0
    for (const block of translatableBlocks.value) {
      if (translationMap.value.has(block.id)) {
        count++
      }
    }
    return count
  })

  // 获取单个块的翻译
  function getTranslation(blockId: string): string | null {
    return translationMap.value.get(blockId) ?? null
  }

  // 检查块是否正在加载
  function isBlockLoading(blockId: string): boolean {
    if (status.value !== 'translating') return false
    return !translationMap.value.has(blockId) && !failedBlocks.value.has(blockId)
  }

  // 检查块是否失败
  function isBlockFailed(blockId: string): boolean {
    return failedBlocks.value.has(blockId)
  }

  // 解析文章内容
  function parseContent() {
    if (!entryContent.value) {
      blocks.value = []
      return
    }
    blocks.value = parseArticleContent(entryContent.value, sourceLang)
  }

  // 重置状态
  function reset() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    status.value = 'idle'
    progress.value = 0
    translationMap.value = new Map()
    failedBlocks.value = new Set()
    blocks.value = []
  }

  // 切换翻译显示
  function toggleTranslation() {
    if (status.value === 'showing') {
      status.value = 'idle'
      return
    }

    if (status.value === 'idle' || status.value === 'error') {
      startTranslation()
    }
  }

  // 开始翻译
  async function startTranslation() {
    if (!entryId.value || !entryContent.value) {
      return
    }

    // 解析内容
    parseContent()

    const translatables = translatableBlocks.value
    if (translatables.length === 0) {
      status.value = 'showing'
      return
    }

    // 准备请求数据
    const requestBlocks = translatables.map((block) => ({
      id: block.id,
      text: block.text,
    }))

    // 设置状态
    status.value = 'translating'
    progress.value = 0
    failedBlocks.value = new Set()

    // 创建 AbortController
    abortController.value = new AbortController()

    try {
      const baseUrl = api.defaults.baseURL || '/api'
      const response = await fetch(`${baseUrl}/ai/translate-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry_id: entryId.value,
          source_lang: sourceLang,
          target_lang: targetLanguage.value,
          blocks: requestBlocks,
        }),
        signal: abortController.value.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 读取 SSE 流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // 解析 SSE 事件
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)
                handleSSEEvent(currentEvent, data, translatables.length)
              } catch (e) {
                console.warn('Failed to parse SSE data:', currentData, e)
              }
            }

            currentEvent = ''
            currentData = ''
          }
        }
      }

      // 翻译完成
      if (failedBlocks.value.size === translatables.length) {
        status.value = 'error'
      } else {
        status.value = 'showing'
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户取消
        status.value = 'idle'
      } else {
        console.error('Translation error:', error)
        status.value = 'error'
      }
    } finally {
      abortController.value = null
    }
  }

  // 处理 SSE 事件
  function handleSSEEvent(event: string, data: unknown, total: number) {
    switch (event) {
      case 'progress': {
        const progressData = data as SSEProgressEvent
        // 使用 completed 而不是 cached 来计算进度
        progress.value = Math.round((progressData.completed / total) * 100)
        break
      }

      case 'translation': {
        const translationData = data as SSETranslationEvent
        if (translationData.text) {
          translationMap.value.set(translationData.id, translationData.text)
          progress.value = Math.round((translationMap.value.size / total) * 100)
        }
        break
      }

      case 'error': {
        const errorData = data as SSETranslationEvent
        failedBlocks.value.add(errorData.id)
        console.warn(`Translation failed for block ${errorData.id}:`, errorData.error)
        break
      }

      case 'done': {
        progress.value = 100
        break
      }
    }
  }

  // 重试翻译
  function retryTranslation() {
    failedBlocks.value.clear()
    startTranslation()
  }

  // 取消翻译
  function cancelTranslation() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    status.value = 'idle'
  }

  // 监听 entry 变化，重置状态
  watch(entryId, () => {
    reset()
  })

  // 监听目标语言变化
  watch(targetLanguage, () => {
    if (status.value === 'showing') {
      // 语言变化时重新翻译
      translationMap.value = new Map()
      failedBlocks.value = new Set()
      startTranslation()
    }
  })

  return {
    // 状态
    status,
    progress,
    blocks,
    translationMap,
    failedBlocks,

    // 计算属性
    isTranslating,
    showTranslation,
    hasError,
    translatableBlocks,
    translatedCount,

    // 方法
    getTranslation,
    isBlockLoading,
    isBlockFailed,
    toggleTranslation,
    startTranslation,
    retryTranslation,
    cancelTranslation,
    reset,
    parseContent,
  }
}
