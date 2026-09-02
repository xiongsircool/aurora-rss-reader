import { describe, expect, it } from 'vitest'
import { buildEntryPresentation, type EntryPresentationInput } from './entryPresentation'

function input(over: Partial<EntryPresentationInput>): EntryPresentationInput {
  return {
    id: '1',
    title: 'T',
    url: 'https://example.com/post',
    summary: null,
    content: null,
    readability_content: null,
    enclosure_url: null,
    enclosure_type: null,
    duration: null,
    image_url: null,
    ...over,
  }
}

describe('buildEntryPresentation content_type', () => {
  it('classifies a text post as article', () => {
    const p = buildEntryPresentation(input({ content: `<p>${'word '.repeat(600)}</p>` }))
    expect(p.content_type).toBe('article')
    expect(p.word_count).toBeGreaterThan(400)
    expect(p.reading_time_minutes).toBeGreaterThanOrEqual(1)
  })

  it('classifies a short post with one image as image', () => {
    const p = buildEntryPresentation(input({ content: '<p>short</p><img src="https://example.com/a.jpg" width="800" height="600">' }))
    expect(p.content_type).toBe('image')
    expect(p.lead_image_url).toBe('https://example.com/a.jpg')
  })

  it('classifies a multi-image short post as gallery', () => {
    const imgs = [1, 2, 3, 4].map((i) => `<img src="https://example.com/${i}.jpg" width="800" height="600">`).join('')
    const p = buildEntryPresentation(input({ content: `<p>tiny</p>${imgs}` }))
    expect(p.content_type).toBe('gallery')
    expect(p.images.length).toBeGreaterThanOrEqual(3)
  })

  it('classifies a youtube embed as video', () => {
    const p = buildEntryPresentation(input({ content: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' }))
    expect(p.content_type).toBe('video')
    expect(p.video?.platform).toBe('youtube')
    expect(p.video?.embed_url).toContain('dQw4w9WgXcQ')
  })

  it('classifies an audio enclosure as audio', () => {
    const p = buildEntryPresentation(input({ enclosure_url: 'https://example.com/ep.mp3', enclosure_type: 'audio/mpeg' }))
    expect(p.content_type).toBe('audio')
  })

  it('filters junk images (logos, tiny pixels)', () => {
    const p = buildEntryPresentation(
      input({
        content:
          '<img src="https://example.com/logo.png"><img src="https://example.com/p.gif" width="1" height="1"><img src="https://example.com/good.jpg" width="600" height="400">',
      }),
    )
    expect(p.images.map((i) => i.url)).toEqual(['https://example.com/good.jpg'])
  })

  it('prefers readability_content over content for reader_html', () => {
    const p = buildEntryPresentation(input({ readability_content: '<p>full</p>', content: '<p>raw</p>', summary: 'sum' }))
    expect(p.reader_html).toBe('<p>full</p>')
    expect(p.has_full_content).toBe(true)
  })
})
