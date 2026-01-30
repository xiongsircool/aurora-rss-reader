/**
 * Icons API Routes (Favicon Fetching and Caching)
 */

import { FastifyInstance } from 'fastify';
import { FeedRepository } from '../db/repositories/index.js';
import { request as undiciRequest } from 'undici';
import { JSDOM } from 'jsdom';

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
  } catch {
    return {
      'User-Agent': 'Mozilla/5.0 (compatible; Aurora RSS Reader)',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
      'Referer': targetUrl,
    };
  }
}

async function readBody(body: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function iconsRoutes(app: FastifyInstance) {
  const feedRepo = new FeedRepository();

  // GET /icons/proxy - Proxy remote icon to avoid mixed content errors
  app.get('/icons/proxy', async (req, reply) => {
    const query = req.query as { url?: string };
    const targetUrl = query?.url;

    reply.header('Cache-Control', 'public, max-age=86400');

    if (!targetUrl) {
      reply.type('image/gif');
      return reply.send(TRANSPARENT_GIF);
    }

    try {
      const response = await undiciRequest(targetUrl, {
        headers: buildProxyHeaders(targetUrl),
        maxRedirections: 3,
        headersTimeout: 5000,
      });

      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (response.statusCode === 200 && contentType.startsWith('image/')) {
        const buffer = await readBody(response.body);
        if (buffer.length > 0) {
          reply.type(contentType.split(';')[0]);
          return reply.send(buffer);
        }
      }
    } catch (error) {
      // fall through to transparent gif
    }

    reply.type('image/gif');
    return reply.send(TRANSPARENT_GIF);
  });

  // GET /icons/:feed_id - Get favicon for a feed
  app.get('/icons/:feed_id', async (req, reply) => {
    const { feed_id } = req.params as { feed_id: string };

    const feed = feedRepo.findById(feed_id);

    if (!feed) {
      return { error: 'Feed not found' };
    }

    try {
      // Check if we already have a cached favicon URL
      if (feed.favicon_url) {
        return {
          success: true,
          favicon_url: feed.favicon_url,
          cached: true,
        };
      }

      // Extract domain from feed URL
      const feedUrl = new URL(feed.url);
      const domain = `${feedUrl.protocol}//${feedUrl.hostname}`;

      let faviconUrl: string | null = null;

      // Strategy 1: Try common favicon.ico location
      try {
        const faviconIcoUrl = `${domain}/favicon.ico`;
        const response = await undiciRequest(faviconIcoUrl, {
          method: 'HEAD',
          maxRedirections: 3,
        });

        if (response.statusCode === 200) {
          faviconUrl = faviconIcoUrl;
        }
      } catch (error) {
        // Favicon.ico not found, continue to next strategy
      }

      // Strategy 2: Parse HTML for <link rel="icon"> tags
      if (!faviconUrl) {
        try {
          const response = await undiciRequest(domain, {
            maxRedirections: 3,
            headersTimeout: 10000,
          });

          const html = await response.body.text();
          const dom = new JSDOM(html);
          const document = dom.window.document;

          // Look for various icon link tags
          const iconSelectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
          ];

          for (const selector of iconSelectors) {
            const iconLink = document.querySelector(selector);
            if (iconLink) {
              const href = iconLink.getAttribute('href');
              if (href) {
                // Handle relative URLs
                if (href.startsWith('http')) {
                  faviconUrl = href;
                } else if (href.startsWith('//')) {
                  faviconUrl = `${feedUrl.protocol}${href}`;
                } else if (href.startsWith('/')) {
                  faviconUrl = `${domain}${href}`;
                } else {
                  faviconUrl = `${domain}/${href}`;
                }
                break;
              }
            }
          }
        } catch (error) {
          // HTML parsing failed, continue
        }
      }

      // Strategy 3: Use Google's favicon service as fallback
      if (!faviconUrl) {
        faviconUrl = `https://www.google.com/s2/favicons?domain=${feedUrl.hostname}&sz=64`;
      }

      // Cache the favicon URL in the database
      if (faviconUrl) {
        feedRepo.update(feed_id, { favicon_url: faviconUrl });
      }

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

  // DELETE /icons/:feed_id - Clear cached favicon
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
