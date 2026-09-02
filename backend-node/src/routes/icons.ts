/**
 * Icons API Routes (Favicon Fetching and Caching)
 */

import { FastifyInstance } from 'fastify';
import { JSDOM } from 'jsdom';
import { FeedRepository } from '../db/repositories/index.js';
import { getResponseHeader, requestBuffer, requestText } from '../services/outboundHttp.js';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

function buildProxyHeaders(targetUrl: string): Record<string, string> {
  try {
    const parsed = new URL(targetUrl);
    const origin = `${parsed.protocol}//${parsed.hostname}`;
    return {
      'User-Agent': 'Mozilla/5.0 (compatible; Aurora RSS Reader)',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
      'Referer': origin || targetUrl,
    };
  } catch (error) {
    return {
      'User-Agent': 'Mozilla/5.0 (compatible; Aurora RSS Reader)',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
      'Referer': targetUrl,
    };
  }
}

function resolveHref(href: string, baseUrl: URL): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return `${baseUrl.protocol}${href}`;
  if (href.startsWith('/')) return `${baseUrl.protocol}//${baseUrl.host}${href}`;
  return `${baseUrl.protocol}//${baseUrl.host}/${href}`;
}

async function discoverFaviconUrl(feedUrl: string): Promise<string> {
  const parsedFeedUrl = new URL(feedUrl);
  const domain = `${parsedFeedUrl.protocol}//${parsedFeedUrl.hostname}`;

  try {
    const faviconIcoUrl = `${domain}/favicon.ico`;
    const headResponse = await requestBuffer(faviconIcoUrl, {
      method: 'HEAD',
      maxRedirects: 3,
      maxRetries: 1,
      acceptedStatusCodes: [200],
      networkPolicy: 'public',
      maxResponseBytes: 0,
      headers: buildProxyHeaders(faviconIcoUrl),
      logContext: 'favicon-head',
    });

    const contentType = getResponseHeader(headResponse.headers, 'content-type');
    if (!contentType || contentType.startsWith('image/')) {
      return faviconIcoUrl;
    }
  } catch (error) {
    // Fall through to HTML parsing.
  }

  try {
    const response = await requestText(domain, {
      maxRedirects: 3,
      maxRetries: 1,
      acceptedStatusCodes: [200],
      networkPolicy: 'public',
      maxResponseBytes: 512 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Aurora RSS Reader)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      logContext: 'favicon-html',
    });

    const dom = new JSDOM(response.body, { url: response.url });
    try {
      const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ];

      for (const selector of selectors) {
        const href = dom.window.document.querySelector(selector)?.getAttribute('href');
        if (href) {
          return resolveHref(href, new URL(response.url));
        }
      }
    } finally {
      dom.window.close();
    }
  } catch (error) {
    // Fall through to Google fallback.
  }

  return `https://www.google.com/s2/favicons?domain=${parsedFeedUrl.hostname}&sz=64`;
}

export async function iconsRoutes(app: FastifyInstance) {
  const feedRepo = new FeedRepository();

  app.get('/icons/proxy', async (req, reply) => {
    const query = req.query as { url?: string };
    const targetUrl = query?.url;

    reply.header('Cache-Control', 'public, max-age=86400');

    if (!targetUrl) {
      reply.type('image/gif');
      return reply.send(TRANSPARENT_GIF);
    }

    try {
      const response = await requestBuffer(targetUrl, {
        headers: buildProxyHeaders(targetUrl),
        maxRedirects: 3,
        maxRetries: 1,
        maxResponseBytes: 512 * 1024,
        acceptedStatusCodes: [200],
        networkPolicy: 'public',
        logContext: 'icons-proxy',
      });

      const contentType = String(getResponseHeader(response.headers, 'content-type') || '').toLowerCase();
      if (contentType.startsWith('image/') && response.body.length > 0) {
        reply.type(contentType.split(';')[0]);
        return reply.send(response.body);
      }
    } catch (error) {
      // Fall through to transparent gif.
    }

    reply.type('image/gif');
    return reply.send(TRANSPARENT_GIF);
  });

  app.get('/icons/:feed_id', async (req, reply) => {
    const { feed_id } = req.params as { feed_id: string };
    const feed = feedRepo.findById(feed_id);

    if (!feed) {
      return { error: 'Feed not found' };
    }

    try {
      if (feed.favicon_url) {
        return {
          success: true,
          favicon_url: feed.favicon_url,
          cached: true,
        };
      }

      const faviconUrl = await discoverFaviconUrl(feed.url);
      feedRepo.update(feed_id, { favicon_url: faviconUrl });

      return {
        success: true,
        favicon_url: faviconUrl,
        cached: false,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch favicon',
      };
    }
  });

  app.delete('/icons/:feed_id', async (req) => {
    const { feed_id } = req.params as { feed_id: string };
    const feed = feedRepo.findById(feed_id);

    if (!feed) {
      return { error: 'Feed not found' };
    }

    feedRepo.update(feed_id, { favicon_url: null });
    return { success: true };
  });
}
