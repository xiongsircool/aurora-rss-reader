import { randomBytes } from 'crypto';

export function generateId(): string {
  return randomBytes(16).toString('hex');
}

// View type for feed classification (similar to Folo)
export type ViewType = 'articles' | 'social' | 'pictures' | 'videos' | 'audio' | 'notifications';

export const VIEW_TYPES: ViewType[] = ['articles', 'social', 'pictures', 'videos', 'audio', 'notifications'];

export interface Feed {
  id: string;
  url: string;
  title: string | null;
  custom_title: string | null; // User-defined alias for the feed
  site_url: string | null;
  description: string | null;
  favicon_url: string | null;
  group_name: string;
  view_type: ViewType;
  ai_tagging_enabled: number; // SQLite boolean (0/1)
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
  // Enclosure fields for audio/video
  enclosure_url: string | null;
  enclosure_type: string | null;
  enclosure_length: number | null;
  duration: string | null;
  image_url: string | null;
  // Academic article identifiers
  doi: string | null;
  pmid: string | null;
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
  // Global default AI configuration
  default_ai_provider: string; // Provider preset ID (e.g. 'openai', 'deepseek', 'gemini')
  default_ai_api_key: string;
  default_ai_base_url: string;
  default_ai_model: string;
  // Per-service custom override flags (0=use global, 1=use custom)
  summary_use_custom: number;
  translation_use_custom: number;
  tagging_use_custom: number;
  embedding_use_custom: number;
  // Per-service custom configurations (used when *_use_custom = 1)
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
  ai_prompt_preference: string; // User custom preference for AI prompts
  language: string; // 'zh' | 'en' | 'ja' | 'ko'
  embedding_model: string;
  embedding_api_key: string;
  embedding_base_url: string;
  // Smart tagging settings
  tagging_api_key: string;
  tagging_base_url: string;
  tagging_model_name: string;
  ai_auto_tagging: number; // SQLite boolean (0/1)
  ai_auto_tagging_start_at: string | null;
  tags_version: number;
  created_at: string;
  updated_at: string;
}


// Collection (multi-folder system)
export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Collection-Entry relationship
export interface CollectionEntry {
  collection_id: string;
  entry_id: string;
  added_at: string;
  note: string | null;
}

// Rule matching condition for tag-based filtering
export interface TagMatchRule {
  keywords: string[];       // e.g. ["AI", "LLM"]
  operator: 'AND' | 'OR';  // relationship between keywords in this group
  exclude: string[];        // NOT keywords
}

// User-defined tag for smart tagging
export interface UserTag {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  enabled: number; // SQLite boolean (0/1)
  match_mode: 'ai' | 'rule' | 'both'; // matching strategy
  match_rules: string | null; // JSON: TagMatchRule[]
  created_at: string;
  updated_at: string;
}

// Entry-Tag relationship
export interface EntryTag {
  entry_id: string;
  tag_id: string;
  is_manual: number; // SQLite boolean (0/1) - whether manually added
  created_at: string;
}

// Entry analysis status for tracking AI tagging
export interface EntryAnalysisStatus {
  entry_id: string;
  status: 'pending' | 'analyzed' | 'skipped';
  analyzed_at: string | null;
  tags_version: number;
}

// Analysis status type enum
export const ANALYSIS_STATUS = {
  PENDING: 'pending',
  ANALYZED: 'analyzed',
  SKIPPED: 'skipped',
} as const;
