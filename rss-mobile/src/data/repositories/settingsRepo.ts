import type { Database } from '../../platform/db'

/** Key/value settings store backed by the user_settings table. */
export class SettingsRepository {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async get(key: string): Promise<string | null> {
    const rows = await this.db.query<{ value: string | null }>(`SELECT value FROM user_settings WHERE key = ?`, [key])
    return rows[0]?.value ?? null
  }

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.get(key)
    if (raw == null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.run(
      `INSERT INTO user_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    )
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value))
  }

  async all(): Promise<Record<string, string>> {
    const rows = await this.db.query<{ key: string; value: string | null }>(`SELECT key, value FROM user_settings`)
    const out: Record<string, string> = {}
    for (const r of rows) if (r.value != null) out[r.key] = r.value
    return out
  }
}
