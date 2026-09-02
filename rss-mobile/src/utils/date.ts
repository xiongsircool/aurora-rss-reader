export function formatRelativeTime(primary: string | null, fallback?: string | null): string {
  const value = primary || fallback
  if (!value) return ''

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ''

  const diffMs = Date.now() - timestamp
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (absMs < minute) return 'now'
  if (absMs < hour) return `${Math.max(1, Math.round(absMs / minute))}m`
  if (absMs < day) return `${Math.round(absMs / hour)}h`
  if (absMs < 7 * day) return `${Math.round(absMs / day)}d`

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

export function formatFullDate(primary: string | null, fallback?: string | null): string {
  const value = primary || fallback
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
