function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export function getApiBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase.trim())
  }

  // Electron production uses file:// renderer, so relative /api won't resolve to backend.
  if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
    return 'http://127.0.0.1:15432/api'
  }

  return '/api'
}

