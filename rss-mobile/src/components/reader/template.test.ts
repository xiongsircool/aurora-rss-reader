import { describe, expect, it } from 'vitest'
import { selectReaderTemplate } from './template'

describe('selectReaderTemplate', () => {
  it('maps each content type to its template', () => {
    expect(selectReaderTemplate('video')).toBe('video')
    expect(selectReaderTemplate('gallery')).toBe('gallery')
    expect(selectReaderTemplate('image')).toBe('image')
    expect(selectReaderTemplate('article')).toBe('article')
  })

  it('falls back to article for audio and undefined', () => {
    expect(selectReaderTemplate('audio')).toBe('article')
    expect(selectReaderTemplate(undefined)).toBe('article')
  })
})
