import { getDatabase } from '../session.js';
import { generateId } from '../models.js';

export type ScopeSummaryScopeType = 'feed' | 'group';
export type ScopeSummaryWindowType = '24h' | '3d' | '7d' | '30d';
export type ScopeSummaryStatus = 'generating' | 'ready' | 'failed';

export interface ScopeSummaryRun {
  id: string;
  scope_type: ScopeSummaryScopeType;
  scope_id: string;
  window_type: ScopeSummaryWindowType;
  window_start_at: string;
  window_end_at: string;
  language: string;
  source_count: number;
  source_hash: string;
  status: ScopeSummaryStatus;
  summary_md: string;
  citations_json: string;
  keywords_json: string | null;
  model_name: string | null;
  trigger_type: 'auto' | 'manual';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScopeSummaryChunk {
  id: string;
  run_id: string;
  chunk_index: number;
  source_count: number;
  source_refs_json: string;
  chunk_summary_md: string;
  keywords_json: string | null;
  model_name: string | null;
  created_at: string;
}

export class ScopeSummaryRepository {
  private db = getDatabase();

  createRun(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type: ScopeSummaryWindowType;
    window_start_at: string;
    window_end_at: string;
    language: string;
    source_count: number;
    source_hash: string;
    status?: ScopeSummaryStatus;
    summary_md?: string;
    citations_json?: string;
    keywords_json?: string | null;
    model_name?: string | null;
    trigger_type?: 'auto' | 'manual';
    error_message?: string | null;
  }): ScopeSummaryRun {
    const now = new Date().toISOString();
    const run: ScopeSummaryRun = {
      id: generateId(),
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      window_type: input.window_type,
      window_start_at: input.window_start_at,
      window_end_at: input.window_end_at,
      language: input.language,
      source_count: input.source_count,
      source_hash: input.source_hash,
      status: input.status ?? 'generating',
      summary_md: input.summary_md ?? '',
      citations_json: input.citations_json ?? '[]',
      keywords_json: input.keywords_json ?? null,
      model_name: input.model_name ?? null,
      trigger_type: input.trigger_type ?? 'manual',
      error_message: input.error_message ?? null,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO scope_summary_runs (
        id, scope_type, scope_id, window_type, window_start_at, window_end_at, language,
        source_count, source_hash, status, summary_md, citations_json, keywords_json,
        model_name, trigger_type, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.scope_type,
      run.scope_id,
      run.window_type,
      run.window_start_at,
      run.window_end_at,
      run.language,
      run.source_count,
      run.source_hash,
      run.status,
      run.summary_md,
      run.citations_json,
      run.keywords_json,
      run.model_name,
      run.trigger_type,
      run.error_message,
      run.created_at,
      run.updated_at,
    );

    return run;
  }

  updateRun(runId: string, updates: Partial<Pick<ScopeSummaryRun,
    'status' | 'summary_md' | 'citations_json' | 'keywords_json' | 'model_name' | 'error_message' | 'source_count' | 'source_hash'
  >>): ScopeSummaryRun | null {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      fields.push(`${key} = ?`);
      values.push(value as string | number | null);
    }

    if (!fields.length) {
      return this.findById(runId);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(runId);

    this.db.prepare(`UPDATE scope_summary_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(runId);
  }

  createChunk(input: {
    run_id: string;
    chunk_index: number;
    source_count: number;
    source_refs_json: string;
    chunk_summary_md: string;
    keywords_json?: string | null;
    model_name?: string | null;
  }): ScopeSummaryChunk {
    const chunk: ScopeSummaryChunk = {
      id: generateId(),
      run_id: input.run_id,
      chunk_index: input.chunk_index,
      source_count: input.source_count,
      source_refs_json: input.source_refs_json,
      chunk_summary_md: input.chunk_summary_md,
      keywords_json: input.keywords_json ?? null,
      model_name: input.model_name ?? null,
      created_at: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO scope_summary_chunks (
        id, run_id, chunk_index, source_count, source_refs_json,
        chunk_summary_md, keywords_json, model_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chunk.id,
      chunk.run_id,
      chunk.chunk_index,
      chunk.source_count,
      chunk.source_refs_json,
      chunk.chunk_summary_md,
      chunk.keywords_json,
      chunk.model_name,
      chunk.created_at,
    );

    return chunk;
  }

  findById(runId: string): ScopeSummaryRun | null {
    const row = this.db.prepare(`SELECT * FROM scope_summary_runs WHERE id = ? LIMIT 1`).get(runId) as ScopeSummaryRun | undefined;
    return row ?? null;
  }

  findLatest(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type: ScopeSummaryWindowType;
    language: string;
  }): ScopeSummaryRun | null {
    const row = this.db.prepare(`
      SELECT * FROM scope_summary_runs
      WHERE scope_type = ? AND scope_id = ?
        AND window_type = ? AND language = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      input.scope_type,
      input.scope_id,
      input.window_type,
      input.language,
    ) as ScopeSummaryRun | undefined;

    return row ?? null;
  }

  findHistory(input: {
    scope_type: ScopeSummaryScopeType;
    scope_id: string;
    window_type: ScopeSummaryWindowType;
    language: string;
    limit: number;
    cursor?: string | null;
  }): { items: ScopeSummaryRun[]; nextCursor: string | null; hasMore: boolean } {
    const params: Array<string | number> = [input.scope_type, input.scope_id, input.window_type, input.language];
    let sql = `
      SELECT * FROM scope_summary_runs
      WHERE scope_type = ? AND scope_id = ? AND window_type = ? AND language = ? AND status = 'ready'
    `;

    if (input.cursor) {
      sql += ` AND created_at < ?`;
      params.push(input.cursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(input.limit + 1);

    const rows = this.db.prepare(sql).all(...params) as ScopeSummaryRun[];
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;
    return { items, nextCursor, hasMore };
  }
}
