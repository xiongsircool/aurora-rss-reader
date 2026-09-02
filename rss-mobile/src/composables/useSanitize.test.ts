import { describe, expect, it } from 'vitest'
import { renderMarkdown, sanitizeHtml } from './useSanitize'

describe('renderMarkdown', () => {
  it('renders headings, bold, and lists', () => {
    const html = renderMarkdown('# Title\n\n**bold** and a list:\n\n- one\n- two')
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('const x = 1')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
  })

  it('strips script tags from rendered markdown (XSS-safe)', () => {
    const html = renderMarkdown('hello\n\n<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
  })
})

describe('sanitizeHtml', () => {
  it('removes inline event handlers', () => {
    const html = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(html).not.toContain('onerror')
  })

  it('keeps iframes (for video embeds) but drops scripts', () => {
    const html = sanitizeHtml('<iframe src="https://youtube.com/embed/x"></iframe><script>bad()</script>')
    expect(html).toContain('<iframe')
    expect(html).not.toContain('<script>')
  })
})
