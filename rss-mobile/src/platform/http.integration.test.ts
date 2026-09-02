/**
 * Opt-in network integration test for the platform HTTP layer (web path).
 *
 * Skipped by default so the suite stays offline-safe. Run with a real network:
 *   VITE_RUN_NET_TESTS=1 pnpm test src/platform/http.integration.test.ts
 *
 * This exercises the `fetch` + decodeBody path that backs the web/dev runtime.
 * On a device the native CapacitorHttp path is verified by the smoke checklist.
 */
import { describe, expect, it } from 'vitest'
import { httpRequest } from './http'

const ENABLED = import.meta.env.VITE_RUN_NET_TESTS === '1'

describe.skipIf(!ENABLED)('httpRequest (network)', () => {
  it('fetches and decodes a real RSS feed', async () => {
    const res = await httpRequest({ url: 'https://hnrss.org/frontpage', timeoutMs: 20_000 })
    expect(res.status).toBe(200)
    expect(res.text).toContain('<rss')
    expect(res.text.length).toBeGreaterThan(500)
  }, 25_000)
})
