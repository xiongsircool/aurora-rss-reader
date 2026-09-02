import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { initDatabase } from '../db/init.js';
import { closeDatabase, getDatabase } from '../db/session.js';
import { getConfig } from '../config/index.js';

type FeedSeed = {
  id: string;
  title: string;
  url: string;
  group: string;
  viewType: 'articles' | 'social' | 'pictures' | 'videos' | 'audio' | 'notifications';
};

const CONFIRM_FLAG = '--confirm-reset';
const confirmReset = process.argv.includes(CONFIRM_FLAG);
const config = getConfig();

if (!confirmReset) {
  console.error(`Refusing to reset data without ${CONFIRM_FLAG}.`);
  console.error(`Target database: ${config.databasePath}`);
  console.error(`Run: npm run db:reset-dev -- ${CONFIRM_FLAG}`);
  process.exit(1);
}

if (config.nodeEnv === 'production') {
  console.error('Refusing to reset data while NODE_ENV=production.');
  process.exit(1);
}

const feeds: FeedSeed[] = [
  { id: 'dev-feed-articles', title: 'Aurora 技术文章', url: 'https://example.com/aurora-dev/articles.xml', group: '开发测试', viewType: 'articles' },
  { id: 'dev-feed-pictures', title: '设计图集', url: 'https://example.com/aurora-dev/pictures.xml', group: '媒体测试', viewType: 'pictures' },
  { id: 'dev-feed-videos', title: '视频观察', url: 'https://example.com/aurora-dev/videos.xml', group: '媒体测试', viewType: 'videos' },
  { id: 'dev-feed-audio', title: '播客精选', url: 'https://example.com/aurora-dev/audio.xml', group: '媒体测试', viewType: 'audio' },
  { id: 'dev-feed-social', title: '社区动态', url: 'https://example.com/aurora-dev/social.xml', group: '开发测试', viewType: 'social' },
  { id: 'dev-feed-notifications', title: '产品通知', url: 'https://example.com/aurora-dev/notifications.xml', group: '开发测试', viewType: 'notifications' },
];

const titlesByType: Record<FeedSeed['viewType'], string[]> = {
  articles: ['端上 RSS 解析架构说明', '本地优先的数据模型设计', 'SQLite 查询性能记录', '跨端阅读器的状态管理', '全文提取兼容性测试', '移动端发布检查清单'],
  pictures: ['城市光影图集', '山野晨雾摄影', '移动界面视觉探索', '信息密度排版练习', '阅读主题色彩样本', '图片懒加载测试集'],
  videos: ['移动端架构讨论', 'RSS 解析流程演示', '阅读器性能优化实录', '本地数据库迁移讲解', '视频卡片兼容性测试', '跨端发布流程回顾'],
  audio: ['产品设计周报', '独立开发者访谈', 'RSS 生态观察', '移动性能专题', '本地优先软件讨论', '开源项目维护记录'],
  social: ['开发日志：完成统计面板', '移动端方案重新评估', '今日修复 Feed 图片解析', '测试数据基线已更新', '准备 Android 与 iOS 验证', '鸿蒙适配进入长期规划'],
  notifications: ['测试环境初始化完成', '数据库迁移验证通过', '后台自动任务已暂停', '阅读统计开始记录', '开发数据备份已创建', 'v0.2 测试基线可用'],
};

function isoDaysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function entryContent(feed: FeedSeed, title: string, index: number): string {
  if (feed.viewType === 'pictures') {
    return `<p>${title}，用于验证图像订阅布局、图片比例和懒加载。</p><img src="https://picsum.photos/seed/aurora-${index}/1200/800" alt="${title}">`;
  }
  if (feed.viewType === 'videos') {
    return `<p>${title}，用于验证视频链接识别、封面和跳转行为。</p>`;
  }
  if (feed.viewType === 'audio') {
    return `<p>${title}，用于验证播客播放器、时长和播放状态。</p>`;
  }
  return `<h2>${title}</h2><p>这是可重复生成的 Aurora 开发测试内容，用于验证排版、搜索、摘要和阅读状态。</p><p>数据完全保存在本地测试数据库中。</p>`;
}

