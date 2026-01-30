/**
 * User Settings API Routes
 */

import { FastifyInstance } from 'fastify';
import { userSettingsService } from '../services/userSettings.js';
import { fetch } from 'undici';

/**
 * Convert SQLite boolean fields (0/1) to JavaScript booleans
 */
function normalizeSettings(settings: any) {
  return {
    ...settings,
    auto_refresh: !!settings.auto_refresh,
    show_description: !!settings.show_description,
    show_entry_summary: !!settings.show_entry_summary,
    enable_date_filter: !!settings.enable_date_filter,
  };
}

export async function userSettingsRoutes(app: FastifyInstance) {
  // GET /settings - Get user settings
  app.get('/settings', async () => {
    const settings = userSettingsService.getSettings();
    return normalizeSettings(settings);
  });

  // PATCH /settings - Update user settings
  app.patch('/settings', async (request) => {
    const updates = request.body as Record<string, any>;
    const settings = userSettingsService.updateSettings(updates);
    return normalizeSettings(settings);
  });

  // GET /settings/rsshub-url - Get RSSHub URL
  app.get('/settings/rsshub-url', async () => {
    const url = userSettingsService.getRSSHubUrl();
    return { rsshub_url: url };
  });

  // POST /settings/rsshub-url - Update RSSHub URL
  app.post('/settings/rsshub-url', async (request) => {
    const body = request.body as any;
    const url = body.url || body.rsshub_url;

    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    const settings = userSettingsService.updateRSSHubUrl(url);
    return { success: true, settings };
  });

  // POST /settings/test-rsshub-quick - Test RSSHub connection
  app.post('/settings/test-rsshub-quick', async (request) => {
    const body = request.body as any;
    const url = body?.url;

    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    try {
      // Test connection with a simple health check or route list request
      const testUrl = url.endsWith('/') ? `${url}` : `${url}/`;
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        return { success: true, message: 'RSSHub connection successful' };
      } else {
        return {
          success: false,
          message: `RSSHub returned status ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  });

  // GET /settings/language - Get user language preference
  app.get('/settings/language', async () => {
    const settings = userSettingsService.getSettings();
    return { language: settings.language || 'zh' };
  });

  // POST /settings/language - Update user language preference
  app.post('/settings/language', async (request) => {
    const body = request.body as any;
    const language = body.language;

    if (!language) {
      return { success: false, message: 'Language is required' };
    }

    // Validate language code
    const validLanguages = ['zh', 'en', 'ja', 'ko'];
    if (!validLanguages.includes(language)) {
      return { success: false, message: 'Invalid language code' };
    }

    const settings = userSettingsService.updateSettings({ language });
    return { success: true, language: settings.language };
  });
}
