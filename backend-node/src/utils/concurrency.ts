export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const concurrency = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;

      if (current >= items.length) {
        return;
      }

      await worker(items[current], current);
    }
  });

  await Promise.all(runners);
}
