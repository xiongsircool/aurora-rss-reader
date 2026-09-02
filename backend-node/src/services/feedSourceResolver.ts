import { getAlternativeUrls } from './feedConfig.js';
import { userSettingsService } from './userSettings.js';
import { rsshubManager } from './rsshubManager.js';

export function isRSSHubLike(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('rsshub');
  } catch (error) {
    return false;
  }
}

function buildRSSHubCandidate(baseUrl: string, original: URL): string {
  const trimmedBase = baseUrl.replace(/\/$/, '');
  return `${trimmedBase}${original.pathname}${original.search}`;
}

export function resolveFeedSourceCandidates(originalUrl: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (value?: string | null) => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    candidates.push(value);
  };

  addCandidate(originalUrl);

  try {
    const parsed = new URL(originalUrl);
    if (isRSSHubLike(originalUrl)) {
      const userBase = userSettingsService.getRSSHubUrl();
      if (userBase && !originalUrl.startsWith(`${userBase}/`)) {
        addCandidate(buildRSSHubCandidate(userBase, parsed));
      }

      for (const baseUrl of rsshubManager.getMirrorBaseUrls()) {
        addCandidate(buildRSSHubCandidate(baseUrl, parsed));
      }
    }
  } catch (error) {
    // Ignore invalid URLs and let upstream fetch fail cleanly.
  }

  for (const alternative of getAlternativeUrls(originalUrl) ?? []) {
    addCandidate(alternative);
  }

  return candidates;
}
