import { getDatabase } from '../session.js';
import { UserTag, generateId } from '../models.js';

export interface TagCreateInput {
    name: string;
    description?: string | null;
    color?: string;
    sort_order?: number;
    enabled?: boolean;
    match_mode?: 'ai' | 'rule' | 'both';
    match_rules?: string | null; // JSON string
}

export interface TagUpdateInput {
    name?: string;
    description?: string | null;
    color?: string;
    sort_order?: number;
    enabled?: boolean;
    match_mode?: 'ai' | 'rule' | 'both';
    match_rules?: string | null; // JSON string
}

export class TagRepository {
    private db = getDatabase();

    create(input: TagCreateInput): UserTag {
        const now = new Date().toISOString();
        const tag: UserTag = {
            id: generateId(),
            name: input.name,
            description: input.description ?? null,
            color: input.color ?? '#3b82f6',
            sort_order: input.sort_order ?? 0,
            enabled: input.enabled === false ? 0 : 1,
            match_mode: input.match_mode ?? 'ai',
            match_rules: input.match_rules ?? null,
            created_at: now,
            updated_at: now,
        };

        const stmt = this.db.prepare(`
      INSERT INTO user_tags (id, name, description, color, sort_order, enabled, match_mode, match_rules, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            tag.id,
            tag.name,
            tag.description,
            tag.color,
            tag.sort_order,
            tag.enabled,
            tag.match_mode,
            tag.match_rules,
            tag.created_at,
            tag.updated_at
        );

        return tag;
    }

    findById(id: string): UserTag | null {
        const stmt = this.db.prepare('SELECT * FROM user_tags WHERE id = ?');
        const row = stmt.get(id) as UserTag | undefined;
        return row ?? null;
    }

    findByName(name: string): UserTag | null {
        const stmt = this.db.prepare('SELECT * FROM user_tags WHERE name = ?');
        const row = stmt.get(name) as UserTag | undefined;
        return row ?? null;
    }

    findAll(): UserTag[] {
        const stmt = this.db.prepare('SELECT * FROM user_tags ORDER BY sort_order ASC, created_at ASC');
        return stmt.all() as UserTag[];
    }

    findAllEnabled(): UserTag[] {
        const stmt = this.db.prepare('SELECT * FROM user_tags WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC');
        return stmt.all() as UserTag[];
    }

    findEnabledByMatchMode(mode: 'ai' | 'rule' | 'both'): UserTag[] {
        // Return tags that use the given mode: exact match or 'both'
        const stmt = this.db.prepare(
            'SELECT * FROM user_tags WHERE enabled = 1 AND (match_mode = ? OR match_mode = ?) ORDER BY sort_order ASC, created_at ASC'
        );
        return stmt.all(mode, 'both') as UserTag[];
    }

    findEnabledWithRules(): UserTag[] {
        // Tags that have rule matching enabled (mode = 'rule' or 'both')
        const stmt = this.db.prepare(
            "SELECT * FROM user_tags WHERE enabled = 1 AND (match_mode = 'rule' OR match_mode = 'both') AND match_rules IS NOT NULL ORDER BY sort_order ASC, created_at ASC"
        );
        return stmt.all() as UserTag[];
    }

    findEnabledWithAI(): UserTag[] {
        // Tags that have AI matching enabled (mode = 'ai' or 'both')
        const stmt = this.db.prepare(
            "SELECT * FROM user_tags WHERE enabled = 1 AND (match_mode = 'ai' OR match_mode = 'both') ORDER BY sort_order ASC, created_at ASC"
        );
        return stmt.all() as UserTag[];
    }

    update(id: string, input: TagUpdateInput): UserTag | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const now = new Date().toISOString();
        const updated: UserTag = {
            ...existing,
            name: input.name ?? existing.name,
            description: input.description !== undefined ? input.description : existing.description,
            color: input.color ?? existing.color,
            sort_order: input.sort_order ?? existing.sort_order,
            enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled,
            match_mode: input.match_mode ?? existing.match_mode,
            match_rules: input.match_rules !== undefined ? input.match_rules : existing.match_rules,
            updated_at: now,
        };

        const stmt = this.db.prepare(`
      UPDATE user_tags SET name = ?, description = ?, color = ?, sort_order = ?, enabled = ?, match_mode = ?, match_rules = ?, updated_at = ?
      WHERE id = ?
    `);
        stmt.run(
            updated.name,
            updated.description,
            updated.color,
            updated.sort_order,
            updated.enabled,
            updated.match_mode,
            updated.match_rules,
            updated.updated_at,
            id
        );

        return updated;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM user_tags WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    getTagCountWithEntries(tagId: string): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM entry_tags WHERE tag_id = ?');
        const result = stmt.get(tagId) as { count: number };
        return result.count;
    }

    getAllWithEntryCounts(): Array<UserTag & { entry_count: number }> {
        const stmt = this.db.prepare(`
      SELECT t.*, COALESCE(c.count, 0) as entry_count
      FROM user_tags t
      LEFT JOIN (
        SELECT tag_id, COUNT(*) as count FROM entry_tags GROUP BY tag_id
      ) c ON t.id = c.tag_id
      ORDER BY t.sort_order ASC, t.created_at ASC
    `);
        return stmt.all() as Array<UserTag & { entry_count: number }>;
    }
}