async function main() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  initDatabase();
  const db = getDatabase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dirname(config.databasePath), `aurora-rss.db.backup-before-dev-reset-${timestamp}`);

  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`Creating backup: ${backupPath}`);
  await db.backup(backupPath);

  const reset = db.transaction(() => {
    db.prepare('DELETE FROM scope_summary_chunks').run();
    db.prepare('DELETE FROM scope_summary_runs').run();
    db.prepare('DELETE FROM aggregate_digests').run();
    db.prepare('DELETE FROM digest_tag_summaries').run();
    db.prepare('DELETE FROM summary_generation_jobs').run();
    db.prepare('DELETE FROM article_extraction_jobs').run();
    db.prepare('DELETE FROM collection_entries').run();
    db.prepare('DELETE FROM entry_tags').run();
    db.prepare('DELETE FROM entry_analysis_status').run();
    db.prepare('DELETE FROM translations').run();
    db.prepare('DELETE FROM summaries').run();
    db.prepare('DELETE FROM fetch_logs').run();
    db.prepare('DELETE FROM vss_rss_vectors').run();
    db.prepare('DELETE FROM rss_vectors').run();
    db.prepare('DELETE FROM entries').run();
    db.prepare('DELETE FROM feeds').run();
    db.prepare("DELETE FROM ai_automation_rules WHERE scope_type IN ('feed', 'group')").run();

    // Keep credentials and display preferences while preventing background jobs
    // from mutating the deterministic development fixture.
    db.prepare(`
      UPDATE user_settings SET
        auto_refresh = 0,
        ai_auto_summary = 0,
        ai_auto_title_translation = 0,
        ai_auto_tagging = 0,
        summary_background_enabled = 0,
        scope_summary_auto_generate = 0,
        updated_at = ?
      WHERE id = 1
    `).run(new Date().toISOString());

    const insertFeed = db.prepare(`
      INSERT INTO feeds (
        id, url, title, site_url, description, group_name, view_type,
        update_interval_minutes, last_checked_at, created_at, updated_at
      ) VALUES (
        @id, @url, @title, @siteUrl, @description, @group, @viewType,
        10080, @now, @now, @now
      )
    `);

    const now = new Date().toISOString();
    for (const feed of feeds) {
      insertFeed.run({
        ...feed,
        siteUrl: 'https://example.com/aurora-dev',
        description: `${feed.title}的本地开发测试订阅源`,
        now,
      });
    }

    const insertEntry = db.prepare(`
      INSERT INTO entries (
        id, feed_id, guid, title, url, author, summary, content,
        readability_content, categories_json, published_at, inserted_at,
        read, read_at, starred, enclosure_url, enclosure_type, duration,
        image_url, content_extraction_status, content_extracted_at,
        content_source_url
      ) VALUES (
        @id, @feedId, @guid, @title, @url, @author, @summary, @content,
        @readabilityContent, @categoriesJson, @publishedAt, @insertedAt,
        @read, @readAt, @starred, @enclosureUrl, @enclosureType, @duration,
        @imageUrl, 'succeeded', @contentExtractedAt, @contentSourceUrl
      )
    `);

    const entryIds: string[] = [];
    let globalIndex = 0;
    for (const feed of feeds) {
      for (let index = 0; index < 6; index++) {
        const id = `dev-entry-${feed.viewType}-${index + 1}`;
        const title = titlesByType[feed.viewType][index];
        const daysAgo = (globalIndex * 3) % 30;
        const publishedAt = isoDaysAgo(daysAgo, 8 + (index % 8));
        const isRead = globalIndex % 3 !== 0;
        const content = entryContent(feed, title, globalIndex);
        const isPicture = feed.viewType === 'pictures';
        const isVideo = feed.viewType === 'videos';
        const isAudio = feed.viewType === 'audio';
        const articleUrl = isVideo
          ? `https://www.youtube.com/watch?v=${index % 2 === 0 ? 'dQw4w9WgXcQ' : 'aqz-KE-bpKQ'}`
          : `https://example.com/aurora-dev/${feed.viewType}/${index + 1}`;

        insertEntry.run({
          id,
          feedId: feed.id,
          guid: `aurora-dev-${feed.viewType}-${index + 1}`,
          title,
          url: articleUrl,
          author: feed.viewType === 'social' ? `测试用户 ${index + 1}` : 'Aurora Dev Fixture',
          summary: `${title}的测试摘要，用于检查时间线摘要、详情页和阅读统计。`,
          content,
          readabilityContent: content,
          categoriesJson: JSON.stringify([feed.group, feed.viewType]),
          publishedAt,
          insertedAt: publishedAt,
          read: isRead ? 1 : 0,
          readAt: isRead ? isoDaysAgo(Math.max(0, daysAgo - 1), 18) : null,
          starred: globalIndex % 7 === 0 ? 1 : 0,
          enclosureUrl: isAudio ? `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(index % 3) + 1}.mp3` : null,
          enclosureType: isAudio ? 'audio/mpeg' : null,
          duration: isAudio ? `${24 + index}:00` : null,
          imageUrl: isPicture ? `https://picsum.photos/seed/aurora-${globalIndex}/1200/800` : null,
          contentExtractedAt: publishedAt,
          contentSourceUrl: articleUrl,
        });
        entryIds.push(id);
        globalIndex++;
      }
    }

    const insertSummary = db.prepare(`
      INSERT INTO summaries (id, entry_id, language, summary, created_at)
      VALUES (?, ?, 'zh', ?, ?)
    `);
    for (const [index, entryId] of entryIds.slice(0, 8).entries()) {
      insertSummary.run(`dev-summary-${index + 1}`, entryId, `这是第 ${index + 1} 篇测试文章的本地 AI 摘要缓存。`, now);
    }

    const testTags = [
      { id: 'dev-tag-mobile', name: '移动端', color: '#10b981' },
      { id: 'dev-tag-ai', name: 'AI', color: '#8b5cf6' },
      { id: 'dev-tag-performance', name: '性能', color: '#f59e0b' },
    ];
    const insertTag = db.prepare(`
      INSERT INTO user_tags (id, name, description, color, sort_order, enabled, match_mode, created_at, updated_at)
      VALUES (@id, @name, 'Aurora 开发测试标签', @color, @sortOrder, 1, 'manual', @now, @now)
      ON CONFLICT(name) DO NOTHING
    `);
    for (const [index, tag] of testTags.entries()) {
      insertTag.run({ ...tag, sortOrder: 100 + index, now });
    }

    const tagRows = db.prepare(`SELECT id FROM user_tags WHERE name IN ('移动端', 'AI', '性能') ORDER BY name`).all() as Array<{ id: string }>;
    const insertEntryTag = db.prepare(`
      INSERT OR IGNORE INTO entry_tags (entry_id, tag_id, is_manual, created_at)
      VALUES (?, ?, 1, ?)
    `);
    for (const [index, entryId] of entryIds.entries()) {
      if (index % 2 === 0 && tagRows.length > 0) {
        insertEntryTag.run(entryId, tagRows[index % tagRows.length].id, now);
      }
    }

    db.prepare(`
      INSERT OR IGNORE INTO collections (id, name, icon, color, sort_order, created_at, updated_at)
      VALUES ('dev-collection', '开发测试收藏', 'folder', '#ff7a18', 100, ?, ?)
    `).run(now, now);
    const insertCollectionEntry = db.prepare(`
      INSERT OR IGNORE INTO collection_entries (collection_id, entry_id, added_at, note)
      VALUES ('dev-collection', ?, ?, '自动生成的开发测试收藏')
    `);
    for (const entryId of entryIds.slice(0, 5)) {
      insertCollectionEntry.run(entryId, now);
    }
  });

  try {
    reset();
    db.exec(`INSERT INTO entries_fts(entries_fts) VALUES ('rebuild')`);
    db.exec('ANALYZE');
    console.log('Compacting database...');
    db.exec('VACUUM');

    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM feeds) AS feeds,
        (SELECT COUNT(*) FROM entries) AS entries,
        (SELECT COUNT(*) FROM entries WHERE read = 1) AS read_entries,
        (SELECT COUNT(*) FROM entries WHERE starred = 1) AS starred_entries,
        (SELECT COUNT(*) FROM summaries) AS summaries
    `).get();

    console.log('Development data reset completed.');
    console.log(counts);
    console.log(`Backup: ${backupPath}`);
  } finally {
    closeDatabase();
  }
}

main().catch((error) => {
  console.error('Development data reset failed:', error);
  closeDatabase();
  process.exit(1);
});
