export type ViewType = 'articles' | 'social' | 'pictures' | 'videos' | 'audio' | 'notifications'

export const VIEW_TYPES: ViewType[] = ['articles', 'social', 'pictures', 'videos', 'audio', 'notifications']

export const VIEW_TYPE_ICONS: Record<ViewType, string> = {
  articles: '📄',
  social: '💬',
  pictures: '🖼️',
  videos: '🎬',
  audio: '🎧',
  notifications: '🔔',
}

export const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  articles: 'Articles',
  social: 'Social',
  pictures: 'Pictures',
  videos: 'Videos',
  audio: 'Audio',
  notifications: 'Notifications',
}

export interface Feed {
  id: string
  url: string
  title: string | null
  custom_title: string | null
  group_name: string
  view_type: ViewType
  ai_tagging_enabled?: number
  favicon_url: string | null
  unread_count: number
  last_checked_at: string | null
  last_error: string | null
}

export interface Entry {
  id: string
  feed_id: string
  feed_title: string | null
  title: string | null
  url: string | null
  author: string | null
  summary: string | null
  content: string | null
  readability_content?: string | null
  published_at: string | null
  inserted_at: string | null
  read: boolean
  starred: boolean
  translated_title?: string | null
  translated_summary?: string | null
  // Enclosure fields for audio/video
  enclosure_url?: string | null
  enclosure_type?: string | null
  enclosure_length?: number | null
  duration?: string | null
  image_url?: string | null
  // Academic article identifiers
  doi?: string | null
  pmid?: string | null
}

export interface EntryPage {
  items: Entry[]
  next_cursor: string | null
  has_more: boolean
}

export interface SummaryResult {
  entry_id: string
  language: string
  summary: string
}
