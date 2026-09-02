import { describe, expect, it } from 'vitest'
import { AiClient, buildEntryContent, buildSummaryPrompt, buildTranslatePrompt, stripThink } from './aiClient'

describe('stripThink', () => {
  it('removes a single <think> block', () => {
    expect(stripThink('<think>reasoning</think>Answer')).toBe('Answer')
  })
  it('removes multiline and multiple blocks', () => {
    expect(stripThink('<think>a\nb</think>X<think>c</think>Y')).toBe('XY')
  })
  it('leaves normal text untouched', () => {
    expect(stripThink('just text')).toBe('just text')
  })
})

describe('buildSummaryPrompt', () => {
  it('uses the display name for the language', () => {
    expect(buildSummaryPrompt('en')).toContain('English')
    expect(buildSummaryPrompt('zh-CN')).toContain('中文')
  })
  it('appends the user preference when provided', () => {
    expect(buildSummaryPrompt('zh', '只要三句话')).toContain('用户额外要求：只要三句话')
  })
  it('omits the preference line when blank', () => {
    expect(buildSummaryPrompt('zh', '   ')).not.toContain('用户额外要求')
  })
})

describe('buildTranslatePrompt', () => {
  it('targets the requested language', () => {
    expect(buildTranslatePrompt('ja')).toContain('日本語')
  })
})

describe('buildEntryContent', () => {
  it('prepends metadata to the body', () => {
    const out = buildEntryContent({ title: 'T', author: 'A', published_at: '2024', content: 'Body' })
    expect(out).toContain('Title: T')
    expect(out).toContain('Author: A')
    expect(out).toContain('Content:\nBody')
  })
  it('returns body alone when there is no metadata', () => {
    expect(buildEntryContent({ content: 'Body' })).toBe('Body')
  })
  it('prefers readability_content over content over summary', () => {
    expect(buildEntryContent({ readability_content: 'R', content: 'C', summary: 'S' })).toBe('R')
    expect(buildEntryContent({ content: 'C', summary: 'S' })).toBe('C')
    expect(buildEntryContent({ summary: 'S' })).toBe('S')
  })
  it('returns null when there is nothing to summarize', () => {
    expect(buildEntryContent({})).toBeNull()
  })
})

describe('AiClient.isConfigured', () => {
  it('is false when any field is missing', () => {
    expect(new AiClient({ baseUrl: '', apiKey: 'k', model: 'm' }).isConfigured).toBe(false)
    expect(new AiClient({ baseUrl: 'u', apiKey: '', model: 'm' }).isConfigured).toBe(false)
    expect(new AiClient({ baseUrl: 'u', apiKey: 'k', model: '' }).isConfigured).toBe(false)
  })
  it('is true when fully configured', () => {
    expect(new AiClient({ baseUrl: 'u', apiKey: 'k', model: 'm' }).isConfigured).toBe(true)
  })
})
