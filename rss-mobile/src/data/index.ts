/**
 * Data layer entry point: open the database and bring it to the current
 * schema version. Call once during app startup.
 */
import { openDatabase, type Database } from '../platform/db'
import { runMigrations } from './migrations'

let ready: Promise<Database> | null = null

export async function initData(): Promise<Database> {
  if (!ready) {
    ready = (async () => {
      const db = await openDatabase()
      await runMigrations(db)
      return db
    })()
  }
  return ready
}
