import { getDatabase } from '../session.js';
import { EntryTag, UserTag, Entry } from '../models.js';

export interface EntryWithTags extends Entry {
    tags: UserTag[];
}

export class EntryTagRepository {
    private db = getDatabase();

    /**
     * Add a tag to an entry
     */
    addTag(entryId: string, tagId: string, isManual = false): EntryTag {
        const now = new Date().toISOString();
        const entryTag: EntryTag = {
            entry_id: entryId,
            tag_id: tagId,
            is_manual: isManual ? 1 : 0,
            created_at: now,
        };

        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entry_tags (entry_id, tag_id, is_manual, created_at)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(entryTag.entry_id, entryTag.tag_id, entryTag.is_manual, entryTag.created_at);

        return entryTag;
    }

    /**
     * Add multiple tags to an entry
     */
    addTags(entryId: string, tagIds: string[], isManual = false): void {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entry_tags (entry_id, tag_id, is_manual, created_at)
      VALUES (?, ?, ?, ?)
    `);

        const insertMany = this.db.transaction((ids: string[]) => {
            for (const tagId of ids) {
                stmt.run(entryId, tagId, isManual ? 1 : 0, now);
            }
        });

        insertMany(tagIds);
    }

    /**
     * Remove a tag from an entry
     */
    removeTag(entryId: string, tagId: string): boolean {
        const stmt = this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?');
        const result = stmt.run(entryId, tagId);
        return result.changes > 0;
    }

    /**
     * Remove all tags from an entry
     */
    removeAllTags(entryId: string): void {
        const stmt = this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ?');
        stmt.run(entryId);
    }

    /**
     * Get all tags for an entry
     */
    getTagsForEntry(entryId: string): UserTag[] {
        const stmt = this.db.prepare(`
      SELECT t.* FROM user_tags t
      INNER JOIN entry_tags et ON t.id = et.tag_id
      WHERE et.entry_id = ?
      ORDER BY t.sort_order ASC
    `);
        return stmt.all(entryId) as UserTag[];
    }

    /**
     * Check if entry has a specific tag
     */
    hasTag(entryId: string, tagId: string): boolean {
        const stmt = this.db.prepare(
            'SELECT 1 FROM entry_tags WHERE entry_id = ? AND tag_id = ? LIMIT 1'
        );
        return stmt.get(entryId, tagId) !== undefined;
    }

    /**
     * Get entries by tag ID with pagination
     */
    getEntriesByTagId(
        tagId: string,
        options: { limit?: number; cursor?: string } = {}
    ): { items: Entry[]; nextCursor: string | null; hasMore: boolean } {
        const limit = options.limit ?? 50;

        let query = `
      SELECT e.*, f.title as feed_title
      FROM entries e
      INNER JOIN entry_tags et ON e.id = et.entry_id
      LEFT JOIN feeds f ON e.feed_id = f.id
      WHERE et.tag_id = ?
    `;

        const params: (string | number)[] = [tagId];

        if (options.cursor) {
            query += ` AND e.inserted_at < ?`;
            params.push(options.cursor);
        }

        query += ` ORDER BY e.inserted_at DESC LIMIT ?`;
        params.push(limit + 1);

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as Entry[];

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].inserted_at : null;

        return { items, nextCursor, hasMore };
    }

    /**
     * Get entry count for a tag
     */
    getEntryCountByTagId(tagId: string): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM entry_tags WHERE tag_id = ?');
        const result = stmt.get(tagId) as { count: number };
        return result.count;
    }
}
