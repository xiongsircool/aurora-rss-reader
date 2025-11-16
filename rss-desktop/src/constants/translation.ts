const DEFAULT_LIMIT = 6

export type NavigatorConnection = {
  downlink?: number
  effectiveType?: string
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
  onchange?: ((this: NavigatorConnection, ev: Event) => unknown) | null
}

export const MIN_AUTO_TITLE_TRANSLATIONS = 3
export const MAX_AUTO_TITLE_TRANSLATIONS = 12
export const TITLE_TRANSLATION_CONCURRENCY_FALLBACK = 2

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getNavigatorConnection(): NavigatorConnection | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { connection?: NavigatorConnection }
  return nav.connection ?? null
}

export function getDefaultAutoTitleTranslationLimit(): number {
  const connection = getNavigatorConnection()
  if (connection) {
    const downlink = typeof connection.downlink === 'number' ? connection.downlink : null
    if (downlink !== null) {
      if (downlink >= 8) return 10
      if (downlink >= 4) return 8
      if (downlink >= 2) return 6
      return 5
    }
  }
  return DEFAULT_LIMIT
}

export function clampAutoTitleTranslationLimit(value?: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return getDefaultAutoTitleTranslationLimit()
  }
  return Math.round(clamp(value, MIN_AUTO_TITLE_TRANSLATIONS, MAX_AUTO_TITLE_TRANSLATIONS))
}

export function getRecommendedTitleTranslationConcurrency(): number {
  const connection = getNavigatorConnection()
  if (connection) {
    if (typeof connection.downlink === 'number') {
      if (connection.downlink >= 5) return 3
      if (connection.downlink >= 2) return 2
      return 1
    }
    if ('effectiveType' in connection) {
      const type = connection.effectiveType
      if (type === '4g') return 3
      if (type === '3g') return 2
      return 1
    }
  }
  return TITLE_TRANSLATION_CONCURRENCY_FALLBACK
}
