import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lookupBarcode } from '../api';

// ─── Setup ────────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BARCODE = '5449000000996';
const PRODUCT = {
  product_name: 'Coca-Cola',
  brands: 'Coca-Cola',
  image_front_small_url: 'https://example.com/img.jpg',
  ingredients_text: 'water, sugar, CO2',
};

// ─── happy path ───────────────────────────────────────────────────────────────

describe('lookupBarcode — happy path', () => {
  it('returns the product for a known barcode', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 1, product: PRODUCT }));
    const result = await lookupBarcode(BARCODE);
    expect(result).toMatchObject({ product_name: 'Coca-Cola' });
  });

  it('caches the product so a second call skips fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 1, product: PRODUCT }));
    await lookupBarcode(BARCODE);
    const cached = await lookupBarcode(BARCODE);
    expect(mockFetch).toHaveBeenCalledTimes(1); // only fetched once
    expect(cached).toMatchObject({ product_name: 'Coca-Cola' });
  });

  it('includes the required fields in the fetch URL', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 1, product: PRODUCT }));
    await lookupBarcode(BARCODE);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(BARCODE);
    expect(url).toContain('fields=');
    expect(url).toContain('product_name');
    expect(url).toContain('ingredients_text');
  });
});

// ─── not-found paths ──────────────────────────────────────────────────────────

describe('lookupBarcode — not-found', () => {
  it('returns null for an HTTP 404 and caches the negative result', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = await lookupBarcode('0000000000001');
    expect(result).toBeNull();
    // Second call should not fetch again
    const cached = await lookupBarcode('0000000000001');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(cached).toBeNull();
  });

  it('returns null when the OFF API returns status:0 (product not in database)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 0 }));
    const result = await lookupBarcode('0000000000002');
    expect(result).toBeNull();
  });

  it('caches negative (not-found) results with the 24-hour TTL, not the 7-day default', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await lookupBarcode('0000000000003');

    const raw = localStorage.getItem('off_cache_barcode_0000000000003');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // A custom TTL of 24h should be stored; 7-day default would have no ttl field
    expect(parsed.ttl).toBe(24 * 60 * 60 * 1000);
  });

  it('returns null from cache without fetching for a previously not-found barcode', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await lookupBarcode('0000000000004');
    mockFetch.mockReset();

    const result = await lookupBarcode('0000000000004');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

// ─── error paths ──────────────────────────────────────────────────────────────

describe('lookupBarcode — error handling', () => {
  it('throws for non-404 HTTP errors (e.g. 429 rate limit)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(lookupBarcode('9999999999991')).rejects.toThrow('429');
  });

  it('throws for 500 server error', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(lookupBarcode('9999999999992')).rejects.toThrow();
  });

  it('propagates network / AbortError when the 8-second timeout fires', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );
    await expect(lookupBarcode('9999999999993')).rejects.toThrow();
  });

  it('does not cache an error response (next call will retry)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(lookupBarcode('9999999999994')).rejects.toThrow();

    // Second call should attempt fetch again (not return null from cache)
    mockFetch.mockResolvedValueOnce(makeResponse({ status: 1, product: PRODUCT }));
    const result = await lookupBarcode('9999999999994');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ product_name: 'Coca-Cola' });
  });
});
