import { JSDOM } from 'jsdom';

/**
 * Convert an HTML snippet into a compact plain-text string.
 *
 * - Strips tags while keeping anchor text
 * - Decodes common HTML entities
 * - Collapses whitespace, newlines, and repeated spaces
 */
export function cleanHtmlText(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') {
    return null;
  }

  try {
    // Parse HTML using jsdom
    const dom = new JSDOM(value);
    const text = dom.window.document.body.textContent || '';

    if (!text.trim()) {
      return null;
    }

    // Collapse whitespace and normalize
    const normalized = text.replace(/\s+/g, ' ').trim();

    return normalized || null;
  } catch (error) {
    // If parsing fails, return null
    console.error('Failed to clean HTML text:', error);
    return null;
  }
}
