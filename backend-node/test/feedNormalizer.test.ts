import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDoi, extractPmid, normalizeFeedItem, parseDate } from '../src/services/feedNormalizer.js';

test('parses unix timestamp dates', () => {
  assert.equal(parseDate('1710000000'), '2024-03-09T16:00:00.000Z');
  assert.equal(parseDate('1710000000000'), '2024-03-09T16:00:00.000Z');
});

test('extracts doi from dc identifier and url', () => {
  assert.equal(extractDoi({ 'dc:identifier': 'doi:10.1038/test-doi' }), '10.1038/test-doi');
  assert.equal(extractDoi({ link: 'https://doi.org/10.1000/xyz-123' }), '10.1000/xyz-123');
});

test('extracts pmid from dc identifier and url', () => {
  assert.equal(extractPmid({ 'dc:identifier': 'pmid:123456' }), '123456');
  assert.equal(extractPmid({ link: 'https://pubmed.ncbi.nlm.nih.gov/987654/' }), '987654');
});

test('normalizes image url from RSSHub item HTML images', () => {
  const entry = normalizeFeedItem({
    feed: {
      id: 'feed-1',
      url: 'http://127.0.0.1:1200/bilibili/user/video/346563107',
      title: 'Bilibili',
      custom_title: null,
      group_name: 'default',
      view_type: 'videos',
      favicon_url: null,
      unread_count: 0,
      last_checked_at: null,
      last_error: null,
      fetch_etag: null,
      fetch_last_modified: null,
    } as any,
    feedData: {},
    siteUrl: 'https://space.bilibili.com/346563107',
    item: {
      guid: 'https://www.bilibili.com/video/BV1mGR1BVEvG',
      title: 'Bilibili video',
      link: 'https://www.bilibili.com/video/BV1mGR1BVEvG',
      pubDate: 'Tue, 05 May 2026 11:21:12 GMT',
      content: '<iframe src="https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=BV1mGR1BVEvG"></iframe><br><img src="https://i1.hdslb.com/bfs/archive/cover.jpg" referrerpolicy="no-referrer">',
    },
  });

  assert.equal(entry?.image_url, 'https://i1.hdslb.com/bfs/archive/cover.jpg');
});
