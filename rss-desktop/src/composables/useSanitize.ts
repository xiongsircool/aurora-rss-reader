import DOMPurify from 'dompurify'

export function useSanitize() {
    /**
     * Sanitizes HTML content to prevent XSS attacks while preserving
     * safe formatting.
     *
     * @param content - The raw HTML content string
     * @returns Sanitized HTML string
     */
    function sanitize(content: string | null | undefined): string {
        if (!content) return ''

        return DOMPurify.sanitize(content, {
            // 允许的标签和属性白名单，根据需要调整
            ADD_TAGS: ['iframe', 'embed'], // 允许 embedded content (如 video)
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'loading'], // 允许的属性

            // 钩子函数：在净化过程中处理元素
            // 1. 确保所有链接在新标签页打开
            // 2. 为图片添加懒加载
            FORBID_TAGS: ['script', 'style'], // 禁止脚本和样式标签
            FORBID_ATTR: ['onmouseover', 'onclick', 'onerror'], // 禁止事件处理
        })
    }

    /**
     * Configure DOMPurify hooks
     * This should be called once, or the hooks can be added inside sanitize
     * but adding them globally via the library is also common.
     * Ideally, we can configure hooks per sanitize call or globally.
     * Here we will use the hook feature inside a setup function if needed,
     * but basic configuration is passed to sanitize().
     * 
     * Let's add global hooks for target_blank and lazy loading.
     */

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        // Open links in new tab
        if ('target' in node) {
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
        }

        // Lazy load images
        if (node.tagName === 'IMG' && !node.hasAttribute('loading')) {
            node.setAttribute('loading', 'lazy')
        }
    })

    /**
     * Sanitizes title HTML content with stricter rules than article content.
     * Only allows basic formatting tags commonly used in RSS titles.
     *
     * @param title - The raw title string that may contain HTML
     * @returns Sanitized HTML string safe for v-html rendering
     */
    function sanitizeTitle(title: string | null | undefined): string {
        if (!title) return ''

        return DOMPurify.sanitize(title, {
            ALLOWED_TAGS: ['em', 'i', 'strong', 'b', 'sup', 'sub', 'code'],
            ALLOWED_ATTR: [], // No attributes needed for title formatting
            KEEP_CONTENT: true, // Keep text content even if tags are removed
        })
    }

    return {
        sanitize,
        sanitizeTitle
    }
}
