import { getDatabase } from '../session.js';
import { AggregateDigest, generateId, AIScopeType } from '../models.js';

export interface AggregateDigestCreateInput {
  scope_type: Exclude<AIScopeType, 'global'>;
  scope_id: string;
  period: string;
  time_range_key: string;
  language: string;
  source_count: number;
  source_hash: string;
  summary_md: string;
  citations_json: string;
  keywords_json?: string | null;
  model_name: string;
  trigger_type?: string;
}

export class AggregateDigestRepository {
  private db = getDatabase();

  create(input: AggregateDigestCreateInput): AggregateDigest {
    const digest: AggregateDigest = {
      id: generateId(),
      task_key: 'aggregate_digest',
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      period: input.period,
      time_range_key: input.time_range_key,
      language: input.language,
      source_count: input.source_count,
      source_hash: input.source_hash,
      summary_md: input.summary_md,
      citations_json: input.citations_json,
      keywords_json: input.keywords_json ?? null,
      model_name: input.model_name,
      trigger_type: input.trigger_type ?? 'auto',
      created_at: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO aggregate_digests (
        id, task_key, scope_type, scope_id, period, time_range_key, language,
        source_count, source_hash, summary_md, citations_json, keywords_json,
        model_name, trigger_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      digest.id,
      digest.task_key,
      digest.scope_type,
      digest.scope_id,
      digest.period,
      digest.time_range_key,
      digest.language,
      digest.source_count,
      digest.source_hash,
      digest.summary_md,
      digest.citations_json,
      digest.keywords_json,
      digest.model_name,
      digest.trigger_type,
      digest.created_at,
    );

    return digest;
  }

  findLatestByScope(input: {
    scope_type: Exclude<AIScopeType, 'global'>;
    scope_id: string;
    period: string;
    time_range_key: string;
    language: string;
  }): AggregateDigest | null {
    const row = this.db.prepare(`
      SELECT * FROM aggregate_digests
      WHERE scope_type = ? AND scope_id = ? AND period = ? AND time_range_key = ? AND language = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      input.scope_type,
      input.scope_id,
      input.period,
      input.time_range_key,
      input.language,
    ) as AggregateDigest | undefined;

    return row ?? null;
  }

  findHistoryByScope(input: {
    scope_type: Exclude<AIScopeType, 'global'>;
    scope_id: string;
    period: string;
    language: string;
    limit: number;
    cursor?: string | null;
  }): { items: AggregateDigest[]; nextCursor: string | null; hasMore: boolean } {
    const params: Array<string | number> = [
      input.scope_type,
      input.scope_id,
      input.period,
      input.language,
    ];
    let sql = `
      SELECT * FROM aggregate_digests
      WHERE scope_type = ? AND scope_id = ? AND period = ? AND language = ?
    `;

    if (input.cursor) {
      sql += ` AND created_at < ?`;
      params.push(input.cursor);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(input.limit + 1);

    const rows = this.db.prepare(sql).all(...params) as AggregateDigest[];
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

    return { items, nextCursor, hasMore };
  }
}
