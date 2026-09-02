/**
 * Entry presentation builder — on-device port of
 * `backend-node/src/services/entryPresentation.ts`. jsdom is replaced by the
 * native DOMParser (./dom). Produces the mobile reading model that drives which
 * reader template renders (article / image / gallery / video / audio).
 */
import { cleanHtmlText, normalizeUrl, parseHtml } from './dom'
import type { EntryContentType } from './contentType'

export type EntryVideoPlatform = 'youtube' | 'vimeo' | 'bilibili' | 'native' | 'unknown'

export interface EntryMediaImage {
  url: string
  alt: string | null
  caption: string | null
  width: number | null
  height: number | null
}

export interface EntryVideo {
  url: string
  platform: EntryVideoPlatform
  thumbnail_url: string | null
  duration: string | null
  embed_url: string | null
}

export interface EntryPresentationInput {
  id: string
  title: string | null
  url: string | null
  summary: string | null
  content: string | null
  readability_content: string | null
  enclosure_url: string | null
  enclosure_type: string | null
  duration: string | null
  image_url: string | null
  content_extraction_status?: string | null
  content_source_url?: string | null
  feed_url?: string | null
  feed_site_url?: string | null
  feed_view_type?: string | null
}

export interface EntryPresentation {
  content_type: EntryContentType
  preview_text: string | null
  reader_html: string | null
  lead_image_url: string | null
  images: EntryMediaImage[]
  video: EntryVideo | null
  has_full_content: boolean
  extraction_status: string
  word_count: number
  reading_time_minutes: number | null
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function buildBaseUrl(entry: EntryPresentationInput): string | null {
  return firstNonEmpty(entry.content_source_url, entry.url, entry.feed_site_url, entry.feed_url)
}

function looksLikeJunkImage(url: string, alt: string | null, width: number | null, height: number | null): boolean {
  const lowerUrl = url.toLowerCase()
  const lowerAlt = (alt ?? '').toLowerCase()
  const junkTokens = ['1x1', 'pixel', 'tracking', 'spacer', 'transparent', 'blank.gif', 'avatar', 'profile', 'logo', 'icon', 'favicon']
  if (junkTokens.some((t) => lowerUrl.includes(t) || lowerAlt.includes(t))) return true
  if (width !== null && height !== null && width <= 32 && height <= 32) return true
  return false
}

function parseDimension(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeText(value: string | null): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || null
}

function extractImagesFromHtml(html: string | null, baseUrl: string | null): EntryMediaImage[] {
  if (!html) return []
  const images: EntryMediaImage[] = []
  const seen = new Set<string>()

  try {
    const doc = parseHtml(html)
    const nodes = Array.from(doc.querySelectorAll('img'))
    for (const node of nodes) {
      const rawSrc =
        node.getAttribute('src') ||
        node.getAttribute('data-src') ||
        node.getAttribute('data-original') ||
        node.getAttribute('data-actual') ||
        node.getAttribute('data-lazy-src') ||
        node.getAttribute('data-orig-file')

      const url = normalizeUrl(rawSrc, baseUrl)
      if (!url || seen.has(url)) continue

      const width = parseDimension(node.getAttribute('width'))
      const height = parseDimension(node.getAttribute('height'))
      const alt = normalizeText(node.getAttribute('alt'))
      if (looksLikeJunkImage(url, alt, width, height)) continue

      const caption = normalizeText(node.closest('figure')?.querySelector('figcaption')?.textContent ?? null)
      seen.add(url)
      images.push({ url, alt, caption, width, height })
    }
  } catch {
    return images
  }
  return images
}

function addImageCandidate(images: EntryMediaImage[], candidateUrl: string | null, baseUrl: string | null): void {
  const url = normalizeUrl(candidateUrl, baseUrl)
  if (!url || images.some((image) => image.url === url)) return
  if (looksLikeJunkImage(url, null, null, null)) return
  images.unshift({ url, alt: null, caption: null, width: null, height: null })
}

function extractYouTubeVideo(html: string, duration: string | null): EntryVideo | null {
  const match = html.match(/(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i)
  if (!match?.[1]) return null
  const videoId = match[1]
  return {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    platform: 'youtube',
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration,
    embed_url: `https://www.youtube.com/embed/${videoId}`,
  }
}

function extractVimeoVideo(html: string, duration: string | null): EntryVideo | null {
  const match = html.match(/(?:player\.vimeo\.com\/video\/|vimeo\.com\/)(\d+)/i)
  if (!match?.[1]) return null
  const videoId = match[1]
  return {
    url: `https://vimeo.com/${videoId}`,
    platform: 'vimeo',
    thumbnail_url: null,
    duration,
    embed_url: `https://player.vimeo.com/video/${videoId}`,
  }
}

function extractBilibiliVideo(html: string, duration: string | null, thumbnailUrl: string | null): EntryVideo | null {
  const iframeMatch = html.match(/bilibili\.com\/(?:player\.html|blackboard\/html5mobileplayer\.html)\?[^"']*bvid=([a-zA-Z0-9]+)/i)
  const linkMatch = html.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
  const videoId = iframeMatch?.[1] || linkMatch?.[1] || null
  if (!videoId) return null
  return { url: `https://www.bilibili.com/video/${videoId}`, platform: 'bilibili', thumbnail_url: thumbnailUrl, duration, embed_url: null }
}

function extractNativeVideo(html: string, baseUrl: string | null, duration: string | null, thumbnailUrl: string | null): EntryVideo | null {
  try {
    const doc = parseHtml(html)
    const video = doc.querySelector('video')
    if (!video) return null
    const source = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src') || null
    const url = normalizeUrl(source, baseUrl)
    if (!url) return null
    return {
      url,
      platform: 'native',
      thumbnail_url: normalizeUrl(video.getAttribute('poster'), baseUrl) || thumbnailUrl,
      duration,
      embed_url: null,
    }
  } catch {
    return null
  }
}

function extractVideo(entry: EntryPresentationInput, baseUrl: string | null, leadImageUrl: string | null): EntryVideo | null {
  const enclosureType = (entry.enclosure_type ?? '').toLowerCase()
  const enclosureUrl = normalizeUrl(entry.enclosure_url, baseUrl)

  if (enclosureUrl && (enclosureType.startsWith('video/') || /\.(mp4|webm|m4v|mov|m3u8)(\?|#|$)/i.test(enclosureUrl))) {
    return { url: enclosureUrl, platform: 'native', thumbnail_url: leadImageUrl, duration: entry.duration ?? null, embed_url: null }
  }

  const html = firstNonEmpty(entry.content, entry.readability_content, entry.summary) ?? ''
  if (!html) return null

  return (
    extractYouTubeVideo(html, entry.duration ?? null) ||
    extractVimeoVideo(html, entry.duration ?? null) ||
    extractBilibiliVideo(html, entry.duration ?? null, leadImageUrl) ||
    extractNativeVideo(html, baseUrl, entry.duration ?? null, leadImageUrl)
  )
}

function calculateWordCount(text: string | null): number {
  if (!text) return 0
  const cjk = text.match(/[一-鿿぀-ヿ가-힯]/g) ?? []
  const latin = text.replace(/[一-鿿぀-ヿ가-힯]/g, ' ').match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? []
  return cjk.length + latin.length
}

function classifyContentType(entry: EntryPresentationInput, images: EntryMediaImage[], video: EntryVideo | null, wordCount: number): EntryContentType {
  const enclosureType = (entry.enclosure_type ?? '').toLowerCase()
  const viewType = (entry.feed_view_type ?? '').toLowerCase()

  if (video) return 'video'
  if (entry.enclosure_url && enclosureType.startsWith('audio/')) return 'audio'
  if (viewType === 'videos') return 'video'
  if (viewType === 'audio') return 'audio'
  if (images.length >= 3 && (viewType === 'pictures' || wordCount < 900)) return 'gallery'
  if (images.length > 0 && (viewType === 'pictures' || wordCount < 450)) return 'image'
  return 'article'
}

export function buildEntryPresentation(entry: EntryPresentationInput): EntryPresentation {
  const baseUrl = buildBaseUrl(entry)
  const readerHtml = firstNonEmpty(entry.readability_content, entry.content, entry.summary)
  const rawText = cleanHtmlText(readerHtml) || cleanHtmlText(entry.summary) || null
  const previewText = rawText ? rawText.slice(0, 260) : null
  const images = extractImagesFromHtml(readerHtml, baseUrl)

  addImageCandidate(images, entry.image_url, baseUrl)

  const leadImageUrl = images[0]?.url ?? normalizeUrl(entry.image_url, baseUrl)
  const video = extractVideo(entry, baseUrl, leadImageUrl)
  const wordCount = calculateWordCount(rawText)
  const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 260)) : null
  const contentType = classifyContentType(entry, images, video, wordCount)

  return {
    content_type: contentType,
    preview_text: previewText,
    reader_html: readerHtml,
    lead_image_url: video?.thumbnail_url || leadImageUrl,
    images,
    video,
    has_full_content: Boolean(entry.readability_content),
    extraction_status: entry.content_extraction_status ?? 'skipped',
    word_count: wordCount,
    reading_time_minutes: readingTimeMinutes,
  }
}
