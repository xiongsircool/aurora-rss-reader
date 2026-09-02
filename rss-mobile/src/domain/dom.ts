/**
 * DOM helpers backed by the platform's native DOMParser.
 *
 * The backend uses jsdom; on-device we use the WebView's built-in DOMParser,
 * and in tests vitest's jsdom environment provides the same global. This module
 * is the single seam between the ported domain logic and the DOM engine.
 */

/** Parse an HTML fragment/string into a Document. */
export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

/** Parse an XML string into a Document. Returns null on a parser error. */
export function parseXml(xml: string): Document | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return null
  return doc
}

/**
 * Strip HTML and collapse whitespace to plain text.
 * Port of backend `utils/text.ts:cleanHtmlText`.
 */
export function cleanHtmlText(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null
  try {
    const doc = parseHtml(value)
    const text = doc.body?.textContent ?? ''
    if (!text.trim()) return null
    const normalized = text.replace(/\s+/g, ' ').trim()
    return normalized || null
  } catch {
    return null
  }
}

/**
 * Resolve a possibly-relative URL against a base; returns an absolute http(s)
 * URL or null. Mirrors the backend's normalizeUrl behavior (rejects data: and
 * non-http protocols, upgrades protocol-relative //host to https).
 */
export function normalizeUrl(value: string | null | undefined, baseUrl: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('data:')) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return null
  } catch {
    if (!baseUrl) return null
    try {
      return new URL(trimmed, baseUrl).toString()
    } catch {
      return null
    }
  }
}
