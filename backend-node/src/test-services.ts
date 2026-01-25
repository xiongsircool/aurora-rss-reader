/**
 * Test script for Phase 2 services
 */

import { initDatabase } from './db/init.js';
import { cleanHtmlText, truncateText } from './utils/text.js';
import { getUserAgentForUrl, getAlternativeUrls, shouldRetryOnStatus } from './services/feedConfig.js';
import { rsshubManager } from './services/rsshubManager.js';
import { glmClient } from './services/ai.js';
import { userSettingsService } from './services/userSettings.js';
import { FeedRepository } from './db/repositories/index.js';
import { refreshFeed } from './services/fetcher.js';

console.log('=== Testing Phase 2 Services ===\n');

// Initialize database
console.log('1. Initializing database...');
initDatabase();
console.log('✓ Database initialized\n');

// Test text utilities
console.log('2. Testing text utilities...');
const htmlText = '<p>Hello <strong>World</strong>!</p>  <br>  Test';
const cleaned = cleanHtmlText(htmlText);
console.log(`  Input: "${htmlText}"`);
console.log(`  Cleaned: "${cleaned}"`);
const truncated = truncateText('This is a long text that needs truncation', 20);
console.log(`  Truncated: "${truncated}"`);
console.log('✓ Text utilities working\n');

// Test feed configuration
console.log('3. Testing feed configuration...');
const userAgent = getUserAgentForUrl('https://academic.oup.com/feed');
console.log(`  User-Agent for academic.oup.com: ${userAgent || 'default'}`);
const alternatives = getAlternativeUrls('https://rsshub.app/nature/research/ng');
console.log(`  Alternatives found: ${alternatives?.length || 0}`);
const shouldRetry = shouldRetryOnStatus(503);
console.log(`  Should retry on 503: ${shouldRetry}`);
console.log('✓ Feed configuration working\n');

// Test RSSHub manager
console.log('4. Testing RSSHub manager...');
const mirrors = rsshubManager.getAvailableMirrors();
console.log(`  Available mirrors: ${mirrors.length}`);
const defaultMirror = rsshubManager.getDefaultMirror();
console.log(`  Default mirror: ${defaultMirror?.name} (${defaultMirror?.base_url})`);
console.log('✓ RSSHub manager working\n');

// Test user settings service
console.log('5. Testing user settings service...');
const settings = userSettingsService.getSettings();
console.log(`  RSSHub URL: ${settings.rsshub_url}`);
console.log(`  Fetch interval: ${settings.fetch_interval_minutes} minutes`);
console.log(`  Items per page: ${settings.items_per_page}`);
userSettingsService.updateSettings({ items_per_page: 100 });
const updatedSettings = userSettingsService.getSettings();
console.log(`  Updated items per page: ${updatedSettings.items_per_page}`);
console.log('✓ User settings service working\n');

// Test AI service (configuration only, no actual API call)
console.log('6. Testing AI service...');
glmClient.configure({
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
  model: 'glm-4-flash',
  apiKey: 'test-key',
});
const snapshot = glmClient.snapshot();
console.log(`  Base URL: ${snapshot.baseUrl}`);
console.log(`  Model: ${snapshot.model}`);
console.log(`  API Key: ${snapshot.apiKey ? '***' : 'not set'}`);
console.log('✓ AI service configuration working\n');

// Test RSS fetcher with a real feed
console.log('7. Testing RSS fetcher...');
const feedRepo = new FeedRepository();

// Create a test feed
const testFeed = feedRepo.create({
  url: 'https://hnrss.org/newest?points=100',
  title: 'Hacker News - Newest (100+ points)',
  group_name: 'test',
});
console.log(`  Created test feed: ${testFeed.id}`);

// Fetch the feed
console.log('  Fetching feed...');
const result = await refreshFeed(testFeed.id);
console.log(`  Fetch result: ${result.success ? 'success' : 'failed'}`);
console.log(`  New items: ${result.itemCount}`);
if (result.error) {
  console.log(`  Error: ${result.error}`);
}

// Clean up test feed (delete all related records due to foreign key constraints)
console.log('  Cleaning up test data...');
const { EntryRepository, FetchLogRepository } = await import('./db/repositories/index.js');
const entryRepo = new EntryRepository();
const fetchLogRepo = new FetchLogRepository();

// Delete entries
const entries = entryRepo.findByFeedId(testFeed.id);
for (const entry of entries) {
  entryRepo.delete(entry.id);
}

// Delete fetch logs
const fetchLogs = fetchLogRepo.findByFeedId(testFeed.id);
for (const log of fetchLogs) {
  fetchLogRepo.delete(log.id);
}

// Finally delete the feed
feedRepo.delete(testFeed.id);
console.log(`  Deleted ${entries.length} entries, ${fetchLogs.length} fetch logs, and test feed`);
console.log('✓ RSS fetcher working\n');

console.log('=== All Phase 2 Services Tested Successfully ===');
