import { logger } from './logger';

const CACHE_PREFIX = 'off_cache_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl?: number; // if omitted, defaults to CACHE_TTL (backward-compatible)
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const item: CachedItem<T> = JSON.parse(raw);
    const ttl = item.ttl ?? CACHE_TTL;
    if (Date.now() - item.timestamp > ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return item.data;
  } catch {
    return null;
  }
}

// Returns true if an entry was found and removed, false if nothing left to evict.
function evictOldestCacheEntry(): boolean {
  let oldestKey: string | null = null;
  let oldestTimestamp = Infinity;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const item = JSON.parse(raw) as CachedItem<unknown>;
          if (item.timestamp < oldestTimestamp) {
            oldestTimestamp = item.timestamp;
            oldestKey = k;
          }
        }
      } catch {
        // ignore unparseable entries
      }
    }
  }
  if (oldestKey) {
    localStorage.removeItem(oldestKey);
    return true;
  }
  return false;
}

export function setCached<T>(key: string, data: T, ttl = CACHE_TTL): void {
  const item: CachedItem<T> = {
    data,
    timestamp: Date.now(),
    ...(ttl !== CACHE_TTL && { ttl }),
  };
  const serialized = JSON.stringify(item);
  try {
    localStorage.setItem(CACHE_PREFIX + key, serialized);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Keep evicting oldest cache entries until setItem succeeds or nothing left to evict
      while (evictOldestCacheEntry()) {
        try {
          localStorage.setItem(CACHE_PREFIX + key, serialized);
          return;
        } catch {
          // Still full — evict another and retry
        }
      }
      // All cache entries exhausted and still full — log and give up
      logger.warn('cache_quota_exceeded', { key, sizeKb: Math.round(serialized.length / 1024) });
    }
  }
}

// Call on app startup to proactively remove expired entries.
// Returns a cleanup function that cancels the interval (for HMR).
export function startPeriodicCacheCleanup(intervalMs = 60 * 60 * 1000): () => void {
  const id = setInterval(cleanExpiredCache, intervalMs);
  return () => clearInterval(id);
}

export function cleanExpiredCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const item = JSON.parse(raw) as CachedItem<unknown>;
          const itemTtl = item.ttl ?? CACHE_TTL;
          if (Date.now() - item.timestamp > itemTtl) {
            toRemove.push(k);
          }
        }
      } catch {
        toRemove.push(k!);
      }
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
