/**
 * RSS Fetcher Service
 * Core functionality for fetching and parsing RSS feeds
 */

import Parser from 'rss-parser';
import { request as undiciRequest } from 'undici';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { FeedRepository, EntryRepository, FetchLogRepository } from '../db/repositories/index.js';
import {
  getAlternativeUrls,
  getUserAgentForUrl,
  shouldRetryOnStatus,
  RETRY_CONFIG,
  TIMEOUT_CONFIG,
} from './feedConfig.js';
import { userSettingsService } from './userSettings.js';
import { rsshubManager } from './rsshubManager.js';
import { cleanHtmlText } from '../utils/text.js';

const parser = new Parser();

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; RSS Reader/1.0; +https://github.com/rss-reader)';

function buildHeaders(userAgent: string): Record<string, string> {
  return {
    'User-Agent': userAgent,
    'Accept': 'application/rss+xml, application/xml, text/xml',
    'Accept-Language': 'en-US,en;q=0.9,zh;q=0.8',
    'Cache-Control': 'no-cache',
  };
}

function isRSSHubLike(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('rsshub');
  } catch (error) {
    return false;
  }
}

function buildRSSHubCandidate(baseUrl: string, original: URL): string {
  const trimmedBase = baseUrl.replace(/\/$/, '');
  return `${trimmedBase}${original.pathname}${original.search}`;
}

function getUrlsToTry(originalUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (value?: string | null) => {
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    urls.push(value);
  };

  addUrl(originalUrl);

  try {
    const parsed = new URL(originalUrl);
    if (isRSSHubLike(originalUrl)) {
      const userBase = userSettingsService.getRSSHubUrl();
      if (userBase && !originalUrl.startsWith(`${userBase}/`)) {
        addUrl(buildRSSHubCandidate(userBase, parsed));
      }

      for (const base of rsshubManager.getMirrorBaseUrls()) {
        addUrl(buildRSSHubCandidate(base, parsed));
      }
    }
  } catch (error) {
    // ignore invalid URL
  }

  const alternatives = getAlternativeUrls(originalUrl);
  if (alternatives?.length) {
    for (const alt of alternatives) {
      addUrl(alt);
    }
  }

  return urls;
}

async function readBody(body: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFeedXml(url: string, headers: Record<string, string>): Promise<string> {
  const response = await undiciRequest(url, {
    headers,
    maxRedirections: 3,
    headersTimeout: TIMEOUT_CONFIG.read,
    bodyTimeout: TIMEOUT_CONFIG.read,
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = new Error(`HTTP ${response.statusCode}`);
    (error as any).statusCode = response.statusCode;
    throw error;
  }

  const buffer = await readBody(response.body);
  return buffer.toString('utf-8');
}

interface FetchResult {
  success: boolean;
  itemCount: number;
  error?: string;
}

/**
 * Extract date from description HTML text (for sources like ScienceDirect)
 * Example: "<p>Publication date: February 2026</p>" -> "2026-02-01"
 */
function extractDateFromDescription(description: string | undefined): string | null {
  if (!description) return null;

  // Match patterns like "Publication date: February 2026", "Published: Jan 2026", etc.
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
    if (match) {
      const monthName = match[1].toLowerCase();
      const year = match[2];
      const month = monthMap[monthName];

      if (month) {
        // Use first day of the month
        const dateStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
        console.log(`[Fetcher] Extracted date from description: "${match[0]}" -> ${dateStr}`);
        return dateStr;
      }
    }
  }

  return null;
}

/**
 * Parse date from various formats
 * Enhanced to handle more date formats and provide fallback mechanisms
 */
function parseDate(dateString: string | undefined, fallbackDate?: Date): string | null {
  if (!dateString) {
    return fallbackDate ? fallbackDate.toISOString() : null;
  }

  try {
    // Try standard Date parsing first
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Try common alternative formats
    const alternativeFormats = [
      // Unix timestamp (seconds)
      () => {
        const timestamp = parseInt(dateString, 10);
        if (!isNaN(timestamp) && timestamp > 0) {
          return new Date(timestamp * 1000);
        }
        return null;
      },
      // Unix timestamp (milliseconds)
      () => {
        const timestamp = parseInt(dateString, 10);
        if (!isNaN(timestamp) && timestamp > 1000000000000) {
          return new Date(timestamp);
        }
        return null;
      },
      // ISO 8601 with missing timezone
      () => {
        if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
          return new Date(dateString + 'Z');
        }
        return null;
      },
    ];

    for (const formatter of alternativeFormats) {
      const parsedDate = formatter();
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        console.log(`[parseDate] Successfully parsed "${dateString}" using alternative format`);
        return parsedDate.toISOString();
      }
    }

    console.warn(`[parseDate] Failed to parse date: "${dateString}"`);
  } catch (error) {
    console.error(`[parseDate] Error parsing date "${dateString}":`, error);
  }

  return fallbackDate ? fallbackDate.toISOString() : null;
}

