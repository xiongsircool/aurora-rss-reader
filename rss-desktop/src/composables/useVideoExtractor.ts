import type { Entry } from '../types'

export interface VideoInfo {
  url: string
  thumbnail: string | null
  platform: 'youtube' | 'vimeo' | 'bilibili' | 'native' | 'unknown'
  videoId: string | null
}

/**
 * Extract video information from HTML content
 */
export function extractVideoInfo(html: string | null | undefined): VideoInfo | null {
  if (!html) return null

  // Try YouTube iframe
  const youtubeInfo = extractYouTube(html)
  if (youtubeInfo) return youtubeInfo

  // Try Vimeo iframe
  const vimeoInfo = extractVimeo(html)
  if (vimeoInfo) return vimeoInfo

  // Try Bilibili iframe
  const bilibiliInfo = extractBilibili(html)
  if (bilibiliInfo) return bilibiliInfo

  // Try native video tag
  const nativeInfo = extractNativeVideo(html)
  if (nativeInfo) return nativeInfo

  // Try video enclosure
  const enclosureInfo = extractVideoEnclosure(html)
  if (enclosureInfo) return enclosureInfo

  return null
}

/**
 * Extract YouTube video info
 */
function extractYouTube(html: string): VideoInfo | null {
  // Match YouTube iframe src
  const iframeMatch = html.match(
    /(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/i
  )
  if (iframeMatch?.[1]) {
    const videoId = iframeMatch[1]
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      platform: 'youtube',
      videoId,
    }
  }

  // Match YouTube watch URL in links
  const linkMatch = html.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  )
  if (linkMatch?.[1]) {
    const videoId = linkMatch[1]
    return {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      platform: 'youtube',
      videoId,
    }
  }

  return null
}

/**
 * Extract Vimeo video info
 */
function extractVimeo(html: string): VideoInfo | null {
  const match = html.match(/player\.vimeo\.com\/video\/(\d+)/i)
  if (match?.[1]) {
    const videoId = match[1]
    return {
      url: `https://vimeo.com/${videoId}`,
      thumbnail: null, // Vimeo requires API for thumbnails
      platform: 'vimeo',
      videoId,
    }
  }

  const linkMatch = html.match(/vimeo\.com\/(\d+)/i)
  if (linkMatch?.[1]) {
    const videoId = linkMatch[1]
    return {
      url: `https://vimeo.com/${videoId}`,
      thumbnail: null,
      platform: 'vimeo',
      videoId,
    }
  }

  return null
}

/**
 * Extract Bilibili video info
 */
function extractBilibili(html: string): VideoInfo | null {
  // Match Bilibili iframe
  const iframeMatch = html.match(/player\.bilibili\.com\/player\.html\?[^"']*bvid=([a-zA-Z0-9]+)/i)
  if (iframeMatch?.[1]) {
    const videoId = iframeMatch[1]
    return {
      url: `https://www.bilibili.com/video/${videoId}`,
      thumbnail: null,
      platform: 'bilibili',
      videoId,
    }
  }

  // Match Bilibili URL
  const linkMatch = html.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
  if (linkMatch?.[1]) {
    const videoId = linkMatch[1]
    return {
      url: `https://www.bilibili.com/video/${videoId}`,
      thumbnail: null,
      platform: 'bilibili',
      videoId,
    }
  }

  return null
}

/**
 * Extract native HTML5 video
 */
function extractNativeVideo(html: string): VideoInfo | null {
  const match = html.match(/<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+)["']/i)
  if (match?.[1]) {
    return {
      url: normalizeVideoUrl(match[1]) || match[1],
      thumbnail: extractVideoPoster(html),
      platform: 'native',
      videoId: null,
    }
  }

  const directMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i)
  if (directMatch?.[1]) {
    return {
      url: normalizeVideoUrl(directMatch[1]) || directMatch[1],
      thumbnail: extractVideoPoster(html),
      platform: 'native',
      videoId: null,
    }
  }

  return null
}

/**
 * Extract video poster attribute
 */
function extractVideoPoster(html: string): string | null {
  const match = html.match(/<video[^>]+poster=["']([^"']+)["']/i)
  if (match?.[1]) {
    return normalizeVideoUrl(match[1])
  }
  return null
}

/**
 * Extract video from enclosure tag
 */
function extractVideoEnclosure(html: string): VideoInfo | null {
  const match = html.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']video/i)
  if (match?.[1]) {
    return {
      url: normalizeVideoUrl(match[1]) || match[1],
      thumbnail: null,
      platform: 'native',
      videoId: null,
    }
  }

  // Also check media:content with video type
  const mediaMatch = html.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*(?:type=["']video|medium=["']video)/i)
  if (mediaMatch?.[1]) {
    // Try to get thumbnail from media:thumbnail
    const thumbMatch = html.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
    return {
      url: normalizeVideoUrl(mediaMatch[1]) || mediaMatch[1],
      thumbnail: thumbMatch?.[1] ? normalizeVideoUrl(thumbMatch[1]) : null,
      platform: 'native',
      videoId: null,
    }
  }

  return null
}

/**
 * Normalize video URL
 */
function normalizeVideoUrl(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  return null
}

/**
 * Extract video from an Entry object
 */
export function extractEntryVideo(entry: Entry): VideoInfo | null {
  const contentVideo = extractVideoInfo(entry.content)
  if (contentVideo) return contentVideo

  const readabilityVideo = extractVideoInfo(entry.readability_content)
  if (readabilityVideo) return readabilityVideo

  const summaryVideo = extractVideoInfo(entry.summary)
  if (summaryVideo) return summaryVideo

  return null
}

/**
 * Get platform display name
 */
export function getPlatformLabel(platform: VideoInfo['platform']): string {
  const labels: Record<VideoInfo['platform'], string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    bilibili: 'Bilibili',
    native: '视频',
    unknown: '视频',
  }
  return labels[platform]
}

/**
 * Get platform icon color
 */
export function getPlatformColor(platform: VideoInfo['platform']): string {
  const colors: Record<VideoInfo['platform'], string> = {
    youtube: '#FF0000',
    vimeo: '#1AB7EA',
    bilibili: '#00A1D6',
    native: '#FF7A18',
    unknown: '#666666',
  }
  return colors[platform]
}
