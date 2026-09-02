import type { EntryContentType } from '../../domain/contentType'

export type ReaderTemplate = 'article' | 'image' | 'gallery' | 'video'

/**
 * Map a presentation content_type to the reader template that should render it.
 * 'audio' falls back to the article template (no dedicated audio reader in M2).
 */
export function selectReaderTemplate(contentType: EntryContentType | undefined): ReaderTemplate {
  switch (contentType) {
    case 'video':
      return 'video'
    case 'gallery':
      return 'gallery'
    case 'image':
      return 'image'
    default:
      return 'article'
  }
}
