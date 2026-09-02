/**
 * Schema migration runner.
 *
 * Applies the base schema and tracks the applied version in a small
 * `schema_meta` table. Idempotent: running it on every launch is safe.
 */
import type { Database } from '../platform/db'
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from './schema'

async function getAppliedVersion(db: Database): Promise<number> {
  await db.run(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT)`)
  const rows = await db.query<{ value: string }>(`SELECT value FROM schema_meta WHERE key = 'version'`)
  return rows.length ? Number(rows[0].value) || 0 : 0
}

async function setAppliedVersion(db: Database, version: number): Promise<void> {
  await db.run(
    `INSERT INTO schema_meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)],
  )
}

/**
 * Ensure the database is at the current schema version. Creates all tables on
 * first run; future versions append migration steps keyed by version number.
 */
export async function runMigrations(db: Database): Promise<void> {
  const applied = await getAppliedVersion(db)

  // v1: base schema. Always safe to re-run thanks to IF NOT EXISTS.
  await db.execute(SCHEMA_STATEMENTS)

  // Future migrations go here, e.g.:
  //   if (applied < 2) { await db.execute([...]) }

  if (applied !== SCHEMA_VERSION) {
    await setAppliedVersion(db, SCHEMA_VERSION)
  }
}
