/**
 * Auto tagging runner
 * Processes new entries in the background when auto-tagging is enabled.
 * Supports dual-mode: rule-based matching (instant) + AI analysis.
 */

import { getDatabase } from '../db/session.js';
import {
  AnalysisStatusRepository,
  EntryTagRepository,
  TagRepository,
} from '../db/repositories/index.js';
import { analyzeEntryTags, getTaggingConfig, initTaggingClient } from './tagging.js';
import { runRuleMatchingForEntry } from './ruleMatching.js';

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

  const tagRepo = new TagRepository();
  const allTags = tagRepo.findAllEnabled();
  if (allTags.length === 0) {
    return stats;
  }

  // Separate tags by matching mode
  const ruleTags = allTags.filter(
    (t) => (t.match_mode === 'rule' || t.match_mode === 'both') && t.match_rules
  );
  const aiTags = allTags.filter(
    (t) => t.match_mode === 'ai' || t.match_mode === 'both'
  );

  // If only AI tags exist, we need a valid AI config
  const hasRuleTags = ruleTags.length > 0;
  const hasAiTags = aiTags.length > 0;

  if (hasAiTags && (!config.apiKey || !config.baseUrl || !config.modelName)) {
    // No valid AI config — can still process rule-only tags
    if (!hasRuleTags) {
      return stats;
    }
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

  // Determine if AI is available for this batch
  const aiAvailable = hasAiTags && config.apiKey && config.baseUrl && config.modelName;
  if (aiAvailable) {
    initTaggingClient();
  }

  for (const entry of candidates) {
    const matchedTagIds = new Set<string>();

    // Step 1: Run rule matching (instant, no cost)
    if (hasRuleTags) {
      const ruleMatched = runRuleMatchingForEntry(
        { title: entry.title || '', summary: entry.summary },
        ruleTags
      );
      for (const id of ruleMatched) {
        matchedTagIds.add(id);
      }
    }

    // Step 2: Run AI matching
    let aiFailed = false;
    if (aiAvailable) {
      const result = await analyzeEntryTags(
        {
          title: entry.title || '',
          summary: entry.summary,
          content: entry.content,
        },
        aiTags
      );

      if (result.success) {
        for (const id of result.tagIds) {
          matchedTagIds.add(id);
        }
      } else {
        aiFailed = true;
      }
    }

    // If AI failed and no rule matches, keep pending for retry
    if (aiFailed && matchedTagIds.size === 0) {
      stats.failed += 1;
      analysisRepo.updateStatus(entry.id, 'pending', config.tagsVersion);
      continue;
    }

    // Step 3: Save merged results
    entryTagRepo.removeAllTags(entry.id);
    if (matchedTagIds.size > 0) {
      entryTagRepo.addTags(entry.id, Array.from(matchedTagIds), false);
      stats.tagged += 1;
    } else {
      stats.untagged += 1;
    }

    analysisRepo.updateStatus(entry.id, 'analyzed', config.tagsVersion);
    stats.processed += 1;
  }

  return stats;
}
