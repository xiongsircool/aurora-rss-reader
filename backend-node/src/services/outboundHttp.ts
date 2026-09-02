import { execSync } from 'node:child_process';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Dispatcher, ProxyAgent, request as undiciRequest } from 'undici';
import { getDatabase } from '../db/session.js';

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

let cachedSystemProxy: string | null | undefined;
let cachedDispatcher: Dispatcher | undefined;
let cachedDispatcherKey = '';

export type NetworkPolicy = 'none' | 'public';
export type ProxyMode = 'system' | 'custom' | 'off';
export type ProxySource = 'disabled' | 'custom' | 'environment' | 'system' | 'none' | 'custom-invalid';

export interface OutboundHttpRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  acceptedStatusCodes?: number[];
  networkPolicy?: NetworkPolicy;
  logContext?: string;
}

export interface OutboundHttpResponse<T> {
  url: string;
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: T;
}

export class OutboundHttpStatusError extends Error {
  statusCode: number;
  url: string;

  constructor(url: string, statusCode: number) {
    super(`HTTP ${statusCode} for ${url}`);
    this.name = 'OutboundHttpStatusError';
    this.statusCode = statusCode;
    this.url = url;
  }
}

export interface ProxyStatus {
  mode: ProxyMode;
  configuredUrl: string;
  effectiveUrl: string | null;
  envProxyUrl: string | null;
  systemProxyUrl: string | null;
  source: ProxySource;
  active: boolean;
  valid: boolean;
}

export function getSystemProxy(): string | null {
  if (cachedSystemProxy !== undefined) {
    return cachedSystemProxy;
  }

  cachedSystemProxy = null;

  if (process.platform !== 'darwin') {
    return cachedSystemProxy;
  }

  try {
    const output = execSync('scutil --proxy', { encoding: 'utf-8' });
    const httpEnabled = /HTTPEnable\s*:\s*1/.test(output);
    const httpsEnabled = /HTTPSEnable\s*:\s*1/.test(output);

    if (httpsEnabled) {
      const proxyMatch = output.match(/HTTPSProxy\s*:\s*(\S+)/);
      const portMatch = output.match(/HTTPSPort\s*:\s*(\d+)/);
      if (proxyMatch && portMatch) {
        cachedSystemProxy = `http://${proxyMatch[1]}:${portMatch[1]}`;
        return cachedSystemProxy;
      }
    }

    if (httpEnabled) {
      const proxyMatch = output.match(/HTTPProxy\s*:\s*(\S+)/);
      const portMatch = output.match(/HTTPPort\s*:\s*(\d+)/);
      if (proxyMatch && portMatch) {
        cachedSystemProxy = `http://${proxyMatch[1]}:${portMatch[1]}`;
      }
    }
  } catch (error) {
    cachedSystemProxy = null;
  }

  return cachedSystemProxy;
}

function getEnvProxyUrl(): string | null {
  return (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy
  ) || null;
}

function getStoredProxySettings(): { mode: ProxyMode; configuredUrl: string } {
  try {
    const db = getDatabase();
    const columns = db.pragma('table_info(user_settings)') as Array<{ name: string }>;
    const hasMode = columns.some((column) => column.name === 'outbound_proxy_mode');
    const hasUrl = columns.some((column) => column.name === 'outbound_proxy_url');

    if (!hasMode || !hasUrl) {
      return { mode: 'system', configuredUrl: '' };
    }

    const row = db.prepare('SELECT outbound_proxy_mode, outbound_proxy_url FROM user_settings WHERE id = 1').get() as
      | { outbound_proxy_mode?: string | null; outbound_proxy_url?: string | null }
      | undefined;

    const mode = row?.outbound_proxy_mode === 'custom' || row?.outbound_proxy_mode === 'off'
      ? row.outbound_proxy_mode
      : 'system';

    return {
      mode,
      configuredUrl: (row?.outbound_proxy_url || '').trim(),
    };
  } catch (error) {
    return { mode: 'system', configuredUrl: '' };
  }
}

export function isValidProxyUrl(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

export function getProxyStatus(): ProxyStatus {
  const { mode, configuredUrl } = getStoredProxySettings();
  const envProxyUrl = getEnvProxyUrl();
  const systemProxyUrl = getSystemProxy();

  if (mode === 'off') {
    return {
      mode,
      configuredUrl,
      effectiveUrl: null,
      envProxyUrl,
      systemProxyUrl,
      source: 'disabled',
      active: false,
      valid: true,
    };
  }

  if (mode === 'custom') {
    const valid = isValidProxyUrl(configuredUrl);
    return {
      mode,
      configuredUrl,
      effectiveUrl: valid ? configuredUrl : null,
      envProxyUrl,
      systemProxyUrl,
      source: valid ? 'custom' : 'custom-invalid',
      active: valid,
      valid,
    };
  }

  const effectiveUrl = envProxyUrl || systemProxyUrl || null;
  return {
    mode,
    configuredUrl,
    effectiveUrl,
    envProxyUrl,
    systemProxyUrl,
    source: envProxyUrl ? 'environment' : systemProxyUrl ? 'system' : 'none',
    active: !!effectiveUrl,
    valid: true,
  };
}

export function getConfiguredProxyUrl(): string | null {
  return getProxyStatus().effectiveUrl;
}

function getDispatcher(): Dispatcher | undefined {
  const proxyUrl = getConfiguredProxyUrl();
  if (!proxyUrl) {
    cachedDispatcher = undefined;
    cachedDispatcherKey = '';
    return undefined;
  }

  if (cachedDispatcher && cachedDispatcherKey === proxyUrl) {
    return cachedDispatcher;
  }

  cachedDispatcherKey = proxyUrl;
  cachedDispatcher = new ProxyAgent(proxyUrl);
  return cachedDispatcher;
}

export function isSupportedHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === 'metadata.google.internal' ||
    normalized === 'metadata' ||
    normalized === '0.0.0.0';
}

