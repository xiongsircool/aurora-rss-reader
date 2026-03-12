import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedHostname, isBlockedIpAddress, isSupportedHttpUrl } from '../src/services/outboundHttp.js';

test('supports only http and https urls', () => {
  assert.equal(isSupportedHttpUrl('https://example.com/feed.xml'), true);
  assert.equal(isSupportedHttpUrl('http://example.com/feed.xml'), true);
  assert.equal(isSupportedHttpUrl('ftp://example.com/feed.xml'), false);
});

test('blocks localhost and metadata hostnames', () => {
  assert.equal(isBlockedHostname('localhost'), true);
  assert.equal(isBlockedHostname('metadata.google.internal'), true);
  assert.equal(isBlockedHostname('example.com'), false);
});

test('blocks loopback and private addresses', () => {
  assert.equal(isBlockedIpAddress('127.0.0.1'), true);
  assert.equal(isBlockedIpAddress('10.0.0.1'), true);
  assert.equal(isBlockedIpAddress('192.168.1.5'), true);
  assert.equal(isBlockedIpAddress('8.8.8.8'), false);
});
