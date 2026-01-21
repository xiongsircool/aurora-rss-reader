/**
 * useArticleParser - Parse HTML content into translatable blocks
 * 
 * This composable takes raw HTML content and splits it into discrete blocks,
 * each with a stable hash ID for caching translations.
 */

import { ref, computed } from 'vue'

export interface ArticleBlock {
    id: string           // Stable hash of text content
    html: string         // Original HTML fragment
    text: string         // Plain text for translation
    tagName: string      // Original tag name (p, h1, li, etc.)
    translation?: string // Translated text (filled later)
    status: 'idle' | 'loading' | 'success' | 'error'
    error?: string       // Error message if failed
}

/**
 * Simple hash function for generating stable block IDs.
 * Uses cyrb53 algorithm - fast and good distribution.
 */
function hashText(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed
    let h2 = 0x41c6ce57 ^ seed
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ ch, 2654435761)
        h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Block-level tags that should be treated as translatable units
 */
const BLOCK_TAGS = new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION',
    'DT', 'DD', 'PRE'  // PRE for code blocks (skip translation but keep structure)
])

/**
 * Tags that should be skipped entirely (media, non-text elements)
 */
const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'MAP', 'AREA'
])

/**
 * Check if an element is a code block that shouldn't be translated
 */
function isCodeBlock(el: Element): boolean {
    return el.tagName === 'PRE' ||
        el.tagName === 'CODE' ||
        el.classList.contains('highlight') ||
        el.classList.contains('code-block')
}

export function useArticleParser() {
    const blocks = ref<ArticleBlock[]>([])
    const isLoading = ref(false)

    /**
     * Parse HTML string into blocks
     */
    function parseContent(html: string): ArticleBlock[] {
        if (!html || typeof html !== 'string') {
            return []
        }

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const result: ArticleBlock[] = []
        let blockIndex = 0

        // Walk through all elements
        function processNode(node: Node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element

                // Skip certain elements entirely
                if (SKIP_TAGS.has(el.tagName)) {
                    return
                }

                // Check if this is a block-level element
                if (BLOCK_TAGS.has(el.tagName)) {
                    const text = el.textContent?.trim() || ''

                    // Skip empty blocks
                    if (!text) {
                        // Still include the HTML for layout purposes but mark as non-translatable
                        result.push({
                            id: `empty_${blockIndex++}`,
                            html: el.outerHTML,
                            text: '',
                            tagName: el.tagName,
                            status: 'success',  // No need to translate
                            translation: ''
                        })
                        return
                    }

                    // Skip code blocks from translation (but keep in output)
                    if (isCodeBlock(el)) {
                        result.push({
                            id: `code_${blockIndex++}`,
                            html: el.outerHTML,
                            text: text,
                            tagName: el.tagName,
                            status: 'success',  // Code doesn't need translation
                            translation: text   // Keep original
                        })
                        return
                    }

                    // Generate stable ID from text content
                    const id = hashText(text)

                    result.push({
                        id,
                        html: el.outerHTML,
                        text,
                        tagName: el.tagName,
                        status: 'idle'
                    })

                    return  // Don't recurse into block elements
                }

                // Recurse into container elements (div, article, section, etc.)
                for (const child of el.childNodes) {
                    processNode(child)
                }
            }
        }

        // Start processing from body
        for (const child of doc.body.childNodes) {
            processNode(child)
        }

        return result
    }

    /**
     * Load and parse content, updating the blocks ref
     */
    function loadContent(html: string) {
        isLoading.value = true
        try {
            blocks.value = parseContent(html)
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Apply cached translations from backend
     */
    function applyCachedTranslations(cache: Record<string, string>) {
        for (const block of blocks.value) {
            if (cache[block.id]) {
                block.translation = cache[block.id]
                block.status = 'success'
            }
        }
    }

    /**
     * Update a single block's translation
     */
    function updateBlockTranslation(blockId: string, translation: string, status: ArticleBlock['status'] = 'success', error?: string) {
        const block = blocks.value.find(b => b.id === blockId)
        if (block) {
            block.translation = translation
            block.status = status
            if (error) block.error = error
        }
    }

    /**
     * Get blocks that need translation
     */
    const pendingBlocks = computed(() =>
        blocks.value.filter(b => b.status === 'idle' && b.text.length > 0)
    )

    /**
     * Check if all blocks are translated
     */
    const isFullyTranslated = computed(() =>
        blocks.value.every(b => b.status === 'success' || b.text.length === 0)
    )

    /**
     * Reset all blocks to idle state
     */
    function resetTranslations() {
        for (const block of blocks.value) {
            if (block.status !== 'success' || !block.id.startsWith('code_')) {
                block.translation = undefined
                block.status = 'idle'
                block.error = undefined
            }
        }
    }

    return {
        blocks,
        isLoading,
        pendingBlocks,
        isFullyTranslated,
        parseContent,
        loadContent,
        applyCachedTranslations,
        updateBlockTranslation,
        resetTranslations
    }
}

export type ArticleParserReturn = ReturnType<typeof useArticleParser>
