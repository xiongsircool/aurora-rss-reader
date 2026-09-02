import { randomBytes } from 'node:crypto';
import { AIClient } from './ai.js';
import { getConfig } from '../config/index.js';
import { Entry, Feed, SummaryGenerationJob } from '../db/models.js';
import {
  EntryRepository,
  FeedRepository,
  SummaryGenerationJobRepository,
  SummaryRepository,
} from '../db/repositories/index.js';
import { getDatabase } from '../db/session.js';
import { userSettingsService } from './userSettings.js';
import { aiAutomationResolver } from './aiAutomationResolver.js';
import { runWithConcurrency } from '../utils/concurrency.js';
import { normalizeTimeField, parseRelativeTime } from '../utils/dateRange.js';

const SUMMARY_CONCURRENCY = 2;
const SUMMARY_MAX_ATTEMPTS = 3;
const SUMMARY_LEASE_TIMEOUT_MS = 10 * 60 * 1000;
const SUMMARY_BACKOFF_MS = [5 * 60 * 1000, 30 * 60 * 1000, 6 * 60 * 60 * 1000];
const SUMMARY_ENQUEUE_SCAN_LIMIT = 30;

function normalizeSummaryLanguage(language?: string | null): string {
  const value = (language || '').trim().toLowerCase();
  if (!value) return 'zh';
  return value;
}

function resolveSummaryClient() {
  const settings = userSettingsService.getSettings();
  const config = getConfig();
  const useCustom = settings.summary_use_custom === 1;
  const baseUrl = (useCustom ? settings.summary_base_url : settings.default_ai_base_url) || config.glmBaseUrl || '';
  const apiKey = (useCustom ? settings.summary_api_key : settings.default_ai_api_key) || config.glmApiKey || '';
  const modelName = (useCustom ? settings.summary_model_name : settings.default_ai_model) || config.glmModel || '';

  return new AIClient({ baseUrl, apiKey, model: modelName });
}

function buildSummaryContent(entry: {
  title?: string | null;
  author?: string | null;
  published_at?: string | null;
  readability_content?: string | null;
  content?: string | null;
  summary?: string | null;
}): string | null {
  const content = entry.readability_content || entry.content || entry.summary;
  if (!content) {
    return null;
  }

  const metaLines: string[] = [];
  if (entry.title) metaLines.push(`Title: ${entry.title}`);
  if (entry.author) metaLines.push(`Author: ${entry.author}`);
  if (entry.published_at) metaLines.push(`Published: ${entry.published_at}`);

  if (!metaLines.length) {
    return content;
  }

  return `Metadata:\n${metaLines.join('\n')}\n\nContent:\n${content}`;
}

function shouldRunForFeed(feed: Feed | null | undefined): boolean {
  if (!feed) return false;
  return aiAutomationResolver.resolve({
    taskKey: 'entry_summary',
    scopeType: 'feed',
    scopeId: feed.id,
    feedId: feed.id,
    groupName: feed.group_name,
  });
}

function resolveBackgroundScanRange(now: Date = new Date()): {
  cutoffIso: string | null;
  nowIso: string;
  dateRange: string;
  timeField: 'published_at' | 'inserted_at';
} {
  const settings = userSettingsService.getSettings();
  const timeField = normalizeTimeField(settings.time_field);
  const cutoff = parseRelativeTime(settings.default_date_range, now);
  return {
    cutoffIso: cutoff ? cutoff.toISOString() : null,
    nowIso: now.toISOString(),
    dateRange: settings.default_date_range,
    timeField,
  };
}

export interface SummaryBackgroundStatus {
  enabled: boolean;
  language: string;
  range: {
    date_range: string;
    time_field: 'published_at' | 'inserted_at';
    cutoff_at: string | null;
  };
  queue: {
    eligible_in_range: number;
    queued: number;
    running: number;
    failed: number;
    succeeded: number;
  };
  activity: {
    summaries_total: number;
    summaries_last_24h: number;
    jobs_last_24h: number;
    last_job_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_error: string | null;
  };
}

export class SummaryGenerationService {
  private db = getDatabase();
  private entryRepo = new EntryRepository();
  private feedRepo = new FeedRepository();
  private summaryRepo = new SummaryRepository();
  private jobRepo = new SummaryGenerationJobRepository();
  private pumpPromise: Promise<void> | null = null;
  private leaseOwner = `${process.pid}-${randomBytes(4).toString('hex')}`;

  isEnabled(): boolean {
    return userSettingsService.getSettings().summary_background_enabled === 1;
  }

