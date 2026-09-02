export type EntryContentType = 'article' | 'image' | 'gallery' | 'video' | 'audio'
export type InboxFilter = 'all' | 'unread' | 'saved'

export interface EntryVideo {
  url: string
  platform: 'youtube' | 'vimeo' | 'bilibili' | 'native' | 'unknown'
  thumbnail_url: string | null
  duration: string | null
  embed_url: string | null
}

export interface EntryMediaImage {
  url: string
  alt: string | null
  caption: string | null
  width: number | null
  height: number | null
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

export interface InboxEntry {
  id: string
  feed_id: string
  feed_title: string | null
  feed_group_name: string | null
  feed_favicon_url: string | null
  title: string | null
  url: string | null
  author: string | null
  preview_text: string | null
  published_at: string | null
  inserted_at: string | null
  read: boolean
  starred: boolean
  content_type: EntryContentType
  lead_image_url: string | null
  image_count: number
  video: Pick<EntryVideo, 'thumbnail_url' | 'duration' | 'platform'> | null
  reading_time_minutes: number | null
  extraction_status: string
}

export interface InboxPage {
  items: InboxEntry[]
  next_cursor: string | null
  has_more: boolean
}

export interface ReaderEntry {
  id: string
  feed_id: string
  feed_title: string | null
  feed_group_name: string | null
  feed_favicon_url: string | null
  title: string | null
  url: string | null
  author: string | null
  summary: string | null
  content: string | null
  readability_content: string | null
  published_at: string | null
  inserted_at: string | null
  read: boolean
  starred: boolean
  ai_summary: string | null
  presentation: EntryPresentation
}

export interface SourceItem {
  id: string
  url: string
  title: string | null
  group_name: string
  favicon_url: string | null
  view_type: string
  unread_count: number
  last_checked_at: string | null
  last_error: string | null
  enabled: boolean
  source_label: string
}

export interface SourceGroup {
  name: string
  count: number
  unread_count: number
}

export interface SourcesResponse {
  items: SourceItem[]
  groups: SourceGroup[]
}
