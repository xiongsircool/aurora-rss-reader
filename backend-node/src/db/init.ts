import { getDatabase } from './session.js';

/**
 * Run database migrations
 */
function runMigrations(): void {
  const db = getDatabase();

  // Check if language column exists in user_settings
  const tableInfo = db.pragma('table_info(user_settings)');
  const hasLanguageColumn = tableInfo.some((col: any) => col.name === 'language');

  if (!hasLanguageColumn) {
    console.log('Running migration: Adding language column to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN language TEXT NOT NULL DEFAULT 'zh'`);
    console.log('Migration completed: language column added');
  }

  // Check if embedding columns exist
  const hasEmbeddingModel = tableInfo.some((col: any) => col.name === 'embedding_model');

  if (!hasEmbeddingModel) {
    console.log('Running migration: Adding embedding columns to user_settings');
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'netease-youdao/bce-embedding-base_v1'`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_api_key TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN embedding_base_url TEXT NOT NULL DEFAULT 'https://api.siliconflow.cn/v1'`);
    console.log('Migration completed: embedding columns added');
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
      site_url TEXT,
      description TEXT,
      favicon_url TEXT,
      group_name TEXT DEFAULT 'default',
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (id = 1)
    )
  `);

  // Run migrations for existing databases
  runMigrations();
}
