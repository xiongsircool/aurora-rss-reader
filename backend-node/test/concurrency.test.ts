import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithConcurrency } from '../src/utils/concurrency.js';

test('runWithConcurrency respects the configured limit', async () => {
  let active = 0;
  let peak = 0;

  await runWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 20));
    active -= 1;
  });

  assert.equal(peak, 2);
});
