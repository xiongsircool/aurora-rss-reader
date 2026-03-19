import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

test('user settings migration fills missing scope summary columns for partial legacy schemas', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-rss-settings-migration-'));
  const dbPath = join(tempDir, 'legacy.db');
  process.env.DATABASE_PATH = dbPath;

  const legacyDb = new Database(dbPath);
  legacyDb.exec(`
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
      language TEXT NOT NULL DEFAULT 'zh',
      summary_api_key TEXT NOT NULL DEFAULT '',
      summary_base_url TEXT NOT NULL DEFAULT '',
      summary_model_name TEXT NOT NULL DEFAULT '',
      translation_api_key TEXT NOT NULL DEFAULT '',
      translation_base_url TEXT NOT NULL DEFAULT '',
      translation_model_name TEXT NOT NULL DEFAULT '',
      ai_auto_summary INTEGER NOT NULL DEFAULT 0,
      ai_auto_title_translation INTEGER NOT NULL DEFAULT 0,
      ai_title_display_mode TEXT NOT NULL DEFAULT 'original-first',
      embedding_model TEXT NOT NULL DEFAULT 'netease-youdao/bce-embedding-base_v1',
      embedding_api_key TEXT NOT NULL DEFAULT '',
      embedding_base_url TEXT NOT NULL DEFAULT 'https://api.siliconflow.cn/v1',
      tagging_api_key TEXT NOT NULL DEFAULT '',
      tagging_base_url TEXT NOT NULL DEFAULT '',
      tagging_model_name TEXT NOT NULL DEFAULT '',
      ai_auto_tagging INTEGER NOT NULL DEFAULT 0,
      tags_version INTEGER NOT NULL DEFAULT 1,
      summary_prompt_preference TEXT NOT NULL DEFAULT '',
      translation_prompt_preference TEXT NOT NULL DEFAULT '',
      outbound_proxy_mode TEXT NOT NULL DEFAULT 'system',
      outbound_proxy_url TEXT NOT NULL DEFAULT '',
      scope_summary_enabled INTEGER NOT NULL DEFAULT 1,
      scope_summary_auto_generate INTEGER NOT NULL DEFAULT 1,
      scope_summary_auto_interval_minutes INTEGER NOT NULL DEFAULT 60,
      scope_summary_default_window TEXT NOT NULL DEFAULT '24h',
      scope_summary_max_entries INTEGER NOT NULL DEFAULT 100,
      scope_summary_chunk_size INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (id = 1)
    );

    INSERT INTO user_settings (id, created_at, updated_at) VALUES (1, datetime('now'), datetime('now'));
  `);
  legacyDb.close();

  const { initDatabase } = await import('../src/db/init.js');
  const { closeDatabase } = await import('../src/db/session.js');
  const { userSettingsService } = await import('../src/services/userSettings.js');

  try {
    initDatabase();

    const updated = userSettingsService.updateSettings({
      scope_summary_model_name: 'test-model',
      scope_summary_use_custom: true,
      scope_summary_base_url: 'https://example.com/v1',
      scope_summary_api_key: 'secret',
    });

    assert.equal(updated.scope_summary_model_name, 'test-model');
    assert.equal(updated.scope_summary_use_custom, 1);
    assert.equal(updated.scope_summary_base_url, 'https://example.com/v1');
    assert.equal(updated.scope_summary_api_key, 'secret');
  } finally {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
