import { describe, expect, it } from 'vitest'
import { extractDateFromDescription, normalizeFeedItem, parseDate, selectFeedIcon } from './feedNormalizer'
import type { ParsedFeedItem } from './feedParser'

describe('parseDate', () => {
  it('parses RFC822 dates', () => {
    expect(parseDate('Tue, 10 Sep 2024 10:00:00 GMT')).toBe('2024-09-10T10:00:00.000Z')
  })
  it('parses ISO without timezone as UTC', () => {
    expect(parseDate('2024-09-10T10:00:00')).toBe('2024-09-10T10:00:00.000Z')
  })
  it('returns null for garbage with no fallback', () => {
    expect(parseDate('not a date')).toBeNull()
  })
  it('uses a fallback date when unparseable', () => {
    const fb = new Date('2020-01-01T00:00:00Z')
    expect(parseDate(undefined, fb)).toBe('2020-01-01T00:00:00.000Z')
  })
})

describe('extractDateFromDescription', () => {
  it('pulls a publication date from prose', () => {
    expect(extractDateFromDescription('Publication date: March 2023')).toBe('2023-03-01T00:00:00Z')
  })
  it('returns null when absent', () => {
    expect(extractDateFromDescription('no date here')).toBeNull()
  })
})

describe('normalizeFeedItem', () => {
  it('normalizes a typical item with guid/date/content', () => {
    const item: ParsedFeedItem = {
      guid: 'g1',
      title: 'Title',
      link: 'https://example.com/post',
      creator: 'Jane',
      pubDate: 'Tue, 10 Sep 2024 10:00:00 GMT',
      contentEncoded: '<p>Body <img src="/img/x.png"></p>',
      contentSnippet: 'Body preview',
      categories: ['a', 'b'],
    }
    const n = normalizeFeedItem(item, 'https://example.com/feed.xml')!
    expect(n.guid).toBe('g1')
    expect(n.title).toBe('Title')
    expect(n.url).toBe('https://example.com/post')
    expect(n.author).toBe('Jane')
    expect(n.published_at).toBe('2024-09-10T10:00:00.000Z')
    expect(n.summary).toBe('Body preview')
    expect(n.categories_json).toBe(JSON.stringify(['a', 'b']))
    // image resolved from HTML relative to the post link
    expect(n.image_url).toBe('https://example.com/img/x.png')
  })

  it('falls back to link for guid when guid missing', () => {
    const item: ParsedFeedItem = { link: 'https://example.com/p', title: 'T' }
    expect(normalizeFeedItem(item, 'https://example.com')!.guid).toBe('https://example.com/p')
  })

  it('returns null when there is no usable identity', () => {
    expect(normalizeFeedItem({}, 'https://example.com')).toBeNull()
  })

  it('skips tracking-pixel images when scanning HTML', () => {
    const item: ParsedFeedItem = {
      guid: 'g',
      link: 'https://example.com/p',
      content: '<img src="https://t.example.com/pixel.gif"><img src="https://example.com/real.jpg">',
    }
    const n = normalizeFeedItem(item, 'https://example.com')!
    expect(n.image_url).toBe('https://example.com/real.jpg')
  })

  it('prefers media:content image url', () => {
    const item: ParsedFeedItem = {
      guid: 'g',
      link: 'https://example.com/p',
      mediaContent: [{ url: 'https://example.com/m.jpg', type: 'image/jpeg' }],
    }
    expect(normalizeFeedItem(item, 'https://example.com')!.image_url).toBe('https://example.com/m.jpg')
  })
})

describe('selectFeedIcon', () => {
  it('prefers a declared feed image', () => {
    expect(selectFeedIcon({ image: 'https://example.com/logo.png', items: [] }, 'https://example.com', 'https://example.com/feed')).toBe(
      'https://example.com/logo.png',
    )
  })
  it('falls back to origin favicon', () => {
    expect(selectFeedIcon({ items: [] }, 'https://example.com/blog', 'https://example.com/feed')).toBe('https://example.com/favicon.ico')
  })
})
