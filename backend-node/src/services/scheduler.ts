/**
 * Background Scheduler Service
 * Handles periodic RSS feed refreshing using node-cron
 */

import cron from 'node-cron';
import { FeedRepository } from '../db/repositories/index.js';
import { refreshFeed } from './fetcher.js';
import { UserSettingsService } from './userSettings.js';
import { syncEntriesToVectorDB } from './vector.js';
import { runAutoTaggingBatch } from './autoTagging.js';

export class SchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private feedRepo: FeedRepository;
  private settingsService: UserSettingsService;

  constructor() {
    this.feedRepo = new FeedRepository();
    this.settingsService = new UserSettingsService();
  }

  /**
   * Start the scheduler
   * Runs every 5 minutes to check for feeds that need refreshing
   */
  start() {
    if (this.cronJob) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.checkAndRefreshFeeds();
    });

    console.log('✅ Scheduler started (runs every 5 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 Scheduler stopped');
    }
  }

  /**
   * Check which feeds need refreshing and refresh them
   */
  private async checkAndRefreshFeeds() {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('⏭️  Skipping scheduler run (previous run still in progress)');
      return;
    }

    this.isRunning = true;

    try {
      // Check if auto-refresh is enabled
      const settings = this.settingsService.getSettings();
      if (!settings.auto_refresh) {
        console.log('⏸️  Auto-refresh is disabled, skipping');
        return;
      }

      const feeds = this.feedRepo.findAll();
      const now = new Date();
      let refreshedCount = 0;
      let errorCount = 0;

      for (const feed of feeds) {
        try {
          // Check if feed needs refreshing
          if (this.shouldRefreshFeed(feed, now)) {
            console.log(`🔄 Refreshing feed: ${feed.title || feed.url}`);
            const result = await refreshFeed(feed.id);

            if (result.success) {
              refreshedCount++;
              console.log(`✅ Refreshed: ${feed.title || feed.url} (${result.itemCount} new items)`);
            } else {
              errorCount++;
              console.log(`❌ Failed to refresh: ${feed.title || feed.url} - ${result.error}`);
            }
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error refreshing feed ${feed.id}:`, error);
        }
      }

      if (refreshedCount > 0 || errorCount > 0) {
        console.log(`📊 Scheduler run complete: ${refreshedCount} refreshed, ${errorCount} errors`);
      }

      // Sync vectors for new content
      // Runs every scheduler loop
      try {
        await syncEntriesToVectorDB(20); // Sync up to 20 items per loop
      } catch (e) {
        console.error('❌ Vector sync error:', e);
      }

      // Auto-tag new entries (if enabled)
      try {
        const tagStats = await runAutoTaggingBatch({ limit: 20 });
        if (tagStats.processed > 0 || tagStats.failed > 0) {
          console.log(
            `🏷️  Auto tagging: ${tagStats.processed} processed (${tagStats.tagged} tagged, ${tagStats.untagged} untagged), ${tagStats.failed} failed`
          );
        }
      } catch (e) {
        console.error('❌ Auto tagging error:', e);
      }

    } catch (error) {
      console.error('❌ Scheduler error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Determine if a feed should be refreshed based on its last check time and update interval
   */
  private shouldRefreshFeed(feed: any, now: Date): boolean {
    // If never checked, refresh it
    if (!feed.last_checked_at) {
      return true;
    }

    // Get the feed's update interval (default to global setting if not set)
    const settings = this.settingsService.getSettings();
    const updateIntervalMinutes = feed.update_interval_minutes || settings.fetch_interval_minutes;

    // Calculate time since last check
    const lastChecked = new Date(feed.last_checked_at);
    const minutesSinceLastCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60);

    // Refresh if enough time has passed
    return minutesSinceLastCheck >= updateIntervalMinutes;
  }

  /**
   * Manually trigger a refresh check (useful for testing)
   */
  async triggerRefresh() {
    console.log('🔄 Manually triggering feed refresh check');
    await this.checkAndRefreshFeeds();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.cronJob !== null,
      isRefreshing: this.isRunning,
    };
  }
}

// Global scheduler instance
export const scheduler = new SchedulerService();
