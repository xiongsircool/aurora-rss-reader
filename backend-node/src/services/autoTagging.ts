/**
 * Auto tagging runner
 * Processes new entries in the background when auto-tagging is enabled.
 */

import { getDatabase } from '../db/session.js';
import {
  AnalysisStatusRepository,
  EntryTagRepository,
  TagRepository,
} from '../db/repositories/index.js';
import { analyzeEntryTags, getTaggingConfig, initTaggingClient } from './tagging.js';

export interface AutoTaggingStats {
  processed: number;
  tagged: number;
  untagged: number;
  failed: number;
}

export async function runAutoTaggingBatch(options: { limit?: number } = {}): Promise<AutoTaggingStats> {
  const stats: AutoTaggingStats = { processed: 0, tagged: 0, untagged: 0, failed: 0 };
  const limit = options.limit ?? 20;

  const config = getTaggingConfig();
  if (!config.autoTagging) {
    return stats;
  }

  // Avoid busy loops when config is incomplete.
  if (!config.apiKey || !config.baseUrl || !config.modelName) {
    return stats;
  }

  // Ensure we don't auto-process historical entries by default.
  const db = getDatabase();
  const startAt = config.autoTaggingStartAt?.trim() || '';
  if (!startAt) {
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE user_settings SET ai_auto_tagging_start_at = ?, updated_at = ? WHERE id = 1'
    ).run(now, now);
    return stats;
  }

  initTaggingClient();

  const tagRepo = new TagRepository();
  const tags = tagRepo.findAllEnabled();
  if (tags.length === 0) {
    return stats;
  }

  const analysisRepo = new AnalysisStatusRepository();
  const entryTagRepo = new EntryTagRepository();

  const candidates = db.prepare(
    `
      SELECT
        e.id,
        e.title,
        e.summary,
        COALESCE(e.readability_content, e.content) as content
      FROM entries e
      INNER JOIN feeds f ON f.id = e.feed_id
      LEFT JOIN entry_analysis_status eas ON e.id = eas.entry_id
      WHERE f.ai_tagging_enabled = 1
        AND e.inserted_at >= ?
        AND (eas.entry_id IS NULL OR eas.status = 'pending')
      ORDER BY e.inserted_at DESC
      LIMIT ?
    `
  ).all(startAt, limit) as Array<{
    id: string;
    title: string | null;
    summary: string | null;
    content: string | null;
  }>;

  for (const entry of candidates) {
    const result = await analyzeEntryTags(
      {
        title: entry.title || '',
        summary: entry.summary,
        content: entry.content,
      },
      tags
    );

    if (!result.success) {
      stats.failed += 1;
      // Keep it pending so it can be retried.
      analysisRepo.updateStatus(entry.id, 'pending', config.tagsVersion);
      continue;
    }

    entryTagRepo.removeAllTags(entry.id);
    if (result.tagIds.length > 0) {
      entryTagRepo.addTags(entry.id, result.tagIds, false);
      stats.tagged += 1;
    } else {
      stats.untagged += 1;
    }

    analysisRepo.updateStatus(entry.id, 'analyzed', config.tagsVersion);
    stats.processed += 1;
  }

  return stats;
}