  getTargetLanguage(): string {
    const settings = userSettingsService.getSettings();
    return normalizeSummaryLanguage(settings.ai_translation_language || settings.language || 'zh');
  }

  enqueueEntry(entry: Entry, options: { language?: string | null } = {}): void {
    if (!this.isEnabled() || entry.read === 1) {
      return;
    }

    const feed = this.feedRepo.findById(entry.feed_id);
    if (!shouldRunForFeed(feed)) {
      return;
    }

    const language = normalizeSummaryLanguage(options.language || this.getTargetLanguage());
    if (this.summaryRepo.findByEntryIdAndLanguage(entry.id, language)?.summary) {
      return;
    }

    const existingJob = this.jobRepo.findByEntryIdAndLanguage(entry.id, language);
    if (existingJob?.status === 'queued' || existingJob?.status === 'running') {
      return;
    }
    if (existingJob?.status === 'failed' && existingJob.attempts >= existingJob.max_attempts) {
      return;
    }

    if (!buildSummaryContent(entry)) {
      return;
    }

    this.jobRepo.createOrReset({
      entry_id: entry.id,
      language,
      max_attempts: SUMMARY_MAX_ATTEMPTS,
    });
  }

  ensurePendingJobs(limit: number = SUMMARY_ENQUEUE_SCAN_LIMIT): number {
    if (!this.isEnabled()) {
      return 0;
    }

    const language = this.getTargetLanguage();
    const range = resolveBackgroundScanRange();
    const rangeWhere: string[] = [];
    const rangeParams: Array<string | number> = [];
    if (range.cutoffIso) {
      if (range.timeField === 'published_at') {
        rangeWhere.push(
          '((e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?) OR (e.published_at IS NULL AND e.inserted_at >= ?))'
        );
        rangeParams.push(range.nowIso, range.cutoffIso, range.cutoffIso);
      } else {
        rangeWhere.push('e.inserted_at >= ?');
        rangeParams.push(range.cutoffIso);
      }
    }

    const rangeSql = rangeWhere.length > 0 ? `\n        AND ${rangeWhere.join(' AND ')}` : '';
    const rows = this.db.prepare(`
      SELECT
        e.id,
        e.feed_id,
        e.guid,
        e.title,
        e.url,
        e.title_translations,
        e.author,
        e.summary,
        e.content,
        e.readability_content,
        e.categories_json,
        e.published_at,
        e.inserted_at,
        e.read,
        e.starred,
        e.enclosure_url,
        e.enclosure_type,
        e.enclosure_length,
        e.duration,
        e.image_url,
        e.doi,
        e.pmid,
        e.content_extraction_status,
        e.content_extraction_error,
        e.content_extracted_at,
        e.content_source_url
      FROM entries e
      LEFT JOIN summaries s
        ON s.entry_id = e.id AND s.language = ?
      WHERE e.read = 0
        AND COALESCE(e.readability_content, e.content, e.summary) IS NOT NULL
        AND (s.id IS NULL OR COALESCE(s.summary, '') = '')
        ${rangeSql}
      ORDER BY e.inserted_at ASC
      LIMIT ?
    `).all(language, ...rangeParams, limit) as Entry[];

    let enqueued = 0;
    for (const entry of rows) {
      const before = this.jobRepo.findByEntryIdAndLanguage(entry.id, language);
      this.enqueueEntry(entry, { language });
      const after = this.jobRepo.findByEntryIdAndLanguage(entry.id, language);
      if (!before && after) {
        enqueued += 1;
      }
    }

    return enqueued;
  }

  getBackgroundStatus(): SummaryBackgroundStatus {
    const language = this.getTargetLanguage();
    const range = resolveBackgroundScanRange();

    const rangeWhere: string[] = [];
    const rangeParams: Array<string | number> = [];
    if (range.cutoffIso) {
      if (range.timeField === 'published_at') {
        rangeWhere.push(
          '((e.published_at IS NOT NULL AND e.published_at <= ? AND e.published_at >= ?) OR (e.published_at IS NULL AND e.inserted_at >= ?))'
        );
        rangeParams.push(range.nowIso, range.cutoffIso, range.cutoffIso);
      } else {
        rangeWhere.push('e.inserted_at >= ?');
        rangeParams.push(range.cutoffIso);
      }
    }

    const rangeSql = rangeWhere.length > 0 ? ` AND ${rangeWhere.join(' AND ')}` : '';

    const eligible = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM entries e
      LEFT JOIN summaries s
        ON s.entry_id = e.id AND s.language = ?
      WHERE e.read = 0
        AND COALESCE(e.readability_content, e.content, e.summary) IS NOT NULL
        AND (s.id IS NULL OR COALESCE(s.summary, '') = '')
        ${rangeSql}
    `).get(language, ...rangeParams) as { count: number };

    const queueRows = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM summary_generation_jobs
      GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    const queue = {
      eligible_in_range: eligible.count,
      queued: 0,
      running: 0,
      failed: 0,
      succeeded: 0,
    };

    for (const row of queueRows) {
      if (row.status === 'queued') queue.queued = row.count;
      if (row.status === 'running') queue.running = row.count;
      if (row.status === 'failed') queue.failed = row.count;
      if (row.status === 'succeeded') queue.succeeded = row.count;
    }

    const summariesTotal = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM summaries
      WHERE language = ?
    `).get(language) as { count: number };

