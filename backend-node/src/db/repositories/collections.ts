import { getDatabase } from '../session.js';
import { Collection, CollectionEntry, generateId } from '../models.js';

export interface CollectionCreateInput {
  name: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export interface CollectionUpdateInput {
  name?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export interface CollectionEntryCreateInput {
  collection_id: string;
  entry_id: string;
  note?: string | null;
}

export class CollectionRepository {
  private db = getDatabase();

  // === Collection CRUD ===

  create(input: CollectionCreateInput): Collection {
    const now = new Date().toISOString();
    const collection: Collection = {
      id: generateId(),
      name: input.name,
      icon: input.icon ?? 'folder',
      color: input.color ?? '#ff7a18',
      sort_order: input.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO collections (id, name, icon, color, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      collection.id,
      collection.name,
      collection.icon,
      collection.color,
      collection.sort_order,
      collection.created_at,
      collection.updated_at
    );

    return collection;
  }

  findById(id: string): Collection | null {
    const stmt = this.db.prepare('SELECT * FROM collections WHERE id = ?');
    const row = stmt.get(id) as Collection | undefined;
    return row ?? null;
  }

  findAll(): Collection[] {
    const stmt = this.db.prepare('SELECT * FROM collections ORDER BY sort_order ASC, created_at ASC');
    return stmt.all() as Collection[];
  }

  update(id: string, input: CollectionUpdateInput): Collection | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: Collection = {
      ...existing,
      name: input.name ?? existing.name,
      icon: input.icon ?? existing.icon,
      color: input.color ?? existing.color,
      sort_order: input.sort_order ?? existing.sort_order,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE collections SET name = ?, icon = ?, color = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(updated.name, updated.icon, updated.color, updated.sort_order, updated.updated_at, id);

    return updated;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM collections WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // === Collection Entries ===

  addEntry(input: CollectionEntryCreateInput): CollectionEntry {
    const now = new Date().toISOString();
    const entry: CollectionEntry = {
      collection_id: input.collection_id,
      entry_id: input.entry_id,
      added_at: now,
      note: input.note ?? null,
    };

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO collection_entries (collection_id, entry_id, added_at, note)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(entry.collection_id, entry.entry_id, entry.added_at, entry.note);

    return entry;
  }

  removeEntry(collectionId: string, entryId: string): boolean {
    const stmt = this.db.prepare(
      'DELETE FROM collection_entries WHERE collection_id = ? AND entry_id = ?'
    );
    const result = stmt.run(collectionId, entryId);
    return result.changes > 0;
  }

  getEntriesInCollection(collectionId: string, limit = 100, offset = 0): CollectionEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM collection_entries
      WHERE collection_id = ?
      ORDER BY added_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(collectionId, limit, offset) as CollectionEntry[];
  }

  getCollectionsForEntry(entryId: string): Collection[] {
    const stmt = this.db.prepare(`
      SELECT c.* FROM collections c
      INNER JOIN collection_entries ce ON c.id = ce.collection_id
      WHERE ce.entry_id = ?
      ORDER BY c.sort_order ASC
    `);
    return stmt.all(entryId) as Collection[];
  }

  getEntryCountInCollection(collectionId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM collection_entries WHERE collection_id = ?'
    );
    const result = stmt.get(collectionId) as { count: number };
    return result.count;
  }

  isEntryInCollection(collectionId: string, entryId: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM collection_entries WHERE collection_id = ? AND entry_id = ? LIMIT 1'
    );
    return stmt.get(collectionId, entryId) !== undefined;
  }
}
