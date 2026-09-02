/**
 * Platform HTTP layer.
 *
 * On native (iOS/Android) we use CapacitorHttp, which goes through the native
 * network stack and is NOT subject to browser CORS — this is what lets the
 * standalone mobile app fetch arbitrary third-party RSS feeds and call AI
 * endpoints directly, with no backend proxy.
 *
 * On the web (dev / PWA) there is no native layer, so we fall back to `fetch`.
 * Cross-origin RSS fetches will be CORS-blocked there; an optional dev proxy
 * prefix can be configured via VITE_DEV_HTTP_PROXY for local debugging only.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface HttpRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'HEAD'
  headers?: Record<string, string>
  /** Parsed JSON body for POST; serialized as application/json. */
  json?: unknown
  /** Raw string body (takes precedence over `json`). */
  body?: string
  timeoutMs?: number
}

export interface HttpResponse {
  url: string
  status: number
  headers: Record<string, string>
  /** Response body decoded as text. */
  text: string
}

const DEFAULT_TIMEOUT_MS = 30_000

export class HttpError extends Error {
  status: number
  url: string

  constructor(url: string, status: number, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
  }
}

export class HttpNetworkError extends Error {
  url: string

  constructor(url: string, cause: unknown) {
    super(`Network error for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'HttpNetworkError'
    this.url = url
  }
}

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Lowercase all header keys so callers can look them up case-insensitively. */
function normalizeHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

/**
 * Detect a non-UTF-8 charset from a Content-Type header or an XML/HTML
 * declaration. Returns a lowercased charset label or null when UTF-8/unknown.
 */
export function detectCharset(contentType: string | undefined, headBytes: string | undefined): string | null {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1]
  if (fromHeader) {
    const c = fromHeader.toLowerCase()
    return c === 'utf-8' || c === 'utf8' ? null : c
  }
  if (headBytes) {
    // <?xml version="1.0" encoding="GBK"?>  or  <meta charset="...">
    const fromXml = headBytes.match(/encoding=["']([\w-]+)["']/i)?.[1]
    const fromMeta = headBytes.match(/charset=["']?([\w-]+)/i)?.[1]
    const c = (fromXml ?? fromMeta)?.toLowerCase()
    if (c && c !== 'utf-8' && c !== 'utf8') return c
  }
  return null
}

/**
 * Decode an ArrayBuffer to text, honoring a declared non-UTF-8 charset when the
 * runtime's TextDecoder supports it. Falls back to UTF-8.
 */
export function decodeBody(buffer: ArrayBuffer, contentType: string | undefined): string {
  const bytes = new Uint8Array(buffer)
  // Peek at the first bytes as latin1 so we can read an encoding declaration
  // without committing to a charset yet.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024))
  const charset = detectCharset(contentType, head)
  if (charset) {
    try {
      return new TextDecoder(charset).decode(bytes)
    } catch {
      // Unsupported label — fall through to UTF-8.
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function devProxied(url: string): string {
  const prefix = import.meta.env.VITE_DEV_HTTP_PROXY
  if (!isNative() && prefix && typeof prefix === 'string') {
    return `${prefix}${encodeURIComponent(url)}`
  }
  return url
}

/**
 * Perform an HTTP request and return the decoded text body.
 * Throws HttpError for non-2xx and HttpNetworkError for transport failures.
 */
export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const method = options.method ?? 'GET'
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headers: Record<string, string> = { ...options.headers }

  let data: string | undefined
  if (options.body != null) {
    data = options.body
  } else if (options.json !== undefined) {
    data = JSON.stringify(options.json)
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
  }

  if (isNative()) {
    return nativeRequest(options.url, method, headers, data, timeout)
  }
  return webRequest(devProxied(options.url), method, headers, data, timeout)
}

async function nativeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  data: string | undefined,
  timeout: number,
): Promise<HttpResponse> {
  try {
    // responseType 'arraybuffer' lets us decode non-UTF-8 feeds ourselves.
    const res = await CapacitorHttp.request({
      url,
      method,
      headers,
      data,
      connectTimeout: timeout,
      readTimeout: timeout,
      responseType: 'arraybuffer',
    } as Parameters<typeof CapacitorHttp.request>[0])

    const resHeaders = normalizeHeaders(res.headers as Record<string, unknown>)
    const text = decodeNativeBody(res.data, resHeaders['content-type'])

    if (res.status < 200 || res.status >= 300) {
      throw new HttpError(url, res.status)
    }
    return { url, status: res.status, headers: resHeaders, text }
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpNetworkError(url, err)
  }
}

/**
 * CapacitorHttp with responseType 'arraybuffer' returns base64 on most
 * platforms; tolerate string / object too.
 */
function decodeNativeBody(data: unknown, contentType: string | undefined): string {
  if (typeof data === 'string') {
    // Heuristic: base64 payloads contain no '<' that raw XML/HTML always has.
    if (data.length > 0 && !data.includes('<') && /^[A-Za-z0-9+/=\r\n]+$/.test(data.slice(0, 256))) {
      try {
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return decodeBody(bytes.buffer, contentType)
      } catch {
        return data
      }
    }
    return data
  }
  if (data == null) return ''
  return String(data)
}

async function webRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  data: string | undefined,
  timeout: number,
): Promise<HttpResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { method, headers, body: data, signal: controller.signal })
    const buffer = await res.arrayBuffer()
    const resHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      resHeaders[key.toLowerCase()] = value
    })
    const text = decodeBody(buffer, resHeaders['content-type'])
    if (!res.ok) {
      throw new HttpError(url, res.status)
    }
    return { url: res.url || url, status: res.status, headers: resHeaders, text }
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpNetworkError(url, err)
  } finally {
    clearTimeout(timer)
  }
}