/**
 * Extract readable content from HTML using Readability
 */
function extractReadableContent(html: string, url: string): string | null {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.content || null;
  } catch (error) {
    console.error('Failed to extract readable content:', error);
    return null;
  }
}

function extractHref(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const href = record.href ?? record.url;
    if (typeof href === 'string') return href;
  }
  return null;
}

function normalizeIconUrl(candidate: string | null, baseUrl: string | null): string | null {
  if (!candidate) return null;
  if (candidate.startsWith('data:')) return null;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return candidate;
    }
  } catch (error) {
    // relative url
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

function selectFeedIcon(feedData: any, siteUrl: string | null, feedUrl: string): string | null {
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
      if (rels.some((r) => typeof r === 'string' && r.toLowerCase().includes('icon'))) {
        addCandidate(link?.href);
        continue;
      }
      const linkType = link?.type;
      if (typeof linkType === 'string' && linkType.startsWith('image/')) {
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

/**
 * Extract enclosure data from RSS item (for audio/video)
 */
interface EnclosureData {
  url: string;
  type: string | null;
  length: number | null;
}

function extractEnclosure(item: any): EnclosureData | null {
  // Try standard enclosure field
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

  // Try media:content
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

/**
 * Extract duration from RSS item (iTunes format)
 */
function extractDuration(item: any): string | null {
  // iTunes duration
  if (item.itunes?.duration) {
    return String(item.itunes.duration);
  }
  if (item['itunes:duration']) {
    return String(item['itunes:duration']);
  }
  return null;
}

/**
 * Extract DOI from RSS item
 * Supports: dc:identifier, prism:doi, and URL patterns
 */
function extractDoi(item: any): string | null {
  // 1. dc:identifier (format: "doi:10.1038/xxx")
  const dcIdentifier = item['dc:identifier'] || item.dc?.identifier;
  if (dcIdentifier) {
    const doiMatch = String(dcIdentifier).match(/^doi:(.+)$/i);
    if (doiMatch) return doiMatch[1];
    // Direct DOI format
    if (String(dcIdentifier).match(/^10\.\d{4,}/)) return dcIdentifier;
  }

  // 2. prism:doi
  const prismDoi = item['prism:doi'] || item.prism?.doi;
  if (prismDoi && String(prismDoi).match(/^10\.\d{4,}/)) {
    return prismDoi;
  }

  // 3. Extract from URL (nature.com, springer, etc.)
  const url = item.link || item.url;
  if (url) {
    // doi.org URL
    const doiOrgMatch = url.match(/doi\.org\/(10\.\d{4,}[^\s]+)/i);
    if (doiOrgMatch) return doiOrgMatch[1];

    // Nature: nature.com/articles/s41467-xxx
    const natureMatch = url.match(/nature\.com\/articles\/(s\d+-\d+-\d+-\w)/);
    if (natureMatch) return `10.1038/${natureMatch[1]}`;
  }

  return null;
}

/**
 * Extract PMID from RSS item
 */
function extractPmid(item: any): string | null {
  // dc:identifier with pmid prefix
  const dcIdentifier = item['dc:identifier'] || item.dc?.identifier;
  if (dcIdentifier) {
    const pmidMatch = String(dcIdentifier).match(/^pmid:(\d+)$/i);
    if (pmidMatch) return pmidMatch[1];
  }

  // Direct pmid field
  if (item.pmid) return String(item.pmid);

  // Extract from PubMed URL
  const url = item.link || item.url;
  if (url) {
    const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    if (pubmedMatch) return pubmedMatch[1];
  }

  return null;
}

/**
 * Extract image URL from RSS item
 */
function extractImageUrl(item: any, feedData: any): string | null {
  // Item-level image (iTunes)
  if (item.itunes?.image) {
    const img = item.itunes.image;
    return typeof img === 'string' ? img : img.href || img.url || null;
  }
  if (item['itunes:image']) {
    const img = item['itunes:image'];
    return typeof img === 'string' ? img : img.$?.href || null;
  }

  // media:thumbnail
  if (item['media:thumbnail']) {
    const thumb = item['media:thumbnail'];
    return thumb.url || thumb.$?.url || null;
  }

  // Fall back to feed-level image
  if (feedData?.itunes?.image) {
    const img = feedData.itunes.image;
    return typeof img === 'string' ? img : img.href || img.url || null;
  }
  if (feedData?.image?.url) {
    return feedData.image.url;
  }

  return null;
}

/**
 * Fetch and parse a single RSS feed
 */
export async function refreshFeed(feedId: string): Promise<FetchResult> {
  const feedRepo = new FeedRepository();
  const entryRepo = new EntryRepository();
  const fetchLogRepo = new FetchLogRepository();

  const startTime = Date.now();
  const fetchLog = fetchLogRepo.create({
    feed_id: feedId,
    status: 'running',
  });

  try {
    // Get feed info
    const feed = feedRepo.findById(feedId);
    if (!feed) {
      throw new Error(`Feed ${feedId} not found`);
    }

    console.log(`Fetching feed: ${feed.url}`);

    const userAgent = getUserAgentForUrl(feed.url) || DEFAULT_USER_AGENT;
    const headers = buildHeaders(userAgent);
    const urlsToTry = getUrlsToTry(feed.url);

    let feedData: any = null;
    let fetchUrl = feed.url;
    let lastError: Error | null = null;

    for (const url of urlsToTry) {
      let attempt = 0;
      while (attempt <= RETRY_CONFIG.maxRetries) {
        try {
          const xml = await fetchFeedXml(url, headers);
          feedData = await parser.parseString(xml);
          fetchUrl = url;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const statusCode = (error as any)?.statusCode;
          const retryable = typeof statusCode === 'number' ? shouldRetryOnStatus(statusCode) : true;
          if (retryable && attempt < RETRY_CONFIG.maxRetries) {
            await delay(RETRY_CONFIG.retryDelay);
            attempt += 1;
            continue;
          }
          break;
        }
      }
      if (feedData) {
        break;
      }
    }

    if (!feedData) {
      throw lastError || new Error('Failed to fetch feed');
    }

    // Update feed metadata
    const siteUrl = feedData.link || feed.site_url;
    const faviconUrl = selectFeedIcon(feedData, siteUrl, fetchUrl);

    feedRepo.update(feedId, {
      title: feedData.title || feed.title,
      site_url: siteUrl,
      description: feedData.description || feed.description,
      favicon_url: faviconUrl || feed.favicon_url,
      last_checked_at: new Date().toISOString(),
      last_error: null,
    });

    let newItemCount = 0;

    // Process entries
    for (const item of feedData.items || []) {
      const guid = item.guid || item.link || item.title || '';
      if (!guid) {
        continue;
      }

      // Check if entry already exists
      const existing = entryRepo.findByFeedIdAndGuid(feedId, guid);
      if (existing) {
        continue;
      }

      // Parse published date with multiple fallback strategies
      let publishedAt = parseDate(item.pubDate || item.isoDate);

      // Enhanced fallback: try other common date fields
      if (!publishedAt) {
        const alternativeDateFields = [
          item.pubdate,           // lowercase variant
          item.published,         // Atom format
          item.updated,           // Atom updated
          item.date,              // generic date field
          item.dc?.date,          // Dublin Core
        ];

        for (const dateField of alternativeDateFields) {
          if (dateField) {
            publishedAt = parseDate(dateField);
            if (publishedAt) {
              console.log(`[Fetcher] Using alternative date field for "${item.title || guid}": ${dateField}`);
              break;
            }
          }
        }
      }

      // Last resort: extract from description (for ScienceDirect, etc.)
      if (!publishedAt) {
        const descriptionDate = extractDateFromDescription(item.content || item.contentSnippet || item.summary);
        if (descriptionDate) {
          publishedAt = descriptionDate;
        }
      }

      // Log warning if still no date
      if (!publishedAt) {
        console.warn(`[Fetcher] No valid date found for entry: "${item.title || guid}" from feed: ${feed.title}`);
      }

      const contentHtml =
        item['content:encoded'] ||
        item.content ||
        item.summary ||
        item.contentSnippet ||
        null;

      const readabilityContent =
        contentHtml && (item.link || siteUrl)
          ? extractReadableContent(contentHtml, item.link || siteUrl)
          : null;

      // Clean summary
      const summary = cleanHtmlText(item.contentSnippet || item.summary || item.content || item['content:encoded']);

      // Extract enclosure data (for audio/video podcasts)
      const enclosure = extractEnclosure(item);
      const duration = extractDuration(item);
      const imageUrl = extractImageUrl(item, feedData);

      // Extract DOI/PMID for academic articles
      const doi = extractDoi(item);
      const pmid = extractPmid(item);

      // Create entry
      entryRepo.create({
        feed_id: feedId,
        guid,
        title: item.title || null,
        url: item.link || null,
        author: item.creator || item.author || null,
        summary,
        content: contentHtml,
        readability_content: readabilityContent,
        categories_json: item.categories ? JSON.stringify(item.categories) : null,
        published_at: publishedAt,
        enclosure_url: enclosure?.url || null,
        enclosure_type: enclosure?.type || null,
        enclosure_length: enclosure?.length || null,
        duration: duration,
        image_url: imageUrl,
        doi: doi,
        pmid: pmid,
      });

      newItemCount++;
    }

    // Update fetch log
    const duration = Date.now() - startTime;
    fetchLogRepo.update(fetchLog.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      duration_ms: duration,
      item_count: newItemCount,
    });

    console.log(`✓ Fetched ${newItemCount} new items from ${feed.url}`);

    return {
      success: true,
      itemCount: newItemCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Failed to fetch feed ${feedId}:`, errorMessage);

    // Update feed with error
    feedRepo.update(feedId, {
      last_checked_at: new Date().toISOString(),
      last_error: errorMessage,
    });

    // Update fetch log
    const duration = Date.now() - startTime;
    fetchLogRepo.update(fetchLog.id, {
      status: 'error',
      message: errorMessage,
      finished_at: new Date().toISOString(),
      duration_ms: duration,
    });

    return {
      success: false,
      itemCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Refresh all feeds
 */
export async function refreshAllFeeds(): Promise<void> {
  const feedRepo = new FeedRepository();
  const feeds = feedRepo.findAll();

  console.log(`Refreshing ${feeds.length} feeds...`);

  for (const feed of feeds) {
    await refreshFeed(feed.id);
  }

  console.log('✓ All feeds refreshed');
}
