import { JSDOM } from 'jsdom';
import { cleanHtmlText } from '../utils/text.js';
import { Feed } from '../db/models.js';
import { EntryCreateInput } from '../db/repositories/index.js';

export interface NormalizeFeedItemOptions {
  feed: Feed;
  item: any;
  feedData: any;
  siteUrl: string | null;
}

export type NormalizedFeedEntryInput = Omit<EntryCreateInput, 'feed_id'>;

export function extractDateFromDescription(description: string | undefined): string | null {
  if (!description) return null;

  const patterns = [
    /Publication date:\s*([A-Za-z]+)\s+(\d{4})/i,
    /Published:\s*([A-Za-z]+)\s+(\d{4})/i,
    /Date:\s*([A-Za-z]+)\s+(\d{4})/i,
  ];

  const monthMap: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match) {
      continue;
    }

    const month = monthMap[match[1].toLowerCase()];
    if (!month) {
      continue;
    }

    return `${match[2]}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  }

  return null;
}

export function parseDate(dateString: string | undefined, fallbackDate?: Date): string | null {
  if (!dateString) {
    return fallbackDate ? fallbackDate.toISOString() : null;
  }

  try {
    const standard = new Date(dateString);
    if (!Number.isNaN(standard.getTime())) {
      return standard.toISOString();
    }

    const trimmed = dateString.trim();
    const numericTimestamp = /^\d+$/.test(trimmed) ? Number(trimmed) : null;

    const alternatives = [
      () => (numericTimestamp !== null && trimmed.length >= 11 ? new Date(numericTimestamp) : null),
      () => (numericTimestamp !== null && trimmed.length <= 10 ? new Date(numericTimestamp * 1000) : null),
      () => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString) ? new Date(`${dateString}Z`) : null),
    ];

    for (const attempt of alternatives) {
      const parsed = attempt();
      if (parsed && !Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  } catch (error) {
    // Fall through to fallback.
  }

  return fallbackDate ? fallbackDate.toISOString() : null;
}

function extractEnclosure(item: any): Pick<EntryCreateInput, 'enclosure_url' | 'enclosure_type' | 'enclosure_length'> {
  if (item.enclosure) {
    const enclosure = item.enclosure;
    const url = enclosure.url || enclosure.href || enclosure;
    if (typeof url === 'string' && url.startsWith('http')) {
      return {
        enclosure_url: url,
        enclosure_type: enclosure.type || null,
        enclosure_length: enclosure.length ? Number.parseInt(enclosure.length, 10) : null,
      };
    }
  }

  if (item['media:content']) {
    const media = item['media:content'];
    const url = media.url || media.$?.url;
    if (url) {
      return {
        enclosure_url: url,
        enclosure_type: media.type || media.$?.type || null,
        enclosure_length: media.fileSize ? Number.parseInt(media.fileSize, 10) : null,
      };
    }
  }

  return {
    enclosure_url: null,
    enclosure_type: null,
    enclosure_length: null,
  };
}

function extractDuration(item: any): string | null {
  if (item.itunes?.duration) return String(item.itunes.duration);
  if (item['itunes:duration']) return String(item['itunes:duration']);
  return null;
}

export function extractDoi(item: any): string | null {
  const dcIdentifier = item['dc:identifier'] || item.dc?.identifier;
  if (dcIdentifier) {
    const doiMatch = String(dcIdentifier).match(/^doi:(.+)$/i);
    if (doiMatch) return doiMatch[1];
    if (String(dcIdentifier).match(/^10\.\d{4,}/)) return String(dcIdentifier);
  }

  const prismDoi = item['prism:doi'] || item.prism?.doi;
  if (prismDoi && String(prismDoi).match(/^10\.\d{4,}/)) {
    return String(prismDoi);
  }

  const url = item.link || item.url;
  if (url) {
    const doiOrgMatch = String(url).match(/doi\.org\/(10\.\d{4,}[^\s]+)/i);
    if (doiOrgMatch) return doiOrgMatch[1];

    const natureMatch = String(url).match(/nature\.com\/articles\/(s\d+-\d+-\d+-\w)/);
    if (natureMatch) return `10.1038/${natureMatch[1]}`;
  }

  return null;
}

export function extractPmid(item: any): string | null {
  const dcIdentifier = item['dc:identifier'] || item.dc?.identifier;
  if (dcIdentifier) {
    const pmidMatch = String(dcIdentifier).match(/^pmid:(\d+)$/i);
    if (pmidMatch) return pmidMatch[1];
  }

  if (item.pmid) return String(item.pmid);

  const url = item.link || item.url;
  if (url) {
    const pubmedMatch = String(url).match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    if (pubmedMatch) return pubmedMatch[1];
  }

  return null;
}

function extractImageUrl(item: any, feedData: any): string | null {
  if (item.itunes?.image) {
    const image = item.itunes.image;
    return typeof image === 'string' ? image : image.href || image.url || null;
  }
  if (item['itunes:image']) {
    const image = item['itunes:image'];
    return typeof image === 'string' ? image : image.$?.href || null;
  }
  if (item['media:thumbnail']) {
    const thumbnail = item['media:thumbnail'];
    return thumbnail.url || thumbnail.$?.url || null;
  }
  if (feedData?.itunes?.image) {
    const image = feedData.itunes.image;
    return typeof image === 'string' ? image : image.href || image.url || null;
  }
  if (feedData?.image?.url) {
    return feedData.image.url;
  }
  return null;
}

function extractHref(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const href = record.href ?? record.url;
    return typeof href === 'string' ? href : null;
  }
  return null;
}

function normalizeIconUrl(candidate: string | null, baseUrl: string | null): string | null {
  if (!candidate || candidate.startsWith('data:')) return null;
  if (candidate.startsWith('//')) return `https:${candidate}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return candidate;
    }
  } catch (error) {
    // Relative URL, handled below.
  }

  if (!baseUrl) return null;

  try {
    return new URL(candidate, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function buildOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    return null;
  }
}

