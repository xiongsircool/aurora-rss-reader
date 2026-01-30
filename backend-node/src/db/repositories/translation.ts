import { getDatabase } from '../session.js';
import { Translation, generateId } from '../models.js';

export interface TranslationCreateInput {
  entry_id: string;
  language: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  paragraph_map?: Record<string, Record<string, string>> | null;
}

export interface TranslationUpdateInput {
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  paragraph_map?: Record<string, Record<string, string>> | null;
}

export class TranslationRepository {
  private db = getDatabase();

  create(input: TranslationCreateInput): Translation {
    const now = new Date().toISOString();
    const translation: Translation = {
      id: generateId(),
      entry_id: input.entry_id,
      language: input.language,
      title: input.title ?? null,
      summary: input.summary ?? null,
      content: input.content ?? null,
      paragraph_map: input.paragraph_map ? JSON.stringify(input.paragraph_map) : null,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO translations (
        id, entry_id, language, title, summary, content, paragraph_map, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      translation.id,
      translation.entry_id,
      translation.language,
      translation.title,
      translation.summary,
      translation.content,
      translation.paragraph_map,
      translation.created_at
    );

    return translation;
  }

  findById(id: string): Translation | null {
    const stmt = this.db.prepare('SELECT * FROM translations WHERE id = ?');
    const row = stmt.get(id) as Translation | undefined;
    return row ?? null;
  }

  findByEntryIdAndLanguage(entryId: string, language: string): Translation | null {
    const stmt = this.db.prepare('SELECT * FROM translations WHERE entry_id = ? AND language = ?');
    const row = stmt.get(entryId, language) as Translation | undefined;
    return row ?? null;
  }

  findByEntryId(entryId: string): Translation[] {
    const stmt = this.db.prepare('SELECT * FROM translations WHERE entry_id = ?');
    return stmt.all(entryId) as Translation[];
  }

  update(id: string, input: TranslationUpdateInput): Translation | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Translation = {
      ...existing,
      title: input.title !== undefined ? input.title : existing.title,
      summary: input.summary !== undefined ? input.summary : existing.summary,
      content: input.content !== undefined ? input.content : existing.content,
      paragraph_map: input.paragraph_map !== undefined
        ? (input.paragraph_map ? JSON.stringify(input.paragraph_map) : null)
        : existing.paragraph_map,
    };

    const stmt = this.db.prepare(`
      UPDATE translations SET
        title = ?, summary = ?, content = ?, paragraph_map = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.title,
      updated.summary,
      updated.content,
      updated.paragraph_map,
      id
    );

    return updated;
  }

  upsert(input: TranslationCreateInput): Translation {
    const existing = this.findByEntryIdAndLanguage(input.entry_id, input.language);
    if (existing) {
      return this.update(existing.id, input)!;
    }
    return this.create(input);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM translations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
