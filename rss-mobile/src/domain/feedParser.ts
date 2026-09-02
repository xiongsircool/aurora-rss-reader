/**
 * On-device feed parser. Replaces the backend's rss-parser (Node-only) with
 * fast-xml-parser, supporting RSS 2.0, Atom, and JSON Feed.
 *
 * Output field names mirror rss-parser so feedNormalizer can stay a faithful
 * port of the backend logic.
 */
import { XMLParser } from 'fast-xml-parser'

export interface ParsedMedia {
  url?: string
  type?: string
  medium?: string
  fileSize?: string | number
}

export interface ParsedFeedItem {
  guid?: string
  title?: string
  link?: string
  author?: string
  creator?: string
  summary?: string
  content?: string
  contentSnippet?: string
  contentEncoded?: string
  pubDate?: string
  isoDate?: string
  published?: string
  updated?: string
  date?: string
  dcDate?: string
  categories?: string[]
  duration?: string
  image?: string
  itunesImage?: string
  mediaThumbnail?: string
  mediaContent?: ParsedMedia[]
  enclosure?: { url?: string; type?: string; length?: string | number }
}

export interface ParsedFeed {
  title?: string
  description?: string
  link?: string
  image?: string
  icon?: string
  items: ParsedFeedItem[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  removeNSPrefix: false,
})

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

/** Read a node that may be a plain string, { '#text' }, or { '@_attr' }. */
function text(node: unknown): string | undefined {
  if (node == null) return undefined
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (typeof rec['#text'] === 'string') return rec['#text']
    if (typeof rec['#text'] === 'number') return String(rec['#text'])
  }
  return undefined
}

function attr(node: unknown, name: string): string | undefined {
  if (node && typeof node === 'object') {
    const v = (node as Record<string, unknown>)[`@_${name}`]
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

function pickHref(node: unknown): string | undefined {
  return attr(node, 'href') || attr(node, 'url') || text(node)
}

function mapMedia(raw: unknown): ParsedMedia[] {
  return asArray(raw).map((m) => ({
    url: attr(m, 'url'),
    type: attr(m, 'type'),
    medium: attr(m, 'medium'),
    fileSize: attr(m, 'fileSize'),
  }))
}

function parseRssItem(raw: Record<string, unknown>): ParsedFeedItem {
  const guidNode = raw.guid
  const categories = asArray(raw.category).map((c) => text(c)).filter((s): s is string => !!s)
  const enclosure = raw.enclosure
    ? { url: attr(raw.enclosure, 'url'), type: attr(raw.enclosure, 'type'), length: attr(raw.enclosure, 'length') }
    : undefined

  return {
    guid: text(guidNode) || attr(guidNode, 'isPermaLink'),
    title: text(raw.title),
    link: text(raw.link),
    author: text(raw.author),
    creator: text(raw['dc:creator']),
    summary: text(raw.description),
    content: text(raw['content:encoded']) || text(raw.description),
    contentSnippet: text(raw.description),
    contentEncoded: text(raw['content:encoded']),
    pubDate: text(raw.pubDate),
    dcDate: text(raw['dc:date']),
    categories: categories.length ? categories : undefined,
    duration: text(raw['itunes:duration']),
    image: pickHref(raw.image),
    itunesImage: attr(raw['itunes:image'], 'href'),
    mediaThumbnail: attr(raw['media:thumbnail'], 'url'),
    mediaContent: raw['media:content'] ? mapMedia(raw['media:content']) : undefined,
    enclosure,
  }
}

function parseAtomEntry(raw: Record<string, unknown>): ParsedFeedItem {
  const links = asArray(raw.link)
  const alternate = links.find((l) => attr(l, 'rel') === 'alternate') ?? links[0]
  const link = pickHref(alternate)
  const authorNode = raw.author as Record<string, unknown> | undefined

  return {
    guid: text(raw.id) || link,
    title: text(raw.title),
    link,
    author: authorNode ? text(authorNode.name) : undefined,
    summary: text(raw.summary),
    content: text(raw.content) || text(raw.summary),
    contentSnippet: text(raw.summary),
    contentEncoded: text(raw.content),
    isoDate: text(raw.updated) || text(raw.published),
    published: text(raw.published),
    updated: text(raw.updated),
    categories: asArray(raw.category).map((c) => attr(c, 'term')).filter((s): s is string => !!s),
    mediaThumbnail: attr(raw['media:thumbnail'], 'url'),
    mediaContent: raw['media:content'] ? mapMedia(raw['media:content']) : undefined,
  }
}

function parseJsonFeed(json: Record<string, unknown>): ParsedFeed {
  const items = asArray(json.items as unknown[]).map((raw) => {
    const it = raw as Record<string, unknown>
    return {
      guid: (it.id as string) || (it.url as string),
      title: it.title as string | undefined,
      link: (it.url as string) || (it.external_url as string),
      author: ((it.author as Record<string, unknown>)?.name as string) || undefined,
      summary: it.summary as string | undefined,
      content: (it.content_html as string) || (it.content_text as string),
      contentEncoded: it.content_html as string | undefined,
      contentSnippet: it.summary as string | undefined,
      isoDate: (it.date_published as string) || (it.date_modified as string),
      published: it.date_published as string | undefined,
      image: it.image as string | undefined,
      categories: asArray(it.tags as string[]),
    } satisfies ParsedFeedItem
  })

  return {
    title: json.title as string | undefined,
    description: json.description as string | undefined,
    link: json.home_page_url as string | undefined,
    icon: (json.icon as string) || (json.favicon as string),
    items,
  }
}

/** Parse raw feed text (XML or JSON Feed) into a ParsedFeed. */
export function parseFeed(raw: string): ParsedFeed {
  const trimmed = raw.trimStart()

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as Record<string, unknown>
      if (json.version && typeof json.version === 'string' && json.version.includes('jsonfeed')) {
        return parseJsonFeed(json)
      }
    } catch {
      // not JSON feed — fall through to XML
    }
  }

  const doc = parser.parse(raw) as Record<string, unknown>

  // RSS 2.0
  const rss = doc.rss as Record<string, unknown> | undefined
  if (rss?.channel) {
    const channel = rss.channel as Record<string, unknown>
    return {
      title: text(channel.title),
      description: text(channel.description),
      link: text(channel.link),
      image: pickHref(channel.image) || pickHref((channel.image as Record<string, unknown>)?.url),
      items: asArray(channel.item as Record<string, unknown>[]).map(parseRssItem),
    }
  }

  // RDF / RSS 1.0
  const rdf = doc['rdf:RDF'] as Record<string, unknown> | undefined
  if (rdf) {
    const channel = rdf.channel as Record<string, unknown> | undefined
    return {
      title: channel ? text(channel.title) : undefined,
      description: channel ? text(channel.description) : undefined,
      link: channel ? text(channel.link) : undefined,
      items: asArray(rdf.item as Record<string, unknown>[]).map(parseRssItem),
    }
  }

  // Atom
  const feed = doc.feed as Record<string, unknown> | undefined
  if (feed) {
    const links = asArray(feed.link)
    const self = links.find((l) => attr(l, 'rel') === 'alternate') ?? links[0]
    return {
      title: text(feed.title),
      description: text(feed.subtitle),
      link: pickHref(self),
      icon: text(feed.icon) || text(feed.logo),
      items: asArray(feed.entry as Record<string, unknown>[]).map(parseAtomEntry),
    }
  }

  return { items: [] }
}
