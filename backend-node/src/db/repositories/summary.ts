import { getDatabase } from '../session.js';
import { Summary, generateId } from '../models.js';

export interface SummaryCreateInput {
  entry_id: string;
  language: string;
  summary?: string | null;
}

export interface SummaryUpdateInput {
  summary?: string | null;
}

export class SummaryRepository {
  private db = getDatabase();

  create(input: SummaryCreateInput): Summary {
    const now = new Date().toISOString();
    const summary: Summary = {
      id: generateId(),
      entry_id: input.entry_id,
      language: input.language,
      summary: input.summary ?? null,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO summaries (id, entry_id, language, summary, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      summary.id,
      summary.entry_id,
      summary.language,
      summary.summary,
      summary.created_at
    );

    return summary;
  }

  findById(id: string): Summary | null {
    const stmt = this.db.prepare('SELECT * FROM summaries WHERE id = ?');
    const row = stmt.get(id) as Summary | undefined;
    return row ?? null;
  }

  findByEntryIdAndLanguage(entryId: string, language: string): Summary | null {
    const stmt = this.db.prepare('SELECT * FROM summaries WHERE entry_id = ? AND language = ?');
    const row = stmt.get(entryId, language) as Summary | undefined;
    return row ?? null;
  }

  findByEntryId(entryId: string): Summary[] {
    const stmt = this.db.prepare('SELECT * FROM summaries WHERE entry_id = ?');
    return stmt.all(entryId) as Summary[];
  }

  update(id: string, input: SummaryUpdateInput): Summary | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Summary = {
      ...existing,
      summary: input.summary !== undefined ? input.summary : existing.summary,
    };

    const stmt = this.db.prepare('UPDATE summaries SET summary = ? WHERE id = ?');
    stmt.run(updated.summary, id);

    return updated;
  }

  upsert(input: SummaryCreateInput): Summary {
    const existing = this.findByEntryIdAndLanguage(input.entry_id, input.language);
    if (existing) {
      return this.update(existing.id, input)!;
    }
    return this.create(input);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM summaries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
