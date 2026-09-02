/**
 * Platform database layer.
 *
 * Wraps @capacitor-community/sqlite so the rest of the app can run plain SQL
 * through a single small interface, regardless of whether we're on a native
 * device (real SQLite) or the web (jeep-sqlite / wasm).
 *
 * The web path requires the <jeep-sqlite> custom element + a wasm store to be
 * initialized once before opening a connection; `initWebStore()` handles that.
 */
import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'aurora_mobile'

export interface Database {
  /** Run a statement that doesn't return rows (CREATE/INSERT/UPDATE/DELETE). */
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastId?: number }>
  /** Run a SELECT and return rows as plain objects. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** Run multiple statements in one transaction. */
  execute(statements: string[]): Promise<void>
}

let connection: SQLiteConnection | null = null
let db: SQLiteDBConnection | null = null
let webStoreReady = false

function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web'
}

/**
 * On web, jeep-sqlite needs its custom element defined and a wasm-backed store
 * initialized before any connection is opened. No-op on native.
 */
async function initWebStore(sqlite: SQLiteConnection): Promise<void> {
  if (!isWeb() || webStoreReady) return
  const { defineCustomElements } = await import('jeep-sqlite/loader')
  defineCustomElements(window)
  if (!document.querySelector('jeep-sqlite')) {
    const el = document.createElement('jeep-sqlite')
    document.body.appendChild(el)
    await customElements.whenDefined('jeep-sqlite')
  }
  await sqlite.initWebStore()
  webStoreReady = true
}

/**
 * Open (or reuse) the singleton database connection. Safe to call repeatedly.
 */
export async function openDatabase(): Promise<Database> {
  if (db) return wrap(db)

  connection = new SQLiteConnection(CapacitorSQLite)
  await initWebStore(connection)

  // Reuse an existing connection if one is lingering from a prior open.
  const isConn = (await connection.isConnection(DB_NAME, false)).result
  db = isConn
    ? await connection.retrieveConnection(DB_NAME, false)
    : await connection.createConnection(DB_NAME, false, 'no-encryption', SCHEMA_VERSION_PLACEHOLDER, false)

  await db.open()
  return wrap(db)
}

// db.ts must not import schema.ts to avoid a cycle with migrations.ts; the
// real version is applied by runMigrations(). SQLite ignores the createConnection
// version arg for our manual migration flow, so a constant is fine here.
const SCHEMA_VERSION_PLACEHOLDER = 1

function wrap(conn: SQLiteDBConnection): Database {
  return {
    async run(sql, params = []) {
      const res = await conn.run(sql, params as never[])
      return {
        changes: res.changes?.changes ?? 0,
        lastId: res.changes?.lastId,
      }
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await conn.query(sql, params as never[])
      return (res.values ?? []) as T[]
    },
    async execute(statements: string[]) {
      // Join into a single SQL string; CapacitorSQLite.execute runs it as a batch.
      const joined = statements.map((s) => (s.trim().endsWith(';') ? s : `${s};`)).join('\n')
      await conn.execute(joined, true)
    },
  }
}

/** Close the connection (used in tests / teardown). */
export async function closeDatabase(): Promise<void> {
  if (connection && db) {
    await connection.closeConnection(DB_NAME, false)
  }
  db = null
  connection = null
}
