import Parser from 'rss-parser';
import { Feed } from '../db/models.js';
import { getUserAgentForUrl, RETRY_CONFIG, TIMEOUT_CONFIG } from './feedConfig.js';
import { resolveFeedSourceCandidates } from './feedSourceResolver.js';
import { getResponseHeader, requestText } from './outboundHttp.js';

const parser = new Parser();
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; Aurora RSS Reader/1.0; +https://github.com/xiongsircool/aurora-rss-reader)';

function buildHeaders(userAgent: string, feed: Feed): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
    'Accept-Language': 'en-US,en;q=0.9,zh;q=0.8',
    'Cache-Control': 'no-cache',
  };

  if (feed.fetch_etag) {
    headers['If-None-Match'] = feed.fetch_etag;
  }

  if (feed.fetch_last_modified) {
    headers['If-Modified-Since'] = feed.fetch_last_modified;
  }

  return headers;
}

export type FeedIngestResult =
  | {
      kind: 'not-modified';
      fetchUrl: string;
      etag: string | null;
      lastModified: string | null;
    }
  | {
      kind: 'fetched';
      fetchUrl: string;
      etag: string | null;
      lastModified: string | null;
      feedData: any;
    };

export class FeedIngestService {
  async ingest(feed: Feed): Promise<FeedIngestResult> {
    const userAgent = getUserAgentForUrl(feed.url) || DEFAULT_USER_AGENT;
    const headers = buildHeaders(userAgent, feed);
    const candidates = resolveFeedSourceCandidates(feed.url);
    let lastError: Error | null = null;

    for (const candidate of candidates) {
      try {
        const response = await requestText(candidate, {
          headers,
          timeoutMs: TIMEOUT_CONFIG.read,
          maxRetries: RETRY_CONFIG.maxRetries,
          maxRedirects: 3,
          maxResponseBytes: 5 * 1024 * 1024,
          acceptedStatusCodes: [200, 304],
          logContext: 'feed-ingest',
        });

        const etag = getResponseHeader(response.headers, 'etag');
        const lastModified = getResponseHeader(response.headers, 'last-modified');

        if (response.statusCode === 304) {
          return {
            kind: 'not-modified',
            fetchUrl: response.url,
            etag,
            lastModified,
          };
        }

        const feedData = await parser.parseString(response.body);
        return {
          kind: 'fetched',
          fetchUrl: response.url,
          etag,
          lastModified,
          feedData,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error(`Failed to fetch feed: ${feed.url}`);
  }
}
