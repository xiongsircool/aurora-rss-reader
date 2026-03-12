import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDoi, extractPmid, parseDate } from '../src/services/feedNormalizer.js';

test('parses unix timestamp dates', () => {
  assert.equal(parseDate('1710000000'), '2024-03-09T16:00:00.000Z');
  assert.equal(parseDate('1710000000000'), '2024-03-09T16:00:00.000Z');
});

test('extracts doi from dc identifier and url', () => {
  assert.equal(extractDoi({ 'dc:identifier': 'doi:10.1038/test-doi' }), '10.1038/test-doi');
  assert.equal(extractDoi({ link: 'https://doi.org/10.1000/xyz-123' }), '10.1000/xyz-123');
});

test('extracts pmid from dc identifier and url', () => {
  assert.equal(extractPmid({ 'dc:identifier': 'pmid:123456' }), '123456');
  assert.equal(extractPmid({ link: 'https://pubmed.ncbi.nlm.nih.gov/987654/' }), '987654');
});
