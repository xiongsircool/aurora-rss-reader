import { initDatabase } from './init.js';
import { FeedRepository, EntryRepository, TranslationRepository, SummaryRepository, FetchLogRepository } from './repositories/index.js';

// Initialize database
initDatabase();

// Test Feed Repository
console.log('Testing FeedRepository...');
const feedRepo = new FeedRepository();

const feed = feedRepo.create({
  url: 'https://example.com/feed.xml',
  title: 'Test Feed',
  group_name: 'test',
});
console.log('✓ Created feed:', feed.id);

const foundFeed = feedRepo.findById(feed.id);
console.log('✓ Found feed:', foundFeed?.title);

feedRepo.update(feed.id, { title: 'Updated Feed' });
console.log('✓ Updated feed');

// Test Entry Repository
console.log('\nTesting EntryRepository...');
const entryRepo = new EntryRepository();

const entry = entryRepo.create({
  feed_id: feed.id,
  guid: 'test-guid-1',
  title: 'Test Entry',
  url: 'https://example.com/entry1',
});
console.log('✓ Created entry:', entry.id);

entryRepo.markAsRead(entry.id);
console.log('✓ Marked entry as read');

const unreadCount = entryRepo.countUnread();
console.log('✓ Unread count:', unreadCount);

// Test Translation Repository
console.log('\nTesting TranslationRepository...');
const translationRepo = new TranslationRepository();

const translation = translationRepo.create({
  entry_id: entry.id,
  language: 'zh',
  title: '测试条目',
  summary: '这是一个测试摘要',
});
console.log('✓ Created translation:', translation.id);

// Test Summary Repository
console.log('\nTesting SummaryRepository...');
const summaryRepo = new SummaryRepository();

const summary = summaryRepo.create({
  entry_id: entry.id,
  language: 'zh',
  summary: 'AI生成的摘要',
});
console.log('✓ Created summary:', summary.id);

// Test FetchLog Repository
console.log('\nTesting FetchLogRepository...');
const fetchLogRepo = new FetchLogRepository();

const fetchLog = fetchLogRepo.create({
  feed_id: feed.id,
  status: 'success',
  message: 'Fetched 10 items',
});
console.log('✓ Created fetch log:', fetchLog.id);

fetchLogRepo.update(fetchLog.id, {
  finished_at: new Date().toISOString(),
  duration_ms: 1500,
  item_count: 10,
});
console.log('✓ Updated fetch log');

// Cleanup (delete in correct order due to foreign keys)
console.log('\nCleaning up...');
translationRepo.delete(translation.id);
summaryRepo.delete(summary.id);
fetchLogRepo.delete(fetchLog.id);
entryRepo.delete(entry.id);
feedRepo.delete(feed.id);
console.log('✓ All tests passed!');
