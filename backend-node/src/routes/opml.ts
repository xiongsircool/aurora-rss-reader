/**
 * OPML API Routes (Import/Export)
 */

import { FastifyInstance } from 'fastify';
import { FeedRepository } from '../db/repositories/index.js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { refreshFeed } from '../services/fetcher.js';

export async function opmlRoutes(app: FastifyInstance) {
  const feedRepo = new FeedRepository();

  // POST /opml/import - Import OPML file
  app.post('/opml/import', async (request, reply) => {
    try {
      // Handle multipart file upload
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Read file content
      const buffer = await data.toBuffer();
      const opml_content = buffer.toString('utf-8');

      // Get group_name from fields if provided
      const group_name = data.fields.group_name?.value as string | undefined;

      if (!opml_content) {
        return reply.code(400).send({ error: 'OPML content is required' });
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      const result = parser.parse(opml_content);

      if (!result.opml || !result.opml.body) {
        return reply.code(400).send({ error: 'Invalid OPML format' });
      }

      const imported: any[] = [];
      const skipped: any[] = [];
      const errors: string[] = [];

      // Process outline elements (feeds)
      const processOutline = (outline: any, parentGroup?: string) => {
        if (!outline) return;

        // Handle array of outlines
        const outlines = Array.isArray(outline) ? outline : [outline];

        for (const item of outlines) {
          // Check if this is a folder/category (has nested outlines)
          if (item.outline) {
            const folderName = item['@_text'] || item['@_title'] || 'Uncategorized';
            processOutline(item.outline, folderName);
            continue;
          }

          // This is a feed
          const feedUrl = item['@_xmlUrl'] || item['@_url'];
          const feedTitle = item['@_text'] || item['@_title'];
          const feedGroup = parentGroup || group_name || 'default';

          if (!feedUrl) {
            continue;
          }

          try {
            // Check if feed already exists
            const existing = feedRepo.findByUrl(feedUrl);
            if (existing) {
              skipped.push({
                url: feedUrl,
                title: feedTitle,
                reason: 'Feed already exists',
              });
              continue;
            }

            // Create new feed
            const feed = feedRepo.create({
              url: feedUrl,
              title: feedTitle || null,
              group_name: feedGroup,
            });

            imported.push({
              id: feed.id,
              url: feed.url,
              title: feed.title,
              group_name: feed.group_name,
            });

            refreshFeed(feed.id).catch((error) => {
              console.error('Failed to refresh imported feed:', error);
            });
          } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown error');
          }
        }
      };

      processOutline(result.opml.body.outline);

      return {
        imported: imported.length,
        skipped: skipped.length,
        errors,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : 'Failed to parse OPML',
      });
    }
  });

  // GET /opml/export - Export feeds to OPML
  app.get('/opml/export', async (request, reply) => {
    try {
      const feeds = feedRepo.findAll();

      // Group feeds by group_name
      const groupedFeeds: Record<string, any[]> = {};
      for (const feed of feeds) {
        const group = feed.group_name || 'default';
        if (!groupedFeeds[group]) {
          groupedFeeds[group] = [];
        }
        groupedFeeds[group].push(feed);
      }

      // Build OPML structure
      const outlines: any[] = [];

      for (const [groupName, groupFeeds] of Object.entries(groupedFeeds)) {
        if (groupName === 'default' && Object.keys(groupedFeeds).length === 1) {
          // If only default group, don't create a folder
          for (const feed of groupFeeds) {
            outlines.push({
              '@_type': 'rss',
              '@_text': feed.title || feed.url,
              '@_title': feed.title || feed.url,
              '@_xmlUrl': feed.url,
              '@_htmlUrl': feed.url,
            });
          }
        } else {
          // Create folder for group
          const folderOutlines = groupFeeds.map(feed => ({
            '@_type': 'rss',
            '@_text': feed.title || feed.url,
            '@_title': feed.title || feed.url,
            '@_xmlUrl': feed.url,
            '@_htmlUrl': feed.url,
          }));

          outlines.push({
            '@_text': groupName,
            '@_title': groupName,
            outline: folderOutlines,
          });
        }
      }

      const opmlData = {
        '?xml': {
          '@_version': '1.0',
          '@_encoding': 'UTF-8',
        },
        opml: {
          '@_version': '2.0',
          head: {
            title: 'Aurora RSS Reader Feeds',
            dateCreated: new Date().toUTCString(),
          },
          body: {
            outline: outlines,
          },
        },
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
      });

      const opmlXml = builder.build(opmlData);

      reply.header('Content-Type', 'application/xml');
      reply.header('Content-Disposition', 'attachment; filename=rss_subscriptions.opml');
      return reply.send(opmlXml);
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Failed to export OPML',
      });
    }
  });
}
