/** Row models for the on-device database (mirrors src/data/schema.ts). */

export interface FeedRow {
  id: string
  url: string
  title: string | null
  custom_title: string | null
  site_url: string | null
  description: string | null
  favicon_url: string | null
  group_name: string | null
  view_type: string | null
  last_checked_at: string | null
  last_error: string | null
  fetch_etag: string | null
  fetch_last_modified: string | null
  update_interval_minutes: number | null
  created_at: string
  updated_at: string
}

export interface EntryRow {
  id: string
  feed_id: string
  guid: string
  title: string | null
  url: string | null
  author: string | null
  summary: string | null
  content: string | null
  readability_content: string | null
  categories_json: string | null
  published_at: string | null
  inserted_at: string
  read: number
  starred: number
  enclosure_url: string | null
  enclosure_type: string | null
  enclosure_length: number | null
  duration: string | null
  image_url: string | null
  content_type: string | null
  content_extraction_status: string
  content_extracted_at: string | null
  content_source_url: string | null
}

/** Fields a normalizer produces for one entry (feed_id added at insert time). */
export type NormalizedEntry = Omit<
  EntryRow,
  'id' | 'feed_id' | 'inserted_at' | 'read' | 'starred' | 'content_extraction_status' | 'content_extracted_at' | 'content_type'
> & {
  content_type?: string | null
}

export interface FeedCreateInput {
  url: string
  title?: string | null
  site_url?: string | null
  description?: string | null
  favicon_url?: string | null
  group_name?: string | null
  view_type?: string | null
}
