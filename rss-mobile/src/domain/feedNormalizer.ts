/**
 * Feed item normalizer — on-device port of
 * `backend-node/src/services/feedNormalizer.ts`.
 *
 * Differences from the backend version:
 *  - jsdom is replaced by the native DOMParser via ./dom.
 *  - DOI/PMID academic extraction is dropped (not relevant to the mobile reader).
 *  - Operates on the ParsedFeedItem shape produced by ./feedParser, which mirrors
 *    the rss-parser field names the backend consumed.
 */
import { cleanHtmlText, parseHtml } from './dom'
import type { NormalizedEntry } from '../data/models'
import type { ParsedFeed, ParsedFeedItem } from './feedParser'

export function extractDateFromDescription(description: string | undefined): string | null {
  if (!description) return null

  const patterns = [
    /Publication date:\s*([A-Za-z]+)\s+(\d{4})/i,
    /Published:\s*([A-Za-z]+)\s+(\d{4})/i,
    /Date:\s*([A-Za-z]+)\s+(\d{4})/i,
  ]
  const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (!match) continue
    const month = monthMap[match[1].toLowerCase()]
    if (!month) continue
    return `${match[2]}-${String(month).padStart(2, '0')}-01T00:00:00Z`
  }
  return null
}

export function parseDate(dateString: string | undefined, fallbackDate?: Date): string | null {
  if (!dateString) return fallbackDate ? fallbackDate.toISOString() : null

  try {
    const trimmed = dateString.trim()

    // Treat a timezone-less ISO datetime as UTC (deterministic across devices),
    // rather than letting `new Date` interpret it as device-local time.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      const asUtc = new Date(`${trimmed}Z`)
      if (!Number.isNaN(asUtc.getTime())) return asUtc.toISOString()
    }

    const standard = new Date(dateString)
    if (!Number.isNaN(standard.getTime())) return standard.toISOString()

    const numericTimestamp = /^\d+$/.test(trimmed) ? Number(trimmed) : null
    const alternatives = [
      () => (numericTimestamp !== null && trimmed.length >= 11 ? new Date(numericTimestamp) : null),
      () => (numericTimestamp !== null && trimmed.length <= 10 ? new Date(numericTimestamp * 1000) : null),
    ]
    for (const attempt of alternatives) {
      const parsed = attempt()
      if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  } catch {
    // fall through
  }
  return fallbackDate ? fallbackDate.toISOString() : null
}

function extractEnclosure(item: ParsedFeedItem): Pick<NormalizedEntry, 'enclosure_url' | 'enclosure_type' | 'enclosure_length'> {
  const enc = item.enclosure
  if (enc?.url && enc.url.startsWith('http')) {
    return {
      enclosure_url: enc.url,
      enclosure_type: enc.type ?? null,
      enclosure_length: enc.length ? Number.parseInt(String(enc.length), 10) : null,
    }
  }

  const media = item.mediaContent?.[0]
  if (media?.url) {
    return {
      enclosure_url: media.url,
      enclosure_type: media.type ?? null,
      enclosure_length: media.fileSize ? Number.parseInt(String(media.fileSize), 10) : null,
    }
  }

  return { enclosure_url: null, enclosure_type: null, enclosure_length: null }
}

function extractItemImageUrl(item: ParsedFeedItem): string | null {
  if (item.image) return item.image
  if (item.itunesImage) return item.itunesImage
  if (item.mediaThumbnail) return item.mediaThumbnail

  if (item.mediaContent?.length) {
    for (const media of item.mediaContent) {
      const type = (media.type ?? '').toLowerCase()
      const medium = (media.medium ?? '').toLowerCase()
      if (media.url && (type.startsWith('image/') || medium === 'image')) return media.url
    }
  }

  const enc = item.enclosure
  if (enc?.url && enc.url.startsWith('http') && (enc.type ?? '').toLowerCase().startsWith('image/')) {
    return enc.url
  }
  return null
}

function extractImageUrlFromHtml(html: string | null | undefined, baseUrl: string | null): string | null {
  if (!html) return null
  try {
    const doc = parseHtml(html)
    const images = Array.from(doc.querySelectorAll('img'))
    for (const image of images) {
      const rawSrc =
        image.getAttribute('src') ||
        image.getAttribute('data-src') ||
        image.getAttribute('data-original') ||
        image.getAttribute('data-actual') ||
        image.getAttribute('data-lazy-src')

      if (!rawSrc || rawSrc.startsWith('data:')) continue
      const lower = rawSrc.toLowerCase()
      if (lower.includes('pixel') || lower.includes('tracking') || lower.includes('1x1')) continue
      if (rawSrc.startsWith('//')) return `https:${rawSrc}`
      try {
        return baseUrl ? new URL(rawSrc, baseUrl).toString() : new URL(rawSrc).toString()
      } catch {
        continue
      }
    }
  } catch {
    return null
  }
  return null
}

function normalizeIconUrl(candidate: string | null, baseUrl: string | null): string | null {
  if (!candidate || candidate.startsWith('data:')) return null
  if (candidate.startsWith('//')) return `https:${candidate}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return candidate
  } catch {
    // relative — handled below
  }
  if (!baseUrl) return null
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return null
  }
}

function buildOrigin(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

export function selectFeedIcon(feed: ParsedFeed, siteUrl: string | null, feedUrl: string): string | null {
  const baseUrl = siteUrl || feedUrl
  const candidates: string[] = []
  const add = (value: string | null | undefined) => {
    const normalized = normalizeIconUrl(value ?? null, baseUrl)
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized)
  }

  add(feed.image)
  add(feed.icon)

  const origin = buildOrigin(baseUrl)
  if (origin) {
    add(`${origin}/favicon.ico`)
    add(`${origin}/apple-touch-icon.png`)
  }
  return candidates[0] ?? null
}

export function normalizeFeedItem(item: ParsedFeedItem, feedUrl: string): NormalizedEntry | null {
  const guid = item.guid || item.link || item.title || ''
  if (!guid) return null

  let publishedAt = parseDate(item.pubDate || item.isoDate)
  if (!publishedAt) {
    for (const dateField of [item.published, item.updated, item.date, item.dcDate]) {
      if (!dateField) continue
      publishedAt = parseDate(dateField)
      if (publishedAt) break
    }
  }
  if (!publishedAt) {
    publishedAt = extractDateFromDescription(item.content || item.contentSnippet || item.summary || undefined)
  }

  const contentHtml = item.contentEncoded || item.content || item.summary || item.contentSnippet || null
  const summary = cleanHtmlText(item.contentSnippet || item.summary || item.content || item.contentEncoded)
  const enclosure = extractEnclosure(item)
  const imageUrl = extractItemImageUrl(item) || extractImageUrlFromHtml(contentHtml, item.link || feedUrl || null)

  return {
    guid,
    title: item.title ?? null,
    url: item.link ?? null,
    author: item.creator || item.author || null,
    summary,
    content: contentHtml,
    readability_content: null,
    categories_json: item.categories?.length ? JSON.stringify(item.categories) : null,
    published_at: publishedAt,
    duration: item.duration ?? null,
    image_url: imageUrl,
    content_source_url: item.link ?? null,
    ...enclosure,
  }
}
