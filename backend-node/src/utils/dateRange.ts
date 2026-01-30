export type TimeField = 'published_at' | 'inserted_at';

export function normalizeTimeField(value?: string | null): TimeField {
  return value === 'published_at' ? 'published_at' : 'inserted_at';
}

export function parseRelativeTime(value?: string | null, now: Date = new Date()): Date | null {
  if (!value || value === 'all' || value === 'current') {
    return null;
  }

  const match = value.match(/^(\d+)([hdmy])$/);
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  let deltaMs = dayMs * 30;

  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 'h') deltaMs = amount * hourMs;
    if (unit === 'd') deltaMs = amount * dayMs;
    if (unit === 'm') deltaMs = amount * dayMs * 30;
    if (unit === 'y') deltaMs = amount * dayMs * 365;
  } else {
    const days = Number(value);
    if (!Number.isNaN(days)) {
      deltaMs = days * dayMs;
    }
  }

  return new Date(now.getTime() - deltaMs);
}
