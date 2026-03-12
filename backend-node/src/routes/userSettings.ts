/**
 * User Settings API Routes
 */

import { FastifyInstance } from 'fastify';
import { InvalidUserSettingsUpdateError, userSettingsService } from '../services/userSettings.js';
import { fetch } from 'undici';
import { getObjectBody } from '../utils/http.js';
import { getProxyStatus, isValidProxyUrl } from '../services/outboundHttp.js';

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
  app.patch('/settings', async (request, reply) => {
    const updates = request.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return reply.code(400).send({ error: 'Invalid request body: expected an object' });
    }

    try {
      const payload = { ...(updates as Record<string, unknown>) };
      const legacyPromptPreference =
        typeof payload.ai_prompt_preference === 'string' ? payload.ai_prompt_preference : undefined;
      if (legacyPromptPreference !== undefined) {
        if (payload.summary_prompt_preference === undefined) {
          payload.summary_prompt_preference = legacyPromptPreference;
        }
        if (payload.translation_prompt_preference === undefined) {
          payload.translation_prompt_preference = legacyPromptPreference;
        }
      }

      const proxyMode = typeof payload.outbound_proxy_mode === 'string' ? payload.outbound_proxy_mode : undefined;
      const proxyUrl = typeof payload.outbound_proxy_url === 'string' ? payload.outbound_proxy_url.trim() : undefined;
      const filterDensity =
        typeof payload.timeline_filter_density === 'string' ? payload.timeline_filter_density : undefined;

      if (proxyMode && !['system', 'custom', 'off'].includes(proxyMode)) {
        return reply.code(400).send({ error: 'Invalid outbound_proxy_mode' });
      }

      if (filterDensity && !['compact', 'standard'].includes(filterDensity)) {
        return reply.code(400).send({ error: 'Invalid timeline_filter_density' });
      }

      if (proxyMode === 'custom' && (!proxyUrl || !isValidProxyUrl(proxyUrl))) {
        return reply.code(400).send({ error: 'Custom proxy URL must be a valid http:// or https:// URL' });
      }

      const settings = userSettingsService.updateSettings(payload);
      return normalizeSettings(settings);
    } catch (error) {
      if (error instanceof InvalidUserSettingsUpdateError) {
        return reply.code(400).send({ error: error.message, invalid_fields: error.invalidKeys });
      }
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      return reply.code(500).send({ error: message });
    }
  });

  // GET /settings/rsshub-url - Get RSSHub URL
  app.get('/settings/rsshub-url', async () => {
    const url = userSettingsService.getRSSHubUrl();
    return { rsshub_url: url };
  });

  // POST /settings/rsshub-url - Update RSSHub URL
  app.post('/settings/rsshub-url', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ success: false, message: 'Invalid request body: expected an object' });
    }

    const url =
      (typeof body.url === 'string' && body.url) ||
      (typeof body.rsshub_url === 'string' && body.rsshub_url);

    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    const settings = userSettingsService.updateRSSHubUrl(url);
    return { success: true, settings };
  });

  // POST /settings/test-rsshub-quick - Test RSSHub connection
  app.post('/settings/test-rsshub-quick', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ success: false, message: 'Invalid request body: expected an object' });
    }

    const url = typeof body.url === 'string' ? body.url : undefined;

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

  app.get('/settings/proxy-status', async () => {
    const status = getProxyStatus();
    return {
      mode: status.mode,
      configured_url: status.configuredUrl,
      effective_url: status.effectiveUrl,
      env_proxy_url: status.envProxyUrl,
      system_proxy_url: status.systemProxyUrl,
      source: status.source,
      active: status.active,
      valid: status.valid,
    };
  });

  // POST /settings/language - Update user language preference
  app.post('/settings/language', async (request, reply) => {
    const body = getObjectBody(request.body);
    if (!body) {
      return reply.code(400).send({ success: false, message: 'Invalid request body: expected an object' });
    }

    const language = typeof body.language === 'string' ? body.language : undefined;

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
