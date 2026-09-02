import { describe, expect, it } from 'vitest'
import { decodeBody, detectCharset } from './http'

describe('detectCharset', () => {
  it('returns null for utf-8 content-type', () => {
    expect(detectCharset('text/xml; charset=utf-8', undefined)).toBeNull()
    expect(detectCharset('application/rss+xml; charset=UTF-8', undefined)).toBeNull()
  })

  it('extracts a non-utf-8 charset from content-type', () => {
    expect(detectCharset('text/xml; charset=GBK', undefined)).toBe('gbk')
    expect(detectCharset('text/html; charset=ISO-8859-1', undefined)).toBe('iso-8859-1')
  })

  it('falls back to the XML encoding declaration', () => {
    const xml = `<?xml version="1.0" encoding="GB2312"?><rss></rss>`
    expect(detectCharset(undefined, xml)).toBe('gb2312')
  })

  it('falls back to a <meta charset> declaration', () => {
    const html = `<!doctype html><meta charset="shift_jis">`
    expect(detectCharset(undefined, html)).toBe('shift_jis')
  })

  it('returns null when nothing declares a non-utf-8 charset', () => {
    expect(detectCharset(undefined, '<rss></rss>')).toBeNull()
    expect(detectCharset('text/xml', undefined)).toBeNull()
  })

  it('prefers a content-type charset over the body declaration', () => {
    const xml = `<?xml version="1.0" encoding="GBK"?>`
    expect(detectCharset('text/xml; charset=utf-8', xml)).toBeNull()
  })
})

describe('decodeBody', () => {
  function toBuffer(s: string): ArrayBuffer {
    return new TextEncoder().encode(s).buffer
  }

  it('decodes utf-8 content', () => {
    const buf = toBuffer('<rss><title>你好</title></rss>')
    expect(decodeBody(buf, 'text/xml; charset=utf-8')).toContain('你好')
  })

  it('decodes utf-8 by default when no charset is given', () => {
    const buf = toBuffer('<rss><title>hello</title></rss>')
    expect(decodeBody(buf, undefined)).toContain('hello')
  })

  it('falls back to utf-8 for an unsupported charset label', () => {
    const buf = toBuffer('<rss>ok</rss>')
    // bogus charset should not throw; falls through to utf-8
    expect(decodeBody(buf, 'text/xml; charset=not-a-real-charset')).toContain('ok')
  })
})
