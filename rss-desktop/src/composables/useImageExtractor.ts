import type { Entry } from '../types'

/**
 * Extract the first image URL from HTML content
 * Priority: <img src> > <media:content> > background-image
 */
export function extractFirstImage(html: string | null | undefined): string | null {
  if (!html) return null

  // Try to extract from <img> tag
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) {
    return normalizeImageUrl(imgMatch[1])
  }

  // Try to extract from <media:content> or <enclosure>
  const mediaMatch = html.match(/<media:content[^>]+url=["']([^"']+)["']/i)
  if (mediaMatch?.[1]) {
    return normalizeImageUrl(mediaMatch[1])
  }

  const enclosureMatch = html.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i)
  if (enclosureMatch?.[1]) {
    return normalizeImageUrl(enclosureMatch[1])
  }

  // Try to extract from style background-image
  const bgMatch = html.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i)
  if (bgMatch?.[1]) {
    return normalizeImageUrl(bgMatch[1])
  }

  return null
}

/**
 * Normalize image URL (handle relative URLs, data URIs, etc.)
 */
function normalizeImageUrl(url: string): string | null {
  if (!url) return null

  const trimmed = url.trim()

  // Skip data URIs (too small/placeholder images)
  if (trimmed.startsWith('data:')) {
    return null
  }

  // Skip tracking pixels and tiny images
  if (trimmed.includes('pixel') || trimmed.includes('tracking') || trimmed.includes('1x1')) {
    return null
  }

  // Handle protocol-relative URLs
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  // Return absolute URLs as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  // Skip relative URLs (we don't have base URL context)
  return null
}

/**
 * Extract image from an Entry object
 * Tries content first, then summary
 */
export function extractEntryImage(entry: Entry): string | null {
  // Try content first (usually has full HTML)
  const contentImage = extractFirstImage(entry.content)
  if (contentImage) return contentImage

  // Try readability content
  const readabilityImage = extractFirstImage(entry.readability_content)
  if (readabilityImage) return readabilityImage

  // Try summary
  const summaryImage = extractFirstImage(entry.summary)
  if (summaryImage) return summaryImage

  return null
}

/**
 * Generate a consistent color based on entry ID (for placeholder)
 */
export function getEntryPlaceholderColor(entryId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
  ]

  let hash = 0
  for (let i = 0; i < entryId.length; i++) {
    hash = entryId.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

/**
 * Get first letter of title for placeholder
 */
export function getEntryInitial(title: string | null | undefined): string {
  if (!title) return '?'
  const trimmed = title.trim()
  if (!trimmed) return '?'

  // Handle Chinese/Japanese/Korean characters
  const firstChar = trimmed[0]
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(firstChar)) {
    return firstChar
  }

  // Handle English - return first letter uppercase
  return firstChar.toUpperCase()
}
