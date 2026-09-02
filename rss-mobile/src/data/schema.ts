/**
 * On-device SQLite schema for the standalone mobile app.
 *
 * Trimmed from `backend-node/src/db/init.ts`. We keep only what the mobile
 * product needs: feeds, entries, cached AI summaries/translations, user
 * settings, and tags. Server-only concepts are intentionally dropped:
 * FTS5/vss vector search, job queues, scope/aggregate digests, and
 * ai_automation rules.
 *
 * Each statement is idempotent (IF NOT EXISTS) so init can run on every launch.
 */

export const SCHEMA_VERSION = 1

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    custom_title TEXT,
    site_url TEXT,
    description TEXT,
    favicon_url TEXT,
    group_name TEXT DEFAULT 'default',
    view_type TEXT DEFAULT 'articles',
    last_checked_at TEXT,
    last_error TEXT,
    fetch_etag TEXT,
    fetch_last_modified TEXT,
    update_interval_minutes INTEGER DEFAULT 60,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    guid TEXT NOT NULL,
    title TEXT,
    url TEXT,
    author TEXT,
    summary TEXT,
    content TEXT,
    readability_content TEXT,
    categories_json TEXT,
    published_at TEXT,
    inserted_at TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    starred INTEGER NOT NULL DEFAULT 0,
    enclosure_url TEXT,
    enclosure_type TEXT,
    enclosure_length INTEGER,
    duration TEXT,
    image_url TEXT,
    content_type TEXT,
    content_extraction_status TEXT NOT NULL DEFAULT 'skipped',
    content_extracted_at TEXT,
    content_source_url TEXT,
    FOREIGN KEY (feed_id) REFERENCES feeds(id),
    UNIQUE(feed_id, guid)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_entries_feed ON entries(feed_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_published ON entries(published_at DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_read ON entries(read)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_starred ON entries(starred)`,

  `CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES entries(id),
    UNIQUE(entry_id, language)
  )`,

  `CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    language TEXT NOT NULL,
    title TEXT,
    content TEXT,
    model TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES entries(id),
    UNIQUE(entry_id, language)
  )`,

  `CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS user_tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS entry_tags (
    entry_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (entry_id, tag_id),
    FOREIGN KEY (entry_id) REFERENCES entries(id),
    FOREIGN KEY (tag_id) REFERENCES user_tags(id)
  )`,
]
