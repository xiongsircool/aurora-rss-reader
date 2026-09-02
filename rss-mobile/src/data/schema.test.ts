import { describe, expect, it } from 'vitest'
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from './schema'

describe('schema', () => {
  it('declares a positive version', () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(0)
  })

  it('creates the core mobile tables', () => {
    const sql = SCHEMA_STATEMENTS.join('\n')
    for (const table of ['feeds', 'entries', 'summaries', 'translations', 'user_settings', 'user_tags', 'entry_tags']) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })

  it('uses IF NOT EXISTS everywhere so init is idempotent', () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      expect(stmt).toMatch(/CREATE (TABLE|INDEX) IF NOT EXISTS/)
    }
  })

  it('does not include server-only constructs', () => {
    const sql = SCHEMA_STATEMENTS.join('\n').toLowerCase()
    expect(sql).not.toContain('fts5')
    expect(sql).not.toContain('vss')
    expect(sql).not.toContain('rss_vectors')
    expect(sql).not.toContain('_jobs')
  })
})
