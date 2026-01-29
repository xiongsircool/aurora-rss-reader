/**
 * Migration script to backfill enclosure data for existing entries
 * Run with: npx tsx src/scripts/backfill-enclosures.ts
 */

import Parser from 'rss-parser';
import { getDatabase } from '../db/session.js';
import { initDatabase } from '../db/init.js';
import { loadConfig } from '../config/index.js';

// Load config first to initialize database path
loadConfig();

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; AuroraRSS/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['enclosure', 'enclosure'],
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['itunes:duration', 'itunes:duration'],
      ['itunes:image', 'itunes:image'],
    ],
  },
});

interface EnclosureData {
  url: string;
  type: string | null;
  length: number | null;
}

function extractEnclosure(item: any): EnclosureData | null {
  if (item.enclosure) {
    const enc = item.enclosure;
    const url = enc.url || enc.href || enc;
    if (typeof url === 'string' && url.startsWith('http')) {
      return {
        url,
        type: enc.type || null,
        length: enc.length ? parseInt(enc.length, 10) : null,
      };
    }
  }

  if (item['media:content']) {
    const media = item['media:content'];
    const url = media.url || media.$?.url;
    if (url) {
      return {
        url,
        type: media.type || media.$?.type || null,
        length: media.fileSize ? parseInt(media.fileSize, 10) : null,
      };
    }
  }

  return null;
}

function extractDuration(item: any): string | null {
  if (item.itunes?.duration) {
    return String(item.itunes.duration);
  }
  if (item['itunes:duration']) {
    return String(item['itunes:duration']);
  }
  return null;
}

function extractImageUrl(item: any, feedData: any): string | null {
  if (item.itunes?.image) {
    const img = item.itunes.image;
    return typeof img === 'string' ? img : img.href || img.url || null;
  }
  if (item['itunes:image']) {
    const img = item['itunes:image'];
    return typeof img === 'string' ? img : img.$?.href || null;
  }

  if (item['media:thumbnail']) {
    const thumb = item['media:thumbnail'];
    return thumb.url || thumb.$?.url || null;
  }

  if (feedData?.itunes?.image) {
    const img = feedData.itunes.image;
    return typeof img === 'string' ? img : img.href || img.url || null;
  }
  if (feedData?.image?.url) {
    return feedData.image.url;
  }

  return null;
}

async function backfillEnclosures() {
  console.log('Starting enclosure backfill migration...\n');

  // Initialize database
  initDatabase();
  const db = getDatabase();

  // Get all audio feeds
  const feeds = db
    .prepare("SELECT id, url, title FROM feeds WHERE view_type = 'audio'")
    .all() as Array<{ id: string; url: string; title: string | null }>;

  console.log(`Found ${feeds.length} audio feeds to process\n`);

  let totalUpdated = 0;

  for (const feed of feeds) {
    console.log(`\nProcessing: ${feed.title || feed.url}`);

    try {
      const feedData = await parser.parseURL(feed.url);
      console.log(`  Fetched ${feedData.items?.length || 0} items from RSS`);

      // Build a map of guid -> enclosure data
      const enclosureMap = new Map<string, {
        enclosure: EnclosureData | null;
        duration: string | null;
        imageUrl: string | null;
      }>();

      for (const item of feedData.items || []) {
        const guid = item.guid || item.link || item.title || '';
        if (!guid) continue;

        enclosureMap.set(guid, {
          enclosure: extractEnclosure(item),
          duration: extractDuration(item),
          imageUrl: extractImageUrl(item, feedData),
        });
      }

      // Get existing entries without enclosure data
      const entries = db
        .prepare(
          `SELECT id, guid FROM entries
           WHERE feed_id = ? AND enclosure_url IS NULL`
        )
        .all(feed.id) as Array<{ id: string; guid: string }>;

      console.log(`  Found ${entries.length} entries without enclosure data`);

      // Update entries with enclosure data
      const updateStmt = db.prepare(`
        UPDATE entries
        SET enclosure_url = ?, enclosure_type = ?, enclosure_length = ?,
            duration = ?, image_url = ?
        WHERE id = ?
      `);

      let feedUpdated = 0;
      for (const entry of entries) {
        const data = enclosureMap.get(entry.guid);
        if (data?.enclosure) {
          updateStmt.run(
            data.enclosure.url,
            data.enclosure.type,
            data.enclosure.length,
            data.duration,
            data.imageUrl,
            entry.id
          );
          feedUpdated++;
        }
      }

      console.log(`  Updated ${feedUpdated} entries`);
      totalUpdated += feedUpdated;
    } catch (error) {
      console.error(`  Error processing feed: ${error}`);
    }
  }

  console.log(`\n✅ Migration complete! Updated ${totalUpdated} entries total.`);
}

backfillEnclosures().catch(console.error);
