import { getDatabase } from '../session.js';
import { EntryAnalysisStatus, Entry, ANALYSIS_STATUS } from '../models.js';
import { normalizeTimeField, parseRelativeTime } from '../../utils/dateRange.js';

export interface AnalysisStats {
    pending: number;
    analyzed: number;
    skipped: number;
    withTags: number;
    withoutTags: number;
}

export class AnalysisStatusRepository {
    private db = getDatabase();

    /**
     * Get or create analysis status for an entry
     */
    getOrCreate(entryId: string): EntryAnalysisStatus {
        const existing = this.findByEntryId(entryId);
        if (existing) return existing;

        const status: EntryAnalysisStatus = {
            entry_id: entryId,
            status: 'pending',
            analyzed_at: null,
            tags_version: 0,
        };

        const stmt = this.db.prepare(`
      INSERT INTO entry_analysis_status (entry_id, status, analyzed_at, tags_version)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(status.entry_id, status.status, status.analyzed_at, status.tags_version);

        return status;
    }

    /**
     * Find analysis status by entry ID
     */
    findByEntryId(entryId: string): EntryAnalysisStatus | null {
        const stmt = this.db.prepare('SELECT * FROM entry_analysis_status WHERE entry_id = ?');
        const row = stmt.get(entryId) as EntryAnalysisStatus | undefined;
        return row ?? null;
    }

    /**
     * Update analysis status
     */
    updateStatus(
        entryId: string,
        status: 'pending' | 'analyzed' | 'skipped',
        tagsVersion?: number
    ): void {
        const now = status === 'analyzed' ? new Date().toISOString() : null;

        // Use upsert to handle entries that don't have a status yet
        const stmt = this.db.prepare(`
      INSERT INTO entry_analysis_status (entry_id, status, analyzed_at, tags_version)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        status = excluded.status,
        analyzed_at = excluded.analyzed_at,
        tags_version = excluded.tags_version
    `);
        stmt.run(entryId, status, now, tagsVersion ?? 0);
    }

    /**
     * Batch update status for multiple entries
     */
    batchUpdateStatus(
        entryIds: string[],
        status: 'pending' | 'analyzed' | 'skipped',
        tagsVersion?: number
    ): void {
        const now = status === 'analyzed' ? new Date().toISOString() : null;
        const version = tagsVersion ?? 0;

        const stmt = this.db.prepare(`
      INSERT INTO entry_analysis_status (entry_id, status, analyzed_at, tags_version)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        status = excluded.status,
        analyzed_at = excluded.analyzed_at,
        tags_version = excluded.tags_version
    `);

        const updateMany = this.db.transaction((ids: string[]) => {
            for (const id of ids) {
                stmt.run(id, status, now, version);
            }
        });

        updateMany(entryIds);
    }

    /**
     * Get pending entries (not yet analyzed)
     */
    getPendingEntries(options: {
        limit?: number;
        cursor?: string;
        startAt?: string;
        date_range?: string;
        time_field?: string;
    } = {}): {
        items: Entry[];
        nextCursor: string | null;
        hasMore: boolean;
    } {
        const limit = options.limit ?? 50;
        const timeField = normalizeTimeField(options.time_field);
        const cutoff = parseRelativeTime(options.date_range);

        // Get entries that either have 'pending' status or don't have a status record yet
        let query = `
      SELECT e.*, f.title as feed_title
	      FROM entries e
	      LEFT JOIN feeds f ON e.feed_id = f.id
	      LEFT JOIN entry_analysis_status eas ON e.id = eas.entry_id
	      WHERE (eas.status = 'pending' OR eas.entry_id IS NULL)
	    `;

	        const params: (string | number)[] = [];

	        query += ` AND f.ai_tagging_enabled = 1`;

	        if (options.startAt) {
	            query += ` AND e.inserted_at >= ?`;
	            params.push(options.startAt);
	        }

            if (cutoff) {
                const cutoffIso = cutoff.toISOString();
                if (timeField === 'published_at') {
                    const nowIso = new Date().toISOString();
                    query += `
            AND (
              (e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?)
              OR (e.published_at IS NULL AND e.inserted_at >= ?)
            )`;
                    params.push(nowIso, cutoffIso, cutoffIso);
                } else {
                    query += ` AND e.inserted_at >= ?`;
                    params.push(cutoffIso);
                }
            }

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
     * Get analyzed entries with no tags
     */
    getEntriesWithoutTags(options: {
        limit?: number;
        cursor?: string;
        startAt?: string;
        date_range?: string;
        time_field?: string;
    } = {}): {
        items: Entry[];
        nextCursor: string | null;
        hasMore: boolean;
    } {
        const limit = options.limit ?? 50;
        const timeField = normalizeTimeField(options.time_field);
        const cutoff = parseRelativeTime(options.date_range);

        let query = `
      SELECT e.*, f.title as feed_title
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
	      INNER JOIN entry_analysis_status eas ON e.id = eas.entry_id
	      LEFT JOIN entry_tags et ON e.id = et.entry_id
	      WHERE eas.status = 'analyzed' AND et.entry_id IS NULL
	    `;

	        const params: (string | number)[] = [];

	        query += ` AND f.ai_tagging_enabled = 1`;

	        if (options.startAt) {
	            query += ` AND e.inserted_at >= ?`;
	            params.push(options.startAt);
	        }

            if (cutoff) {
                const cutoffIso = cutoff.toISOString();
                if (timeField === 'published_at') {
                    const nowIso = new Date().toISOString();
                    query += `
            AND (
              (e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?)
              OR (e.published_at IS NULL AND e.inserted_at >= ?)
            )`;
                    params.push(nowIso, cutoffIso, cutoffIso);
                } else {
                    query += ` AND e.inserted_at >= ?`;
                    params.push(cutoffIso);
                }
            }

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
     * Get analysis statistics
     */
    getStats(options: { startAt?: string } = {}): AnalysisStats {
        // Count entries by status
        const statusStmt = this.db.prepare(`
	      SELECT 
	        COALESCE(eas.status, 'pending') as status,
	        COUNT(*) as count
	      FROM entries e
	      INNER JOIN feeds f ON e.feed_id = f.id
	      LEFT JOIN entry_analysis_status eas ON e.id = eas.entry_id
	      WHERE f.ai_tagging_enabled = 1
	      ${options.startAt ? 'AND e.inserted_at >= ?' : ''}
	      GROUP BY COALESCE(eas.status, 'pending')
	    `);
        const statusRows = (options.startAt
            ? statusStmt.all(options.startAt)
            : statusStmt.all()) as Array<{ status: string; count: number }>;

        // Count entries with tags vs without tags (among analyzed)
        const tagStmt = this.db.prepare(`
	      SELECT 
	        CASE WHEN et.entry_id IS NOT NULL THEN 'with_tags' ELSE 'without_tags' END as category,
	        COUNT(DISTINCT e.id) as count
	      FROM entries e
	      INNER JOIN feeds f ON e.feed_id = f.id
	      INNER JOIN entry_analysis_status eas ON e.id = eas.entry_id
	      LEFT JOIN entry_tags et ON e.id = et.entry_id
	      WHERE f.ai_tagging_enabled = 1
	        AND eas.status = 'analyzed'
	        ${options.startAt ? 'AND e.inserted_at >= ?' : ''}
	      GROUP BY category
	    `);
        const tagRows = (options.startAt
            ? tagStmt.all(options.startAt)
            : tagStmt.all()) as Array<{ category: string; count: number }>;

        const stats: AnalysisStats = {
            pending: 0,
            analyzed: 0,
            skipped: 0,
            withTags: 0,
            withoutTags: 0,
        };

        for (const row of statusRows) {
            if (row.status === 'pending') stats.pending = row.count;
            else if (row.status === 'analyzed') stats.analyzed = row.count;
            else if (row.status === 'skipped') stats.skipped = row.count;
        }

        for (const row of tagRows) {
            if (row.category === 'with_tags') stats.withTags = row.count;
            else if (row.category === 'without_tags') stats.withoutTags = row.count;
        }

        return stats;
    }

    /**
     * Mark entries older than a certain version for re-analysis
     */
    markForReanalysis(currentVersion: number): number {
        const stmt = this.db.prepare(`
      UPDATE entry_analysis_status 
      SET status = 'pending'
      WHERE status = 'analyzed' AND tags_version < ?
    `);
        const result = stmt.run(currentVersion);
        return result.changes;
    }
}
