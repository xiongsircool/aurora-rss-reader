import { randomBytes } from 'crypto';

export function generateId(): string {
  return randomBytes(16).toString('hex');
}

export interface Feed {
  id: string;
  url: string;
  title: string | null;
  site_url: string | null;
  description: string | null;
  favicon_url: string | null;
  group_name: string;
  last_checked_at: string | null;
  last_error: string | null;
  update_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  feed_id: string;
  guid: string;
  title: string | null;
  url: string | null;
  title_translations: string | null; // JSON string
  author: string | null;
  summary: string | null;
  content: string | null;
  readability_content: string | null;
  categories_json: string | null;
  published_at: string | null;
  inserted_at: string;
  read: number; // SQLite boolean (0/1)
  starred: number; // SQLite boolean (0/1)
}

export interface Translation {
  id: string;
  entry_id: string;
  language: string;
  title: string | null;
  summary: string | null;
  content: string | null;
  paragraph_map: string | null; // JSON string
  created_at: string;
}

export interface Summary {
  id: string;
  entry_id: string;
  language: string;
  summary: string | null;
  created_at: string;
}

export interface FetchLog {
  id: string;
  feed_id: string | null;
  status: string;
  message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  item_count: number;
}

export interface UserSettings {
  id: number; // Always 1 (singleton)
  rsshub_url: string;
  fetch_interval_minutes: number;
  auto_refresh: number; // SQLite boolean (0/1)
  show_description: number; // SQLite boolean (0/1)
  items_per_page: number;
  show_entry_summary: number; // SQLite boolean (0/1)
  open_original_mode: string; // 'system' | 'window'
  enable_date_filter: number; // SQLite boolean (0/1)
  default_date_range: string;
  time_field: string; // 'published_at' | 'inserted_at'
  max_auto_title_translations: number;
  mark_as_read_range: string;
  details_panel_mode: string; // 'docked' | 'click'
  summary_api_key: string;
  summary_base_url: string;
  summary_model_name: string;
  translation_api_key: string;
  translation_base_url: string;
  translation_model_name: string;
  ai_auto_summary: number; // SQLite boolean (0/1)
  ai_auto_title_translation: number; // SQLite boolean (0/1)
  ai_title_display_mode: string;
  ai_translation_language: string;
  language: string; // 'zh' | 'en' | 'ja' | 'ko'
  created_at: string;
  updated_at: string;
}
