import { getDatabase } from './session.js';
import * as sqliteVss from 'sqlite-vss';

/**
 * Load sqlite-vss extension
 */
function loadVssExtension(): void {
  const db = getDatabase();

  try {
    // Load sqlite-vss extension using the official package loader
    // This will automatically find the correct platform-specific binary
    sqliteVss.load(db);
    console.log('✅ sqlite-vss extension loaded successfully');
  } catch (error) {
    console.warn('⚠️  sqlite-vss extension not loaded:', error);
    console.warn('Vector search functionality will not be available');
  }
}

/**
 * Run database migrations
 */
function runMigrations(): void {
  const db = getDatabase();

  // Check if language column exists in user_settings
  let tableInfo = db.pragma('table_info(user_settings)') as Array<{ name: string }>;
  const hasLanguageColumn = tableInfo.some((col) => col.name === 'language');

  if (!hasLanguageColumn) {
    console.log('Running migration: Adding language column to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN language TEXT NOT NULL DEFAULT 'zh'`);
    console.log('Migration completed: language column added');
  }

  // Check if embedding columns exist
  const hasEmbeddingModel = tableInfo.some((col) => col.name === 'embedding_model');

  if (!hasEmbeddingModel) {
    console.log('Running migration: Adding embedding columns to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'netease-youdao/bce-embedding-base_v1'`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_api_key TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_base_url TEXT NOT NULL DEFAULT 'https://api.siliconflow.cn/v1'`);
    console.log('Migration completed: embedding columns added');
  }

  // Check if view_type column exists in feeds
  const feedsTableInfo = db.pragma('table_info(feeds)') as Array<{ name: string }>;
  const hasViewType = feedsTableInfo.some((col) => col.name === 'view_type');

  if (!hasViewType) {
    console.log('Running migration: Adding view_type column to feeds');
    db.exec(`ALTER TABLE feeds ADD COLUMN view_type TEXT NOT NULL DEFAULT 'articles'`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_feeds_view_type ON feeds(view_type)`);
    console.log('Migration completed: view_type column added');
  }

  // Check if enclosure columns exist in entries (for audio/video support)
  const entriesTableInfo = db.pragma('table_info(entries)') as Array<{ name: string }>;
  const hasEnclosureUrl = entriesTableInfo.some((col) => col.name === 'enclosure_url');

  if (!hasEnclosureUrl) {
    console.log('Running migration: Adding enclosure columns to entries');
    db.exec(`ALTER TABLE entries ADD COLUMN enclosure_url TEXT`);
    db.exec(`ALTER TABLE entries ADD COLUMN enclosure_type TEXT`);
    db.exec(`ALTER TABLE entries ADD COLUMN enclosure_length INTEGER`);
    db.exec(`ALTER TABLE entries ADD COLUMN duration TEXT`);
    db.exec(`ALTER TABLE entries ADD COLUMN image_url TEXT`);
    console.log('Migration completed: enclosure columns added');
  }

  // Check if DOI/PMID columns exist in entries (for academic article support)
  const hasDoi = entriesTableInfo.some((col) => col.name === 'doi');
  if (!hasDoi) {
    console.log('Running migration: Adding DOI/PMID columns to entries');
    db.exec(`ALTER TABLE entries ADD COLUMN doi TEXT`);
    db.exec(`ALTER TABLE entries ADD COLUMN pmid TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_entries_doi ON entries(doi)`);
    console.log('Migration completed: DOI/PMID columns added');
  }

  // Check if custom_title column exists in feeds (for feed alias support)
  const hasCustomTitle = feedsTableInfo.some((col) => col.name === 'custom_title');
  if (!hasCustomTitle) {
    console.log('Running migration: Adding custom_title column to feeds');
    db.exec(`ALTER TABLE feeds ADD COLUMN custom_title TEXT`);
    console.log('Migration completed: custom_title column added');
  }

  // Check if ai_tagging_enabled column exists in feeds (for per-feed smart tagging control)
  const hasAiTaggingEnabled = feedsTableInfo.some((col) => col.name === 'ai_tagging_enabled');
  if (!hasAiTaggingEnabled) {
    console.log('Running migration: Adding ai_tagging_enabled column to feeds');
    db.exec(`ALTER TABLE feeds ADD COLUMN ai_tagging_enabled INTEGER NOT NULL DEFAULT 1`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_feeds_ai_tagging_enabled ON feeds(ai_tagging_enabled)`);
    console.log('Migration completed: ai_tagging_enabled column added');
  }

  // Check if tagging columns exist in user_settings (for smart tagging feature)
  const hasTaggingApiKey = tableInfo.some((col) => col.name === 'tagging_api_key');
  if (!hasTaggingApiKey) {
    console.log('Running migration: Adding tagging columns to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN tagging_api_key TEXT DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN tagging_base_url TEXT DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN tagging_model_name TEXT DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN ai_auto_tagging INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN ai_auto_tagging_start_at TEXT`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN tags_version INTEGER DEFAULT 1`);
    console.log('Migration completed: tagging columns added');
  }

  // Refresh after possible ALTER TABLE changes above.
  tableInfo = db.pragma('table_info(user_settings)') as Array<{ name: string }>;

  // Add ai_auto_tagging_start_at for databases that already have tagging columns
  const hasAutoTaggingStartAt = tableInfo.some((col) => col.name === 'ai_auto_tagging_start_at');
  if (!hasAutoTaggingStartAt) {
    console.log('Running migration: Adding ai_auto_tagging_start_at column to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN ai_auto_tagging_start_at TEXT`);
    console.log('Migration completed: ai_auto_tagging_start_at column added');
  }

  // Check if ai_prompt_preference column exists in user_settings
  const hasAiPromptPreference = tableInfo.some((col) => col.name === 'ai_prompt_preference');
  if (!hasAiPromptPreference) {
    console.log('Running migration: Adding ai_prompt_preference column to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN ai_prompt_preference TEXT DEFAULT ''`);
    console.log('Migration completed: ai_prompt_preference column added');
  }
}


export function initDatabase(): void {
  const db = getDatabase();

  // Create feeds table
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      custom_title TEXT,
      site_url TEXT,
      description TEXT,
      favicon_url TEXT,
      group_name TEXT DEFAULT 'default',
      view_type TEXT DEFAULT 'articles',
      ai_tagging_enabled INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      last_error TEXT,
      update_interval_minutes INTEGER DEFAULT 60,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(url)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feeds_group_name ON feeds(group_name)`);

  // Create entries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL,
      guid TEXT NOT NULL,
      title TEXT,
      url TEXT,
      title_translations TEXT,
      author TEXT,
      summary TEXT,
      content TEXT,
      readability_content TEXT,
      categories_json TEXT,
      published_at TEXT,
      inserted_at TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0,
      FOREIGN KEY (feed_id) REFERENCES feeds(id),
      UNIQUE(feed_id, guid)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entries_read ON entries(read)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entries_starred ON entries(starred)`);

  // Create translations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      language TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      content TEXT,
      paragraph_map TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      UNIQUE(entry_id, language)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_translations_entry_id ON translations(entry_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language)`);

  // Create summaries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      language TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      UNIQUE(entry_id, language)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_summaries_entry_id ON summaries(entry_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_summaries_language ON summaries(language)`);

  // Create fetch_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS fetch_logs (
      id TEXT PRIMARY KEY,
      feed_id TEXT,
      status TEXT DEFAULT 'pending',
      message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      item_count INTEGER DEFAULT 0,
      FOREIGN KEY (feed_id) REFERENCES feeds(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_fetch_logs_feed_id ON fetch_logs(feed_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fetch_logs_status ON fetch_logs(status)`);

  // Create user_settings table (singleton with id=1)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      rsshub_url TEXT NOT NULL DEFAULT 'https://rsshub.app',
      fetch_interval_minutes INTEGER NOT NULL DEFAULT 720,
      auto_refresh INTEGER NOT NULL DEFAULT 1,
      show_description INTEGER NOT NULL DEFAULT 1,
      items_per_page INTEGER NOT NULL DEFAULT 50,
      show_entry_summary INTEGER NOT NULL DEFAULT 1,
      open_original_mode TEXT NOT NULL DEFAULT 'system',
      enable_date_filter INTEGER NOT NULL DEFAULT 1,
      default_date_range TEXT NOT NULL DEFAULT '30d',
      time_field TEXT NOT NULL DEFAULT 'inserted_at',
      max_auto_title_translations INTEGER NOT NULL DEFAULT 10,
      mark_as_read_range TEXT NOT NULL DEFAULT 'current',
      details_panel_mode TEXT NOT NULL DEFAULT 'docked',
      summary_api_key TEXT NOT NULL DEFAULT '',
      summary_base_url TEXT NOT NULL DEFAULT 'https://open.bigmodel.cn/api/paas/v4/',
      summary_model_name TEXT NOT NULL DEFAULT 'glm-4-flash',
      translation_api_key TEXT NOT NULL DEFAULT '',
      translation_base_url TEXT NOT NULL DEFAULT 'https://open.bigmodel.cn/api/paas/v4/',
      translation_model_name TEXT NOT NULL DEFAULT 'glm-4-flash',
      ai_auto_summary INTEGER NOT NULL DEFAULT 0,
      ai_auto_title_translation INTEGER NOT NULL DEFAULT 0,
      ai_title_display_mode TEXT NOT NULL DEFAULT 'original-first',
      ai_translation_language TEXT NOT NULL DEFAULT 'zh',
      language TEXT NOT NULL DEFAULT 'zh',
      embedding_model TEXT NOT NULL DEFAULT 'netease-youdao/bce-embedding-base_v1',
      embedding_api_key TEXT NOT NULL DEFAULT '',
      embedding_base_url TEXT NOT NULL DEFAULT 'https://api.siliconflow.cn/v1',
      tagging_api_key TEXT NOT NULL DEFAULT '',
      tagging_base_url TEXT NOT NULL DEFAULT '',
      tagging_model_name TEXT NOT NULL DEFAULT '',
      ai_auto_tagging INTEGER NOT NULL DEFAULT 0,
      ai_auto_tagging_start_at TEXT,
      tags_version INTEGER NOT NULL DEFAULT 1,
      ai_prompt_preference TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (id = 1)
    )
  `);

  // Create collections table (for multi-folder system)
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      color TEXT DEFAULT '#ff7a18',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order)`);

  // Create collection_entries table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_entries (
      collection_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      note TEXT,
      PRIMARY KEY (collection_id, entry_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_entries_collection ON collection_entries(collection_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_entries_entry ON collection_entries(entry_id)`);

  // Create user_tags table (user-defined tags for smart tagging)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_tags_name ON user_tags(name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_tags_enabled ON user_tags(enabled)`);

  // Create entry_tags table (entry-tag relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      is_manual INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag_id),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id)`);

  // Create entry_analysis_status table (tracking AI analysis status)
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_analysis_status (
      entry_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      analyzed_at TEXT,
      tags_version INTEGER DEFAULT 0,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_entry_analysis_status_status ON entry_analysis_status(status)`);

  // Run migrations for existing databases
  runMigrations();


  // Load sqlite-vss extension and create vector tables
  loadVssExtension();
  createVectorTables();
}

/**
 * Create vector search tables
 */
function createVectorTables(): void {
  const db = getDatabase();

  try {
    // Create rss_vectors table to store metadata
    db.exec(`
      CREATE TABLE IF NOT EXISTS rss_vectors (
        entry_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        feed_id TEXT NOT NULL,
        published_at TEXT,
        url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (entry_id) REFERENCES entries(id)
      )
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_rss_vectors_entry_id ON rss_vectors(entry_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_rss_vectors_feed_id ON rss_vectors(feed_id)`);

    // Create virtual table for vector search using sqlite-vss
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vss_rss_vectors USING vss0(
        embedding(1536)
      )
    `);

    console.log('✅ Vector tables created');
  } catch (error) {
    console.warn('⚠️  Could not create vector tables:', error);
  }
}
