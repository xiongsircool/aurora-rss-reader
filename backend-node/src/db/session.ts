import Database from 'better-sqlite3';
import { getConfig } from '../config/index.js';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const config = getConfig();
    const dbPath = config.databasePath;

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