export function selectFeedIcon(feedData: any, siteUrl: string | null, feedUrl: string): string | null {
  const baseUrl = siteUrl || feedUrl;
  const candidates: string[] = [];

  const addCandidate = (value: unknown) => {
    const href = extractHref(value);
    const normalized = normalizeIconUrl(href, baseUrl);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  addCandidate(feedData?.image?.url || feedData?.image);
  addCandidate(feedData?.icon);
  addCandidate(feedData?.logo);
  addCandidate(feedData?.itunes?.image);

  if (Array.isArray(feedData?.links)) {
    for (const link of feedData.links) {
      const rel = link?.rel;
      const rels = Array.isArray(rel) ? rel : [rel];
      if (rels.some((item: unknown) => typeof item === 'string' && item.toLowerCase().includes('icon'))) {
        addCandidate(link?.href);
        continue;
      }

      if (typeof link?.type === 'string' && link.type.startsWith('image/')) {
        addCandidate(link?.href);
      }
    }
  }

  const origin = buildOrigin(baseUrl);
  if (origin) {
    addCandidate(`${origin}/favicon.ico`);
    addCandidate(`${origin}/apple-touch-icon.png`);
    addCandidate(`${origin}/apple-touch-icon-precomposed.png`);
  }

  return candidates[0] ?? null;
}

export function normalizeFeedItem({ feed, item, feedData }: NormalizeFeedItemOptions): NormalizedFeedEntryInput | null {
  const guid = item.guid || item.link || item.title || '';
  if (!guid) {
    return null;
  }

  let publishedAt = parseDate(item.pubDate || item.isoDate);
  if (!publishedAt) {
    const alternatives = [item.pubdate, item.published, item.updated, item.date, item.dc?.date];
    for (const dateField of alternatives) {
      if (!dateField) continue;
      publishedAt = parseDate(dateField);
      if (publishedAt) break;
    }
  }

  if (!publishedAt) {
    publishedAt = extractDateFromDescription(item.content || item.contentSnippet || item.summary);
  }

  const contentHtml =
    item['content:encoded'] ||
    item.content ||
    item.summary ||
    item.contentSnippet ||
    null;

  const summary = cleanHtmlText(item.contentSnippet || item.summary || item.content || item['content:encoded']);
  const enclosure = extractEnclosure(item);

  return {
    guid,
    title: item.title || null,
    url: item.link || null,
    author: item.creator || item.author || null,
    summary,
    content: contentHtml,
    readability_content: null,
    categories_json: item.categories ? JSON.stringify(item.categories) : null,
    published_at: publishedAt,
    duration: extractDuration(item),
    image_url: extractImageUrl(item, feedData),
    doi: extractDoi(item),
    pmid: extractPmid(item),
    content_source_url: item.link || null,
    ...enclosure,
  };
}

export function shouldExtractArticleContent(feed: Feed, entryUrl: string | null | undefined): boolean {
  return feed.view_type === 'articles' && typeof entryUrl === 'string' && entryUrl.startsWith('http');
}

export function extractFirstImageFromHtml(html: string, baseUrl: string): string | null {
  try {
    const dom = new JSDOM(html, { url: baseUrl });
    const image = dom.window.document.querySelector('img');
    const src = image?.getAttribute('src');
    dom.window.close();
    return src ? new URL(src, baseUrl).toString() : null;
  } catch (error) {
    return null;
  }
}
