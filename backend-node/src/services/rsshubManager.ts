/**
 * Simplified RSSHub Manager
 * Uses default mirrors from rsshubDefaults
 */

import { getDefaultRSSHubMirrors, RSSHubMirror } from './rsshubDefaults.js';

export class RSSHubManager {
  private mirrorsCache: RSSHubMirror[] = [];
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 300000; // 5 minutes in milliseconds

  /**
   * Get available RSSHub mirrors
   */
  getAvailableMirrors(): RSSHubMirror[] {
    const currentTime = Date.now();

    // Check cache
    if (currentTime - this.cacheTimestamp < this.cacheTTL && this.mirrorsCache.length > 0) {
      return this.mirrorsCache;
    }

    // Load from defaults
    this.mirrorsCache = getDefaultRSSHubMirrors();
    this.cacheTimestamp = currentTime;

    return this.mirrorsCache;
  }

  /**
   * Get default mirror
   */
  getDefaultMirror(): RSSHubMirror | null {
    const mirrors = this.getAvailableMirrors();
    const defaultMirror = mirrors.find(m => m.is_default);
    return defaultMirror || mirrors[0] || null;
  }

  /**
   * Get mirror base URLs
   */
  getMirrorBaseUrls(): string[] {
    return this.getAvailableMirrors().map(m => m.base_url);
  }
}

// Global instance
export const rsshubManager = new RSSHubManager();
