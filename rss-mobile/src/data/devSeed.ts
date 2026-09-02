/**
 * Dev-only demo seeding. Populates a few feeds and mixed-type entries so the UI
 * can be reviewed in the browser without network/CORS-blocked RSS fetches.
 *
 * Gated behind VITE_SEED_DEMO=1 and only runs when the DB has no feeds yet.
 * Never imported into a production build path unless the flag is set.
 */
import { getRepositories } from './repositories'
import { classifyParsedEntry } from '../domain/contentType'
import type { NormalizedEntry } from './models'

interface DemoFeed {
  url: string
  title: string
  group: string
  site: string
  favicon?: string | null
  entries: Array<Partial<NormalizedEntry> & { guid: string; title: string }>
}

const DEMO: DemoFeed[] = [
  {
    url: 'https://demo.dev/feed.xml',
    title: 'Dev.to',
    group: 'Tech',
    site: 'https://demo.dev',
    entries: [
      {
        guid: 'dev-1',
        title: 'Caching strategies that matter',
        url: 'https://demo.dev/caching',
        author: 'Dev.to',
        summary: 'Practical approaches to caching that actually improve performance.',
        content:
          '<p>Not all caches solve the same problem. In-memory caches like Caffeine are blazing fast for per-instance data. ' +
          'Redis adds persistence, richer data structures, and cross-instance sharing. CDNs excel at caching static content close to users.</p>' +
          '<h2>1. Choose the right cache</h2><p>' + 'Pick based on where the data lives and who reads it. '.repeat(20) + '</p>' +
          '<pre><code>const key = userKey(id)\nconst data = await redis.get(key)</code></pre>',
        published_at: new Date(Date.now() - 12 * 60_000).toISOString(),
      },
      {
        guid: 'dev-2',
        title: 'Building a REST API in 15 minutes',
        url: 'https://demo.dev/rest-api',
        author: 'Fireship',
        summary: 'Quick walkthrough with Node.js, Express, and best practices.',
        content: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><p>Learn how to build a production-ready REST API.</p>',
        duration: '15:23',
        published_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
    ],
  },
  {
    url: 'https://longreads.demo/feed.xml',
    title: 'Longreads',
    group: 'Design',
    site: 'https://longreads.demo',
    entries: [
      {
        guid: 'lr-1',
        title: 'A quiet photo essay',
        url: 'https://longreads.demo/photo-essay',
        author: 'Longreads',
        summary: 'Some places speak softly. A walk through stillness — where light, weather, and time shape the way we see.',
        content:
          '<p>Some places speak softly.</p>' +
          '<figure><img src="https://picsum.photos/seed/a/800/600" width="800" height="600"><figcaption>Morning light</figcaption></figure>' +
          '<figure><img src="https://picsum.photos/seed/b/800/600" width="800" height="600"><figcaption>Mountain road</figcaption></figure>' +
          '<img src="https://picsum.photos/seed/c/800/600" width="800" height="600">' +
          '<img src="https://picsum.photos/seed/d/800/600" width="800" height="600">' +
          '<img src="https://picsum.photos/seed/e/800/600" width="800" height="600">',
        published_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      },
    ],
  },
  {
    url: 'https://news.demo/feed.xml',
    title: 'The Verge',
    group: 'Tech',
    site: 'https://news.demo',
    entries: [
      {
        guid: 'verge-1',
        title: 'Tech layoffs are cooling in 2024',
        url: 'https://news.demo/layoffs',
        author: 'The Verge',
        summary: 'The latest data says about hiring, funding, and the road ahead.',
        content: '<p>' + 'The hiring market is showing signs of stabilization. '.repeat(40) + '</p>',
        image_url: 'https://picsum.photos/seed/verge/400/300',
        published_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
      },
    ],
  },
]

export async function seedDemoData(): Promise<void> {
  const repos = await getRepositories()
  const existing = await repos.feeds.list()
  if (existing.length > 0) return // never overwrite real data

  for (const demo of DEMO) {
    const feed = await repos.feeds.create({
      url: demo.url,
      title: demo.title,
      group_name: demo.group,
      site_url: demo.site,
      favicon_url: demo.favicon ?? null,
    })
    for (const e of demo.entries) {
      const entry: NormalizedEntry = {
        guid: e.guid,
        title: e.title,
        url: e.url ?? null,
        author: e.author ?? null,
        summary: e.summary ?? null,
        content: e.content ?? null,
        readability_content: e.content ?? null,
        categories_json: null,
        published_at: e.published_at ?? new Date().toISOString(),
        enclosure_url: e.enclosure_url ?? null,
        enclosure_type: e.enclosure_type ?? null,
        enclosure_length: null,
        duration: e.duration ?? null,
        image_url: e.image_url ?? null,
        content_source_url: e.url ?? null,
      }
      entry.content_type = classifyParsedEntry(entry)
      await repos.entries.insertIfNew(feed.id, entry)
    }
  }
  // eslint-disable-next-line no-console
  console.info('[devSeed] demo data inserted')
}
