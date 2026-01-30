/**
 * RSS feed special configuration and processing rules
 */

import { getDefaultRSSHubBaseUrls } from './rsshubDefaults.js';

// Special User-Agent for specific domains
export const SPECIAL_USER_AGENTS: Record<string, string> = {
  'academic.oup.com': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Academic)',
  'nature.com': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Nature)',
  'science.org': 'Mozilla/5.0 (compatible; RSS Reader/1.0; Science)',
};

// Known problematic RSS sources and their alternatives
export const KNOWN_ALTERNATIVES: Record<string, string[]> = {
  // Original URL -> Alternative URLs (sorted by priority)
  'https://rsshub.app/nature/research/ng': [
    'https://www.nature.com/ng/current.rss',  // Preferred - tested working
    'https://feeds.nature.com/ng/current',    // Fallback - 406 error
  ],
  'https://rsshub.app/nature/research/nmeth': [
    'https://www.nature.com/nmeth/current.rss',  // Preferred
    'https://feeds.nature.com/nmeth/current',    // Fallback
  ],
  'https://rsshub.app/nature/research/nat': [
    'https://www.nature.com/nature/current.rss',
  ],
  'https://rsshub.app/nature/research/ncomms': [
    'https://www.nature.com/ncomms/rss/current',
  ],
};

// Timeout configuration (milliseconds)
export const TIMEOUT_CONFIG = {
  connect: 10000,  // 10 seconds
  read: 30000,     // 30 seconds
  write: 10000,    // 10 seconds
  pool: 60000,     // 60 seconds
};

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,  // 1 second
  retryOnStatus: [408, 429, 500, 502, 503, 504],
};

// Default RSSHub mirrors
export const DEFAULT_RSSHUB_MIRRORS = getDefaultRSSHubBaseUrls();

/**
 * Get User-Agent for a specific URL
 */
export function getUserAgentForUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check if hostname matches any special user agent
    for (const [domain, userAgent] of Object.entries(SPECIAL_USER_AGENTS)) {
      if (hostname.includes(domain)) {
        return userAgent;
      }
    }
  } catch (error) {
    // Invalid URL, return undefined
  }

  return undefined;
}

/**
 * Get alternative URLs for a problematic feed
 */
export function getAlternativeUrls(url: string): string[] | undefined {
  return KNOWN_ALTERNATIVES[url];
}

/**
 * Check if a status code should trigger a retry
 */
export function shouldRetryOnStatus(statusCode: number): boolean {
  return RETRY_CONFIG.retryOnStatus.includes(statusCode);
}
