import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCached, setCached, cleanExpiredCache, startPeriodicCacheCleanup } from '../storage';

const PREFIX = 'off_cache_';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── getCached / setCached round-trip ─────────────────────────────────────────

describe('getCached / setCached', () => {
  it('returns null for a key that was never set', () => {
    expect(getCached('missing')).toBeNull();
  });

  it('stores and retrieves a primitive value', () => {
    setCached('str', 'hello');
    expect(getCached<string>('str')).toBe('hello');
  });

  it('stores and retrieves an object', () => {
    setCached('obj', { a: 1, b: [2, 3] });
    expect(getCached<{ a: number; b: number[] }>('obj')).toEqual({ a: 1, b: [2, 3] });
  });

  it('uses the off_cache_ prefix so other localStorage keys are unaffected', () => {
    localStorage.setItem('other', 'untouched');
    setCached('test', 42);
    expect(localStorage.getItem('other')).toBe('untouched');
    expect(localStorage.getItem(PREFIX + 'test')).not.toBeNull();
  });

  it('omits the ttl field in raw storage when using the default TTL', () => {
    setCached('default', 'val');
    const raw = localStorage.getItem(PREFIX + 'default')!;
    expect(JSON.parse(raw).ttl).toBeUndefined();
  });

  it('writes the ttl field when a custom TTL is given', () => {
    setCached('custom', 'val', 5_000);
    const raw = localStorage.getItem(PREFIX + 'custom')!;
    expect(JSON.parse(raw).ttl).toBe(5_000);
  });
});

// ─── TTL expiry ───────────────────────────────────────────────────────────────

describe('TTL expiry', () => {
  it('returns null for an expired entry and removes the key', () => {
    vi.useFakeTimers();
    setCached('expiring', 'value', 100);
    vi.advanceTimersByTime(101);
    expect(getCached('expiring')).toBeNull();
    expect(localStorage.getItem(PREFIX + 'expiring')).toBeNull();
  });

  it('returns the value before the TTL elapses', () => {
    vi.useFakeTimers();
    setCached('alive', 'value', 500);
    vi.advanceTimersByTime(499);
    expect(getCached<string>('alive')).toBe('value');
  });

  it('respects a custom TTL independently of the default', () => {
    vi.useFakeTimers();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    setCached('short', 'val', 1_000);
    setCached('long', 'val', WEEK);
    vi.advanceTimersByTime(2_000);
    expect(getCached('short')).toBeNull();
    expect(getCached<string>('long')).toBe('val');
  });
});

// ─── QuotaExceededError eviction ──────────────────────────────────────────────

describe('setCached — QuotaExceededError eviction', () => {
  it('evicts the oldest cache entry and retries when storage is full', () => {
    const now = Date.now();
    // Plant an old entry directly so it is the eviction target
    localStorage.setItem(PREFIX + 'old', JSON.stringify({ data: 'old', timestamp: now - 10_000 }));
    localStorage.setItem(PREFIX + 'newer', JSON.stringify({ data: 'newer', timestamp: now - 1_000 }));

    let callCount = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === PREFIX + 'target' && callCount++ === 0) {
        // Throw only on the first attempt
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      original.call(this, k, v);
    };

    setCached('target', 'fresh');

    expect(localStorage.getItem(PREFIX + 'old')).toBeNull();      // evicted
    expect(localStorage.getItem(PREFIX + 'newer')).not.toBeNull(); // kept
    expect(getCached<string>('target')).toBe('fresh');
  });

  it('warns and gives up when all cache entries are exhausted', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Mock setItem to always throw
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    setCached('never-stored', 'val');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache_quota_exceeded'));
  });
});

// ─── cleanExpiredCache ────────────────────────────────────────────────────────

describe('cleanExpiredCache', () => {
  it('removes expired entries and leaves valid ones', () => {
    vi.useFakeTimers();
    setCached('keep', 'alive', 60_000);
    setCached('remove', 'dead', 100);
    vi.advanceTimersByTime(200);
    cleanExpiredCache();
    expect(getCached<string>('keep')).toBe('alive');
    expect(localStorage.getItem(PREFIX + 'remove')).toBeNull();
  });

  it('removes unparseable / corrupt entries', () => {
    localStorage.setItem(PREFIX + 'corrupt', '{not valid json}');
    cleanExpiredCache();
    expect(localStorage.getItem(PREFIX + 'corrupt')).toBeNull();
  });

  it('does not touch non-cache keys', () => {
    localStorage.setItem('unrelated', 'stay');
    cleanExpiredCache();
    expect(localStorage.getItem('unrelated')).toBe('stay');
  });

  it('does nothing when there are no cache entries', () => {
    expect(() => cleanExpiredCache()).not.toThrow();
  });
});

// ─── startPeriodicCacheCleanup ────────────────────────────────────────────────

describe('startPeriodicCacheCleanup', () => {
  it('runs cleanup on the given interval', () => {
    vi.useFakeTimers();
    setCached('periodic', 'val', 100); // expires in 100 ms
    vi.advanceTimersByTime(50); // not expired yet

    const cancel = startPeriodicCacheCleanup(200); // cleanup every 200 ms
    vi.advanceTimersByTime(200); // first cleanup fires

    // Entry expired at t=100, cleanup ran at t=250 — should be gone
    expect(localStorage.getItem(PREFIX + 'periodic')).toBeNull();
    cancel();
  });

  it('returned cancel function stops further cleanups', () => {
    vi.useFakeTimers();
    const cancel = startPeriodicCacheCleanup(200);
    cancel();

    setCached('stays', 'val', 100);
    vi.advanceTimersByTime(500); // would fire multiple times if not cancelled

    // Entry expired but cleanup never ran after cancel → key still present
    const raw = localStorage.getItem(PREFIX + 'stays');
    expect(raw).not.toBeNull();
  });
});
