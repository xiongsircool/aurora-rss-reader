import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

test('legacy databases rebuild FTS index before update triggers run', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-fts-migration-'));
  const dbPath = join(tempDir, 'legacy.db');
  process.env.DATABASE_PATH = dbPath;

  const legacyDb = new Database(dbPath);
  legacyDb.exec(`
    CREATE TABLE feeds (
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
      fetch_etag TEXT,
      fetch_last_modified TEXT,
      last_fetch_url TEXT,
      update_interval_minutes INTEGER DEFAULT 60,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE entries (
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
      enclosure_url TEXT,
      enclosure_type TEXT,
      enclosure_length INTEGER,
      duration TEXT,
      image_url TEXT,
      doi TEXT,
      pmid TEXT,
      content_extraction_status TEXT NOT NULL DEFAULT 'skipped',
      content_extraction_error TEXT,
      content_extracted_at TEXT,
      content_source_url TEXT,
      UNIQUE(feed_id, guid)
    );

    CREATE TABLE user_settings (
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
      timeline_filter_density TEXT NOT NULL DEFAULT 'compact',
      default_ai_provider TEXT NOT NULL DEFAULT '',
      default_ai_api_key TEXT NOT NULL DEFAULT '',
      default_ai_base_url TEXT NOT NULL DEFAULT '',
      default_ai_model TEXT NOT NULL DEFAULT '',
      summary_use_custom INTEGER NOT NULL DEFAULT 0,
      translation_use_custom INTEGER NOT NULL DEFAULT 0,
      tagging_use_custom INTEGER NOT NULL DEFAULT 0,
      embedding_use_custom INTEGER NOT NULL DEFAULT 0,
      summary_api_key TEXT NOT NULL DEFAULT '',
      summary_base_url TEXT NOT NULL DEFAULT '',
      summary_model_name TEXT NOT NULL DEFAULT '',
      translation_api_key TEXT NOT NULL DEFAULT '',
      translation_base_url TEXT NOT NULL DEFAULT '',
      translation_model_name TEXT NOT NULL DEFAULT '',
      ai_auto_summary INTEGER NOT NULL DEFAULT 0,
      ai_auto_title_translation INTEGER NOT NULL DEFAULT 0,
      ai_title_display_mode TEXT NOT NULL DEFAULT 'original-first',
      ai_translation_language TEXT NOT NULL DEFAULT 'zh',
      language TEXT NOT NULL DEFAULT 'zh',
      outbound_proxy_mode TEXT NOT NULL DEFAULT 'system',
      outbound_proxy_url TEXT NOT NULL DEFAULT '',
      embedding_model TEXT NOT NULL DEFAULT 'netease-youdao/bce-embedding-base_v1',
      embedding_api_key TEXT NOT NULL DEFAULT '',
      embedding_base_url TEXT NOT NULL DEFAULT 'https://api.siliconflow.cn/v1',
      tagging_api_key TEXT NOT NULL DEFAULT '',
      tagging_base_url TEXT NOT NULL DEFAULT '',
      tagging_model_name TEXT NOT NULL DEFAULT '',
      ai_auto_tagging INTEGER NOT NULL DEFAULT 0,
      ai_auto_tagging_start_at TEXT,
      tags_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (id = 1)
    );

    INSERT INTO user_settings (id, created_at, updated_at) VALUES (1, datetime('now'), datetime('now'));
    INSERT INTO feeds (id, url, title, created_at, updated_at) VALUES ('feed-1', 'https://example.com/feed.xml', 'Feed', datetime('now'), datetime('now'));
    INSERT INTO entries (id, feed_id, guid, title, content, inserted_at) VALUES ('entry-1', 'feed-1', 'guid-1', 'Legacy title', 'legacy content body', datetime('now'));
  `);
  legacyDb.close();

  const { initDatabase } = await import('../src/db/init.js');
  const { closeDatabase } = await import('../src/db/session.js');
  const { EntryRepository } = await import('../src/db/repositories/index.js');

  try {
    initDatabase();

    const updated = new EntryRepository().update('entry-1', { starred: true });
    assert.ok(updated);
    assert.equal(updated?.starred, 1);
  } finally {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
