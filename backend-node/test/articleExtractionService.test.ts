import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReadableArticle } from '../src/services/articleExtractionService.js';

test('extracts readable content and metadata from article html', () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="/cover.jpg" />
        <meta name="citation_doi" content="10.9999/example" />
      </head>
      <body>
        <main>
          <article>
            <h1>Example Title</h1>
            <p>Paragraph one.</p>
            <p>Paragraph two.</p>
          </article>
        </main>
      </body>
    </html>
  `;

  const result = extractReadableArticle(html, 'https://example.com/post');
  assert.match(result.content || '', /Paragraph one/);
  assert.equal(result.imageUrl, 'https://example.com/cover.jpg');
  assert.equal(result.doi, '10.9999/example');
});
