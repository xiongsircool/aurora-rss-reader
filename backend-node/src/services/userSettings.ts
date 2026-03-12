/**
 * User settings service
 */

import { getDatabase } from '../db/session.js';
import { UserSettings } from '../db/models.js';

const FETCH_INTERVAL_MIN = 5;
const FETCH_INTERVAL_MAX = 1440;
const DEFAULT_FETCH_INTERVAL_MINUTES = 720;

export class InvalidUserSettingsUpdateError extends Error {
  invalidKeys: string[];

  constructor(invalidKeys: string[]) {
    super(`Invalid user settings fields: ${invalidKeys.join(', ')}`);
    this.name = 'InvalidUserSettingsUpdateError';
    this.invalidKeys = invalidKeys;
  }
}

type TableInfoRow = { name: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeSqlIdentifier(value: string): boolean {
  // Conservative: SQLite identifiers for columns in this project are snake_case.
  return /^[a-z_][a-z0-9_]*$/.test(value);
}

/**
 * Normalize fetch interval to valid range
 */
export function normalizeFetchInterval(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return DEFAULT_FETCH_INTERVAL_MINUTES;
  }
  if (value < FETCH_INTERVAL_MIN) {
    return FETCH_INTERVAL_MIN;
  }
  if (value > FETCH_INTERVAL_MAX) {
    return FETCH_INTERVAL_MAX;
  }
  return value;
}

export class UserSettingsService {
  private db = getDatabase();
  private updatableColumns: Set<string> | null = null;

  private getUpdatableColumns(): Set<string> {
    if (this.updatableColumns) {
      return this.updatableColumns;
    }
    const tableInfo = this.db.pragma('table_info(user_settings)') as TableInfoRow[];
    const columns = new Set(tableInfo.map((row) => row.name));
    columns.delete('id');
    columns.delete('created_at');
    columns.delete('updated_at');
    this.updatableColumns = columns;
    return columns;
  }

  /**
   * Get user settings, create default if not exists
   */
  getSettings(): UserSettings {
    let settings = this.db.prepare('SELECT * FROM user_settings WHERE id = 1').get() as UserSettings | undefined;

    if (!settings) {
      // Create default settings
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO user_settings (
          id, rsshub_url, fetch_interval_minutes, auto_refresh, show_description,
          items_per_page, show_entry_summary, open_original_mode, enable_date_filter,
          default_date_range, time_field, max_auto_title_translations, mark_as_read_range,
          details_panel_mode, summary_api_key, summary_base_url, summary_model_name,
          translation_api_key, translation_base_url, translation_model_name,
          ai_auto_summary, ai_auto_title_translation, ai_title_display_mode,
          ai_translation_language, summary_prompt_preference, translation_prompt_preference,
          outbound_proxy_mode, outbound_proxy_url, created_at, updated_at
        ) VALUES (
          1, 'https://rsshub.app', 720, 1, 1, 50, 1, 'system', 1, '30d', 'inserted_at',
          10, 'current', 'docked', '', 'https://open.bigmodel.cn/api/paas/v4/', 'glm-4-flash',
          '', 'https://open.bigmodel.cn/api/paas/v4/', 'glm-4-flash', 0, 0, 'original-first',
          'zh', '', '', 'system', '', ?, ?
        )
      `).run(now, now);

      settings = this.db.prepare('SELECT * FROM user_settings WHERE id = 1').get() as UserSettings;
    }

    // Normalize fetch interval
    const normalizedInterval = normalizeFetchInterval(settings.fetch_interval_minutes);
    if (settings.fetch_interval_minutes !== normalizedInterval) {
      this.db.prepare('UPDATE user_settings SET fetch_interval_minutes = ?, updated_at = ? WHERE id = 1')
        .run(normalizedInterval, new Date().toISOString());
      settings.fetch_interval_minutes = normalizedInterval;
    }

    return settings;
  }

  /**
   * Update user settings
   */
  updateSettings(updates: unknown): UserSettings {
    const settings = this.getSettings();
    const now = new Date().toISOString();

    if (!isPlainObject(updates)) {
      throw new Error('Invalid settings payload: expected an object');
    }

    // Build update query dynamically
    const allowedColumns = this.getUpdatableColumns();
    const updateFields: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    const invalidKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'id' || key === 'created_at' || key === 'updated_at') {
        invalidKeys.push(key);
        continue;
      }
      if (!isSafeSqlIdentifier(key) || !allowedColumns.has(key)) {
        invalidKeys.push(key);
        continue;
      }
      if (
        value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        invalidKeys.push(key);
        continue;
      }

      updateFields.push(`${key} = ?`);
      values.push(value);
    }

    if (invalidKeys.length > 0) {
      throw new InvalidUserSettingsUpdateError(invalidKeys);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      values.push(now);
      values.push(1); // WHERE id = 1

      const query = `UPDATE user_settings SET ${updateFields.join(', ')} WHERE id = ?`;
      this.db.prepare(query).run(...values);
    }

    return this.getSettings();
  }

  /**
   * Get configured RSSHub URL
   */
  getRSSHubUrl(): string {
    const settings = this.getSettings();
    return settings.rsshub_url.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Update RSSHub URL
   */
  updateRSSHubUrl(url: string): UserSettings {
    // Ensure URL format is correct
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    return this.updateSettings({ rsshub_url: url });
  }
}

// Global instance
export const userSettingsService = new UserSettingsService();