    const summariesLastDay = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM summaries
      WHERE language = ?
        AND created_at >= datetime('now', '-1 day')
    `).get(language) as { count: number };

    const jobsLastDay = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM summary_generation_jobs
      WHERE language = ?
        AND created_at >= datetime('now', '-1 day')
    `).get(language) as { count: number };

    const lastJob = this.db.prepare(`
      SELECT created_at
      FROM summary_generation_jobs
      WHERE language = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(language) as { created_at: string } | undefined;

    const lastSuccess = this.db.prepare(`
      SELECT updated_at
      FROM summary_generation_jobs
      WHERE language = ?
        AND status = 'succeeded'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(language) as { updated_at: string } | undefined;

    const lastFailure = this.db.prepare(`
      SELECT updated_at, error
      FROM summary_generation_jobs
      WHERE language = ?
        AND status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(language) as { updated_at: string; error: string | null } | undefined;

    return {
      enabled: this.isEnabled(),
      language,
      range: {
        date_range: range.dateRange,
        time_field: range.timeField,
        cutoff_at: range.cutoffIso,
      },
      queue,
      activity: {
        summaries_total: summariesTotal.count,
        summaries_last_24h: summariesLastDay.count,
        jobs_last_24h: jobsLastDay.count,
        last_job_at: lastJob?.created_at ?? null,
        last_success_at: lastSuccess?.updated_at ?? null,
        last_failure_at: lastFailure?.updated_at ?? null,
        last_error: lastFailure?.error ?? null,
      },
    };
  }

  async pumpPendingJobs(limit: number = SUMMARY_CONCURRENCY): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.pumpPromise) {
      return this.pumpPromise;
    }

    this.pumpPromise = this.doPump(limit).finally(() => {
      this.pumpPromise = null;
    });

    return this.pumpPromise;
  }

  private async doPump(limit: number): Promise<void> {
    this.jobRepo.requeueExpiredRunningJobs(SUMMARY_LEASE_TIMEOUT_MS);

    while (true) {
      const jobs = this.jobRepo.leaseDueJobs(limit, this.leaseOwner);
      if (jobs.length === 0) {
        return;
      }

      await runWithConcurrency(jobs, limit, async (job) => {
        await this.processJob(job);
      });
    }
  }

  private async processJob(job: SummaryGenerationJob): Promise<void> {
    const entry = this.entryRepo.findById(job.entry_id);
    if (!entry) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    if (entry.read === 1) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    const existing = this.summaryRepo.findByEntryIdAndLanguage(job.entry_id, job.language);
    if (existing?.summary) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    const feed = this.feedRepo.findById(entry.feed_id);
    if (!shouldRunForFeed(feed)) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    const content = buildSummaryContent(entry);
    if (!content) {
      this.jobRepo.markSucceeded(job.id);
      return;
    }

    try {
      const client = resolveSummaryClient();
      const settings = userSettingsService.getSettings();
      const userPreference = settings.summary_prompt_preference || '';
      const maxTokens = settings.ai_summary_max_tokens || 0;
      const summary = await client.summarize(content, {
        language: job.language,
        userPreference,
        maxTokens,
      });

      this.summaryRepo.upsert({
        entry_id: job.entry_id,
        language: job.language,
        summary,
      });
      this.jobRepo.markSucceeded(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextRunAt = job.attempts < job.max_attempts
        ? new Date(Date.now() + SUMMARY_BACKOFF_MS[Math.min(job.attempts - 1, SUMMARY_BACKOFF_MS.length - 1)]).toISOString()
        : null;

      this.jobRepo.markFailed(job.id, message, nextRunAt);
    }
  }
}

export const summaryGenerationService = new SummaryGenerationService();
