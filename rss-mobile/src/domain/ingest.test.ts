/**
 * End-to-end ingest pipeline test (parse -> normalize -> classify -> present),
 * plus the dedup contract against an in-memory entry store stand-in.
 */
import { describe, expect, it } from 'vitest'
import { parseFeed } from './feedParser'
import { normalizeFeedItem } from './feedNormalizer'
import { classifyParsedEntry } from './contentType'
import { buildEntryPresentation } from './entryPresentation'
import type { NormalizedEntry } from '../data/models'

const FEED_URL = 'https://example.com/feed.xml'
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Mixed Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Long read</title>
      <link>https://example.com/a</link>
      <guid>a</guid>
      <pubDate>Tue, 10 Sep 2024 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>${'word '.repeat(600)}</p>]]></content:encoded>
    </item>
    <item>
      <title>Video post</title>
      <link>https://example.com/b</link>
      <guid>b</guid>
      <pubDate>Wed, 11 Sep 2024 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>]]></content:encoded>
    </item>
  </channel>
</rss>`

describe('ingest pipeline', () => {
  it('parses, normalizes, classifies and presents a mixed feed', () => {
    const feed = parseFeed(RSS)
    expect(feed.items).toHaveLength(2)

    const normalized = feed.items
      .map((item) => normalizeFeedItem(item, FEED_URL))
      .filter((n): n is NormalizedEntry => n !== null)
    expect(normalized).toHaveLength(2)

    normalized.forEach((n) => (n.content_type = classifyParsedEntry(n)))
    expect(normalized[0].content_type).toBe('article')
    expect(normalized[1].content_type).toBe('video')

    // Authoritative presentation agrees on the video classification.
    const present = buildEntryPresentation({
      id: 'b',
      title: normalized[1].title,
      url: normalized[1].url,
      summary: normalized[1].summary,
      content: normalized[1].content,
      readability_content: null,
      enclosure_url: null,
      enclosure_type: null,
      duration: null,
      image_url: normalized[1].image_url,
    })
    expect(present.content_type).toBe('video')
    expect(present.video?.platform).toBe('youtube')
  })

  it('dedups by (feed_id, guid) on re-ingest', () => {
    // Simulate EntryRepository.insertIfNew with INSERT OR IGNORE semantics.
    const store = new Set<string>()
    const insertIfNew = (feedId: string, guid: string): boolean => {
      const key = `${feedId}::${guid}`
      if (store.has(key)) return false
      store.add(key)
      return true
    }

    const feed = parseFeed(RSS)
    const ingest = () => {
      let inserted = 0
      for (const item of feed.items) {
        const n = normalizeFeedItem(item, FEED_URL)
        if (n && insertIfNew('feed-1', n.guid)) inserted += 1
      }
      return inserted
    }

    expect(ingest()).toBe(2) // first run inserts both
    expect(ingest()).toBe(0) // second run is fully deduped
    expect(store.size).toBe(2)
  })
})
