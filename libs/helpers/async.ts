import { Cache } from 'cache-manager';

/** Maps `items` through `fn` with at most `limit` calls in flight, keeping their order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** The cached value for `key`, or `load()`'s result, cached for `ttl` ms. Failed loads aren't cached. */
export async function cached<T>(
  cache: Cache,
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== undefined && hit !== null) return hit;
  const value = await load();
  await cache.set(key, value, ttl);
  return value;
}
