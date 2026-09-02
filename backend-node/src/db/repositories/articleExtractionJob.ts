import { getDatabase } from '../session.js';
import { ArticleExtractionJob, generateId } from '../models.js';

export interface ArticleExtractionJobCreateInput {
  entry_id: string;
  max_attempts?: number;
  next_run_at?: string | null;
}

export class ArticleExtractionJobRepository {
  private db = getDatabase();

  createOrReset(input: ArticleExtractionJobCreateInput): ArticleExtractionJob {
    const now = new Date().toISOString();
    const existing = this.findByEntryId(input.entry_id);

    if (existing) {
      const updated: ArticleExtractionJob = {
        ...existing,
        status: 'queued',
        attempts: 0,
        max_attempts: input.max_attempts ?? existing.max_attempts ?? 3,
        next_run_at: input.next_run_at ?? now,
        leased_at: null,
        lease_owner: null,
        error: null,
        updated_at: now,
      };

      this.db.prepare(`
        UPDATE article_extraction_jobs SET
          status = ?, attempts = ?, max_attempts = ?, next_run_at = ?,
          leased_at = ?, lease_owner = ?, error = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updated.status,
        updated.attempts,
        updated.max_attempts,
        updated.next_run_at,
        updated.leased_at,
        updated.lease_owner,
        updated.error,
        updated.updated_at,
        updated.id
      );

      return updated;
    }

    const job: ArticleExtractionJob = {
      id: generateId(),
      entry_id: input.entry_id,
      status: 'queued',
      attempts: 0,
      max_attempts: input.max_attempts ?? 3,
      next_run_at: input.next_run_at ?? now,
      leased_at: null,
      lease_owner: null,
      error: null,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO article_extraction_jobs (
        id, entry_id, status, attempts, max_attempts, next_run_at,
        leased_at, lease_owner, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.entry_id,
      job.status,
      job.attempts,
      job.max_attempts,
      job.next_run_at,
      job.leased_at,
      job.lease_owner,
      job.error,
      job.created_at,
      job.updated_at
    );

    return job;
  }

  findByEntryId(entryId: string): ArticleExtractionJob | null {
    const row = this.db
      .prepare('SELECT * FROM article_extraction_jobs WHERE entry_id = ?')
      .get(entryId) as ArticleExtractionJob | undefined;
    return row ?? null;
  }

  leaseDueJobs(limit: number, owner: string): ArticleExtractionJob[] {
    const now = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      const candidates = this.db.prepare(`
        SELECT *
        FROM article_extraction_jobs
        WHERE status IN ('queued', 'failed')
          AND next_run_at IS NOT NULL
          AND next_run_at <= ?
          AND attempts < max_attempts
        ORDER BY next_run_at ASC, created_at ASC
        LIMIT ?
      `).all(now, limit) as ArticleExtractionJob[];

      const leased: ArticleExtractionJob[] = [];

      for (const job of candidates) {
        const result = this.db.prepare(`
          UPDATE article_extraction_jobs SET
            status = 'running',
            attempts = attempts + 1,
            leased_at = ?,
            lease_owner = ?,
            updated_at = ?
          WHERE id = ?
            AND status IN ('queued', 'failed')
            AND attempts < max_attempts
        `).run(now, owner, now, job.id);

        if (result.changes > 0) {
          leased.push({
            ...job,
            status: 'running',
            attempts: job.attempts + 1,
            leased_at: now,
            lease_owner: owner,
            updated_at: now,
          });
        }
      }

      return leased;
    });

    return transaction();
  }

  requeueExpiredRunningJobs(leaseTimeoutMs: number): number {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - leaseTimeoutMs).toISOString();

    const result = this.db.prepare(`
      UPDATE article_extraction_jobs SET
        status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
        next_run_at = CASE WHEN attempts < max_attempts THEN ? ELSE next_run_at END,
        leased_at = NULL,
        lease_owner = NULL,
        updated_at = ?
      WHERE status = 'running'
        AND leased_at IS NOT NULL
        AND leased_at < ?
    `).run(now, now, cutoff);

    return result.changes;
  }

  markSucceeded(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE article_extraction_jobs SET
        status = 'succeeded',
        next_run_at = NULL,
        leased_at = NULL,
        lease_owner = NULL,
        error = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(now, id);
  }

  markFailed(id: string, error: string, nextRunAt: string | null): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE article_extraction_jobs SET
        status = 'failed',
        next_run_at = ?,
        leased_at = NULL,
        lease_owner = NULL,
        error = ?,
        updated_at = ?
      WHERE id = ?
    `).run(nextRunAt, error, now, id);
  }
}