export function isBlockedIpAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    if (address === '0.0.0.0' || address === '127.0.0.1' || address === '169.254.169.254' || address === '100.100.100.200') {
      return true;
    }

    const [a, b] = address.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized === '::ffff:127.0.0.1';
  }

  return false;
}

async function assertAllowedUrl(urlString: string, networkPolicy: NetworkPolicy): Promise<void> {
  if (!isSupportedHttpUrl(urlString)) {
    throw new Error(`Unsupported URL protocol: ${urlString}`);
  }

  if (networkPolicy !== 'public') {
    return;
  }

  const url = new URL(urlString);
  const hostname = url.hostname;

  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked outbound hostname: ${hostname}`);
  }

  if (net.isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error(`Blocked outbound IP: ${hostname}`);
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const record of addresses) {
      if (isBlockedIpAddress(record.address)) {
        throw new Error(`Blocked outbound target: ${hostname} -> ${record.address}`);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Blocked outbound target')) {
      throw error;
    }
  }
}

function getHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

async function readBody(body: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error(`Response exceeded max size of ${maxBytes} bytes`);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function logOutbound(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>) {
  const payload = { scope: 'outbound-http', message, ...meta };
  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }
  console.log(JSON.stringify(payload));
}

async function performRequest(urlString: string, options: OutboundHttpRequestOptions): Promise<OutboundHttpResponse<Buffer>> {
  const acceptedStatusCodes = new Set(options.acceptedStatusCodes ?? [200]);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const networkPolicy = options.networkPolicy ?? 'none';
  const method = options.method ?? 'GET';
  const headers = options.headers ?? {};
  const dispatcher = getDispatcher();
  let currentUrl = urlString;
  let redirectCount = 0;

  while (true) {
    await assertAllowedUrl(currentUrl, networkPolicy);

    const response = await undiciRequest(currentUrl, {
      method,
      headers,
      maxRedirections: 0,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      dispatcher,
    });

    const responseHeaders = response.headers as Record<string, string | string[]>;
    const statusCode = response.statusCode;

    if ([301, 302, 303, 307, 308].includes(statusCode)) {
      if (redirectCount >= maxRedirects) {
        throw new Error(`Too many redirects for ${urlString}`);
      }

      const location = getHeader(responseHeaders, 'location');
      await readBody(response.body, 64 * 1024).catch(() => Buffer.alloc(0));

      if (!location) {
        throw new Error(`Redirect without location for ${currentUrl}`);
      }

      currentUrl = new URL(location, currentUrl).toString();
      redirectCount += 1;
      continue;
    }

    if (!acceptedStatusCodes.has(statusCode)) {
      await readBody(response.body, 64 * 1024).catch(() => Buffer.alloc(0));
      throw new OutboundHttpStatusError(currentUrl, statusCode);
    }

    const body = method === 'HEAD' ? Buffer.alloc(0) : await readBody(response.body, maxResponseBytes);

    return {
      url: currentUrl,
      statusCode,
      headers: responseHeaders,
      body,
    };
  }
}

export async function requestBuffer(urlString: string, options: OutboundHttpRequestOptions = {}): Promise<OutboundHttpResponse<Buffer>> {
  const maxRetries = Math.max(0, options.maxRetries ?? 0);
  let attempt = 0;

  while (true) {
    try {
      return await performRequest(urlString, options);
    } catch (error) {
      const retryable = error instanceof OutboundHttpStatusError
        ? RETRYABLE_STATUS_CODES.has(error.statusCode)
        : true;

      if (!retryable || attempt >= maxRetries) {
        if (options.logContext) {
          logOutbound('warn', 'request_failed', {
            context: options.logContext,
            url: urlString,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }

      attempt += 1;
      await delay(500 * attempt);
    }
  }
}

export async function requestText(urlString: string, options: OutboundHttpRequestOptions = {}): Promise<OutboundHttpResponse<string>> {
  const response = await requestBuffer(urlString, options);
  return {
    ...response,
    body: response.body.toString('utf-8'),
  };
}

export function getResponseHeader(headers: Record<string, string | string[]>, name: string): string | null {
  return getHeader(headers, name);
}
