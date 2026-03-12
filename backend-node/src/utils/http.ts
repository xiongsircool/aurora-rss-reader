export function getObjectBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

export function getStringArrayBody(body: unknown): string[] | null {
  if (!Array.isArray(body)) {
    return null;
  }

  return body.filter((item): item is string => typeof item === 'string');
}
