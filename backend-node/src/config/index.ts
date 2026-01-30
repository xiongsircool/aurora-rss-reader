/**
 * Configuration Service
 * Handles environment variables, validation, and platform-specific paths
 */

import { homedir, platform } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Get platform-specific data directory
 */
export function getDataDirectory(): string {
  const platformType = platform();
  let dataDir: string;

  switch (platformType) {
    case 'darwin': // macOS
      dataDir = join(homedir(), 'Library', 'Application Support', 'Aurora RSS Reader');
      break;
    case 'win32': // Windows
      dataDir = join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Aurora RSS Reader');
      break;
    default: // Linux and others
      dataDir = join(homedir(), '.config', 'aurora-rss-reader');
      break;
  }

  // Ensure directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}

/**
 * Application configuration
 */
export interface AppConfig {
  // Server configuration
  apiPort: number;
  apiHost: string;
  nodeEnv: string;

  // Database configuration
  databasePath: string;

  // RSSHub configuration
  rsshubBaseUrl: string;

  // AI configuration
  glmBaseUrl: string;
  glmModel: string;
  glmApiKey: string | null;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const dataDir = getDataDirectory();

  const config: AppConfig = {
    // Server configuration
    apiPort: parseInt(process.env.API_PORT || '15432', 10),
    apiHost: process.env.API_HOST || '127.0.0.1',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database configuration
    databasePath: process.env.DATABASE_PATH || join(dataDir, 'aurora-rss.db'),

    // RSSHub configuration
    rsshubBaseUrl: process.env.RSSHUB_BASE_URL || 'https://rsshub.app',

    // AI configuration
    glmBaseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    glmModel: process.env.GLM_MODEL || 'glm-4-flash',
    glmApiKey: process.env.GLM_API_KEY || null,
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): void {
  // Validate port number
  if (config.apiPort < 1 || config.apiPort > 65535) {
    throw new Error(`Invalid API_PORT: ${config.apiPort}. Must be between 1 and 65535.`);
  }

  // Validate URLs
  if (!config.rsshubBaseUrl.startsWith('http://') && !config.rsshubBaseUrl.startsWith('https://')) {
    throw new Error(`Invalid RSSHUB_BASE_URL: ${config.rsshubBaseUrl}. Must start with http:// or https://`);
  }

  if (!config.glmBaseUrl.startsWith('http://') && !config.glmBaseUrl.startsWith('https://')) {
    throw new Error(`Invalid GLM_BASE_URL: ${config.glmBaseUrl}. Must start with http:// or https://`);
  }

  // Log configuration (without sensitive data)
  console.log('📋 Configuration loaded:');
  console.log(`  - API Port: ${config.apiPort}`);
  console.log(`  - API Host: ${config.apiHost}`);
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Database Path: ${config.databasePath}`);
  console.log(`  - RSSHub Base URL: ${config.rsshubBaseUrl}`);
  console.log(`  - GLM Model: ${config.glmModel}`);
  console.log(`  - GLM API Key: ${config.glmApiKey ? '***configured***' : 'not configured'}`);
}

// Global config instance
let configInstance: AppConfig | null = null;

/**
 * Get the global configuration instance
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
