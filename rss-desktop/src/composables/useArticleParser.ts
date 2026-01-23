/**
 * Article HTML Parser Composable
 *
 * Parses article HTML content into structured blocks for translation.
 */

export type BlockType = 'text' | 'code' | 'media' | 'skip'

export interface ContentBlock {
  id: string // 内容哈希 ID
  type: BlockType // 块类型
  html: string // 原始 HTML
  text: string // 纯文本（用于翻译）
}

// 可翻译的 HTML 标签
const TRANSLATABLE_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'TD',
  'TH',
  'FIGCAPTION',
  'DT',
  'DD',
])

// 代码相关标签
const CODE_TAGS = new Set(['PRE', 'CODE'])

// 媒体相关标签
const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'AUDIO', 'IFRAME', 'CANVAS', 'SVG'])

// 结束标点（用于判断是否为完整句子）
const END_PUNCTUATION = /[.!?。！？；;:：）)」』\]】]$/

// 纯符号/分隔符模式
const PURE_SYMBOLS = /^[\s\-_=*•·—–|\/\\<>,.;:!?@#$%^&()[\]{}'"``~\u2000-\u206F\u2E00-\u2E7F]+$/

// 日期/数字模式
const DATE_NUMBER_PATTERN = /^[\d\s\-./,:TZ+]+$/

/**
 * 生成内容块的哈希 ID
 */
async function generateBlockId(text: string, sourceLang: string): Promise<string> {
  // 1. 归一化文本：移除所有非字母数字字符，转小写
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

  // 2. 使用 Web Crypto API 生成 SHA-256 哈希
  const data = new TextEncoder().encode(normalized + ':' + sourceLang)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // 3. 转换为十六进制字符串，取前 16 位
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return hashHex.substring(0, 16)
}

/**
 * 同步版本的哈希生成（使用简单哈希算法）
 * 用于不需要等待的场景
 */
function generateBlockIdSync(text: string, sourceLang: string): string {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const input = normalized + ':' + sourceLang

  // 简单的 djb2 哈希算法
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }

  // 转换为 16 位十六进制
  const h1 = (hash >>> 0).toString(16).padStart(8, '0')
  const h2 = ((hash * 31) >>> 0).toString(16).padStart(8, '0')
  return (h1 + h2).substring(0, 16)
}

/**
 * 判断文本是否为噪音（应跳过翻译）
 */
function isNoiseText(text: string): boolean {
  const trimmed = text.trim()

  // 1. 空内容
  if (!trimmed || trimmed === '\u00A0') {
    return true
  }

  // 2. 纯符号/分隔符
  if (PURE_SYMBOLS.test(trimmed)) {
    return true
  }

  // 3. 短文本无标点（可能是导航、按钮等）
  if (trimmed.length < 10 && !END_PUNCTUATION.test(trimmed)) {
    return true
  }

  // 4. 纯日期/数字
  if (DATE_NUMBER_PATTERN.test(trimmed)) {
    return true
  }

  return false
}

/**
 * 解析 HTML 内容为结构化块
 */
export function parseArticleContent(html: string, sourceLang: string = 'en'): ContentBlock[] {
  if (!html) {
    return []
  }

  const container = document.createElement('div')
  container.innerHTML = html

  const blocks: ContentBlock[] = []

  // 遍历所有子元素
  function processElement(element: Element, depth: number = 0): void {
    const tagName = element.tagName

    // 媒体标签直接添加为 media 类型
    if (MEDIA_TAGS.has(tagName)) {
      blocks.push({
        id: generateBlockIdSync(element.outerHTML, sourceLang),
        type: 'media',
        html: element.outerHTML,
        text: '',
      })
      return
    }

    // 代码块直接添加为 code 类型
    if (CODE_TAGS.has(tagName)) {
      blocks.push({
        id: generateBlockIdSync(element.outerHTML, sourceLang),
        type: 'code',
        html: element.outerHTML,
        text: element.textContent || '',
      })
      return
    }

    // 可翻译的叶子节点
    if (TRANSLATABLE_TAGS.has(tagName)) {
      const text = element.textContent || ''
      const type = isNoiseText(text) ? 'skip' : 'text'

      blocks.push({
        id: generateBlockIdSync(text, sourceLang),
        type,
        html: element.outerHTML,
        text: text.trim(),
      })
      return
    }

    // 容器元素，递归处理子元素
    const children = element.children
    if (children.length === 0) {
      // 没有子元素，检查是否有文本内容
      const text = element.textContent || ''
      if (text.trim()) {
        const type = isNoiseText(text) ? 'skip' : 'text'
        blocks.push({
          id: generateBlockIdSync(text, sourceLang),
          type,
          html: element.outerHTML,
          text: text.trim(),
        })
      }
    } else {
      // 有子元素，递归处理
      for (let i = 0; i < children.length; i++) {
        processElement(children[i], depth + 1)
      }
    }
  }

  // 从顶层开始处理
  for (let i = 0; i < container.children.length; i++) {
    processElement(container.children[i])
  }

  // 如果没有找到任何块，尝试将整个内容作为一个文本块
  if (blocks.length === 0 && container.textContent?.trim()) {
    const text = container.textContent.trim()
    if (!isNoiseText(text)) {
      blocks.push({
        id: generateBlockIdSync(text, sourceLang),
        type: 'text',
        html: html,
        text: text,
      })
    }
  }

  return blocks
}

/**
 * 获取可翻译的块
 */
export function getTranslatableBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((block) => block.type === 'text')
}

/**
 * Composable 导出
 */
export function useArticleParser() {
  return {
    parseArticleContent,
    getTranslatableBlocks,
    generateBlockId,
    generateBlockIdSync,
    isNoiseText,
  }
}
