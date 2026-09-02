import DOMPurify from 'dompurify'
import { marked } from 'marked'

let hooksConfigured = false

function configureHooks() {
  if (hooksConfigured) return
  hooksConfigured = true

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }

    if (node instanceof HTMLImageElement && !node.hasAttribute('loading')) {
      node.setAttribute('loading', 'lazy')
      node.setAttribute('decoding', 'async')
    }
  })
}

export function sanitizeHtml(content: string | null | undefined): string {
  configureHooks()

  if (!content) return ''

  return DOMPurify.sanitize(content, {
    ADD_TAGS: ['iframe', 'figure', 'figcaption'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'loading', 'decoding'],
    FORBID_TAGS: ['script', 'style'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  })
}

/**
 * Render Markdown to sanitized HTML. AI summaries are produced as Markdown, so
 * the reader must render md syntax rather than show it literally (issue #14.4).
 */
export function renderMarkdown(content: string | null | undefined): string {
  if (!content) return ''
  const html = marked.parse(content, { async: false, breaks: true }) as string
  return sanitizeHtml(html)
}

export function sanitizeTitle(content: string | null | undefined): string {
  if (!content) return ''

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}
