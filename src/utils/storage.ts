const CACHE_PREFIX = 'off_cache_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedItem<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const item: CachedItem<T> = JSON.parse(raw);
    if (Date.now() - item.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return item.data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  try {
    const item: CachedItem<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch {
    // localStorage full — ignore
  }
}
