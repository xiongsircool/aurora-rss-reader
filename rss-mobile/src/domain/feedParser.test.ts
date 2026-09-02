import { describe, expect, it } from 'vitest'
import { parseFeed } from './feedParser'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <description>An example</description>
    <item>
      <title>Post One</title>
      <link>https://example.com/post-1</link>
      <guid>https://example.com/post-1</guid>
      <pubDate>Tue, 10 Sep 2024 10:00:00 GMT</pubDate>
      <dc:creator>Jane</dc:creator>
      <category>tech</category>
      <description>Short preview</description>
      <content:encoded><![CDATA[<p>Hello <img src="/img/a.png"></p>]]></content:encoded>
      <enclosure url="https://example.com/a.mp3" type="audio/mpeg" length="123"/>
      <media:thumbnail url="https://example.com/thumb.jpg"/>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <link rel="alternate" href="https://atom.example.com"/>
  <entry>
    <title>Atom Post</title>
    <id>urn:uuid:1</id>
    <link rel="alternate" href="https://atom.example.com/p1"/>
    <updated>2024-09-10T10:00:00Z</updated>
    <author><name>Bob</name></author>
    <summary>Atom summary</summary>
    <content type="html">&lt;p&gt;Atom body&lt;/p&gt;</content>
  </entry>
</feed>`

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'JSON Example',
  home_page_url: 'https://json.example.com',
  items: [
    { id: '1', url: 'https://json.example.com/1', title: 'JSON Post', content_html: '<p>json body</p>', date_published: '2024-09-10T10:00:00Z' },
  ],
})

describe('parseFeed', () => {
  it('parses RSS 2.0 channel + item', () => {
    const feed = parseFeed(RSS)
    expect(feed.title).toBe('Example Blog')
    expect(feed.link).toBe('https://example.com')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]
    expect(item.title).toBe('Post One')
    expect(item.link).toBe('https://example.com/post-1')
    expect(item.creator).toBe('Jane')
    expect(item.categories).toEqual(['tech'])
    expect(item.contentEncoded).toContain('Hello')
    expect(item.enclosure?.url).toBe('https://example.com/a.mp3')
    expect(item.enclosure?.type).toBe('audio/mpeg')
    expect(item.mediaThumbnail).toBe('https://example.com/thumb.jpg')
  })

  it('parses Atom feed + entry', () => {
    const feed = parseFeed(ATOM)
    expect(feed.title).toBe('Atom Example')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]
    expect(item.title).toBe('Atom Post')
    expect(item.link).toBe('https://atom.example.com/p1')
    expect(item.author).toBe('Bob')
    expect(item.content).toContain('Atom body')
  })

  it('parses JSON Feed', () => {
    const feed = parseFeed(JSON_FEED)
    expect(feed.title).toBe('JSON Example')
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0].title).toBe('JSON Post')
    expect(feed.items[0].content).toContain('json body')
  })

  it('returns empty items for unrecognized input', () => {
    expect(parseFeed('<html><body>not a feed</body></html>').items).toEqual([])
  })
})
