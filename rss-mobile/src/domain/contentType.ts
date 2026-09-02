/**
 * Lightweight content-type hint computed at ingest time from cheap signals
 * (enclosure type, presence of an image). The authoritative classification is
 * done by entryPresentation when the entry is opened; this is just enough to
 * render the right inbox row affordance without re-parsing HTML on every list.
 */
import type { NormalizedEntry } from '../data/models'

export type EntryContentType = 'article' | 'image' | 'gallery' | 'video' | 'audio'

const VIDEO_EXT = /\.(mp4|webm|m4v|mov|m3u8)(\?|#|$)/i
const VIDEO_HOST = /(youtube\.com|youtu\.be|vimeo\.com|bilibili\.com)/i

export function classifyParsedEntry(entry: NormalizedEntry): EntryContentType {
  const enclosureType = (entry.enclosure_type ?? '').toLowerCase()
  const enclosureUrl = entry.enclosure_url ?? ''

  if (enclosureType.startsWith('audio/')) return 'audio'
  if (enclosureType.startsWith('video/') || VIDEO_EXT.test(enclosureUrl)) return 'video'

  const html = `${entry.content ?? ''} ${entry.summary ?? ''}`
  if (VIDEO_HOST.test(html) || VIDEO_HOST.test(entry.url ?? '')) return 'video'

  if (entry.image_url) return 'image'
  return 'article'
}
