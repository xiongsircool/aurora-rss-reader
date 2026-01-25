export interface Feed {
  id: string
  url: string
  title: string | null
  group_name: string
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
