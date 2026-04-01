import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ─── Mock the 108 KB database with a minimal fixture ─────────────────────────
// vi.mock is hoisted, so this intercepts the dynamic import inside loadDb().
vi.mock('../../data/fodmap-database.json', () => ({
  default: {
    version: '1.0',
    lastUpdated: '2024-01-01',
    foods: [
      { name: 'Apple',  nameNL: 'Appel',  nameFR: 'Pomme',   category: 'Fruit',       rating: 'red',   fodmapTypes: ['polyols'], safeServing: null, notes: '', alternatives: [] },
      { name: 'Carrot', nameNL: 'Wortel', nameFR: 'Carotte', category: 'Vegetables',  rating: 'green', fodmapTypes: [],          safeServing: null, notes: '', alternatives: [] },
      { name: 'Banana', nameNL: 'Banaan', nameFR: 'Banane',  category: 'Fruit',       rating: 'green', fodmapTypes: [],          safeServing: null, notes: '', alternatives: [] },
    ],
    highFodmapIngredients: [
      { ingredient: 'onion',        fodmapType: 'fructans',        commonIn: 'savory' },
      { ingredient: 'garlic',       fodmapType: 'fructans',        commonIn: 'savory' },   // same type as onion
      { ingredient: 'milk',         fodmapType: 'lactose',         commonIn: 'dairy' },
      { ingredient: 'lait',         fodmapType: 'lactose',         commonIn: 'dairy' },    // French milk
      { ingredient: 'honey',        fodmapType: 'excess fructose', commonIn: 'sweeteners' },
      { ingredient: 'sorbitol',     fodmapType: 'polyols',         commonIn: 'sugar-free' },
      { ingredient: 'farine de blé',fodmapType: 'fructans-wheat',  commonIn: 'baked' },   // accent test
      { ingredient: 'inulin',       fodmapType: 'fructans-fiber',  commonIn: 'supplements' },
    ],
    fodmapCategories: {},
  },
}));

import { analyzeIngredients, searchFoods, ensureDb, releaseDb } from '../fodmapAnalyzer';

// ─── Load the (mocked) DB once, then reset cache between tests ───────────────

beforeAll(async () => {
  await ensureDb();
});

beforeEach(async () => {
  releaseDb();
  await ensureDb();
});

// ─── analyzeIngredients ───────────────────────────────────────────────────────

describe('analyzeIngredients', () => {
  it('returns green with no flags for an empty input', () => {
    expect(analyzeIngredients('')).toEqual({ rating: 'green', flags: [] });
  });

  it('returns green when no high-FODMAP ingredients are present', () => {
    expect(analyzeIngredients('water, salt, vinegar')).toEqual({ rating: 'green', flags: [] });
  });

  it('returns green when DB is not loaded', () => {
    releaseDb(); // clears _db without reloading
    expect(analyzeIngredients('onion, milk')).toEqual({ rating: 'green', flags: [] });
    // Reload for subsequent tests
    return ensureDb();
  });

  it('returns amber (1 FODMAP type) for a single high-FODMAP ingredient', () => {
    const { rating, flags } = analyzeIngredients('water, onion, salt');
    expect(rating).toBe('amber');
    expect(flags).toHaveLength(1);
    expect(flags[0].fodmapType).toBe('fructans');
  });

  it('returns amber (2 distinct FODMAP types) at the boundary', () => {
    const { rating, flags } = analyzeIngredients('water, onion, milk');
    expect(rating).toBe('amber');
    expect(flags).toHaveLength(2);
  });

  it('returns red when 3 or more distinct FODMAP types are detected', () => {
    // onion (fructans) + milk (lactose) + honey (excess fructose) = 3 types
    const { rating, flags } = analyzeIngredients('onion, milk, honey');
    expect(rating).toBe('red');
    expect(flags).toHaveLength(3);
  });

  it('deduplicates flags by FODMAP type, keeping the longest match', () => {
    // onion (fructans, 5 chars) + garlic (fructans, 6 chars) → keep garlic (longer)
    const { rating, flags } = analyzeIngredients('onion, garlic');
    expect(rating).toBe('amber'); // only 1 FODMAP type after dedup
    expect(flags).toHaveLength(1);
    expect(flags[0].ingredient).toBe('garlic');
  });

  it('normalises accents: input without accent matches ingredient with accent', () => {
    // "farine de blé" in the DB — input "farine de ble" (no accent) should still match
    const { rating } = analyzeIngredients('eau, farine de ble, sel');
    expect(rating).toBe('amber');
  });

  it('normalises accents: input with accent also matches', () => {
    const { rating } = analyzeIngredients('eau, farine de blé, sel');
    expect(rating).toBe('amber');
  });

  it('is case-insensitive', () => {
    expect(analyzeIngredients('Water, ONION, Salt').rating).toBe('amber');
  });

  // ─── Negation ──────────────────────────────────────────────────────────────

  it('skips a lactose flag when the segment contains a lactose-free marker', () => {
    // "lactose-free milk" → segment negated for lactose type
    const { rating, flags } = analyzeIngredients('water, lactose-free milk, salt');
    const lactoseFlag = flags.find(f => f.fodmapType === 'lactose');
    expect(lactoseFlag).toBeUndefined();
    expect(rating).toBe('green');
  });

  it('skips a lactose flag for "lait sans lactose"', () => {
    const { rating } = analyzeIngredients('eau, lait sans lactose, sel');
    expect(rating).toBe('green');
  });

  it('does NOT skip the flag when the ingredient is not negated', () => {
    const { rating } = analyzeIngredients('eau, lait, sel');
    expect(rating).toBe('amber');
  });

  // ─── Word boundary ─────────────────────────────────────────────────────────

  it('skips a match when the pattern is preceded by a word character (mid-word)', () => {
    // "quelait" contains "lait" at position 3, preceded by 'e' → no match
    const { rating } = analyzeIngredients('quelait, water');
    expect(rating).toBe('green');
  });

  it('skips a match when the pattern is followed by a word character (prefix of longer word)', () => {
    // "laitue" (lettuce) starts with "lait" but the char after is 'u' → no match
    const { rating } = analyzeIngredients('laitue, water');
    expect(rating).toBe('green');
  });

  // ─── Parenthetical handling ────────────────────────────────────────────────

  it('does not split on commas inside parentheses', () => {
    // "(rijst, maïs)" should stay as one segment so its contents are not misidentified
    const { rating, flags } = analyzeIngredients('glutenvrij meel (rijst, maïs), onion');
    expect(rating).toBe('amber');
    expect(flags).toHaveLength(1);
    expect(flags[0].ingredient).toBe('onion');
  });

  it('still detects a high-FODMAP ingredient listed outside parentheses', () => {
    const { rating } = analyzeIngredients('product (water, starch), honey, salt');
    expect(rating).toBe('amber');
  });

  // ─── Flag properties ───────────────────────────────────────────────────────

  it('populates flag.ingredient, flag.fodmapType, and flag.commonIn', () => {
    const { flags } = analyzeIngredients('milk');
    expect(flags[0]).toMatchObject({
      ingredient: 'milk',
      fodmapType: 'lactose',
      commonIn: 'dairy',
    });
  });
});

// ─── searchFoods ──────────────────────────────────────────────────────────────

describe('searchFoods', () => {
  it('returns null when the DB is not loaded', () => {
    releaseDb();
    expect(searchFoods('apple')).toBeNull();
    return ensureDb();
  });

  it('returns [] for a query shorter than 2 characters', () => {
    expect(searchFoods('')).toEqual([]);
    expect(searchFoods('a')).toEqual([]);
  });

  it('returns [] for a query with no matches', () => {
    expect(searchFoods('zzznomatch')).toEqual([]);
  });

  it('matches by English name', () => {
    const results = searchFoods('apple');
    expect(results).not.toBeNull();
    expect(results!.some(f => f.name === 'Apple')).toBe(true);
  });

  it('matches by Dutch name', () => {
    const results = searchFoods('appel');
    expect(results!.some(f => f.name === 'Apple')).toBe(true);
  });

  it('matches by French name', () => {
    const results = searchFoods('pomme');
    expect(results!.some(f => f.name === 'Apple')).toBe(true);
  });

  it('matches by category', () => {
    const results = searchFoods('fruit');
    expect(results).not.toBeNull();
    // Apple and Banana are both in Fruit category
    expect(results!.length).toBeGreaterThanOrEqual(2);
  });

  it('is case-insensitive', () => {
    expect(searchFoods('CARROT')).toEqual(searchFoods('carrot'));
  });

  it('returns the same array reference on a repeated query (LRU cache)', () => {
    const first = searchFoods('banana');
    const second = searchFoods('banana');
    expect(first).toBe(second); // same reference = cache hit
  });

  it('returns consistent results after the cache is cleared by releaseDb()', () => {
    const before = searchFoods('carrot');
    releaseDb();
    return ensureDb().then(() => {
      const after = searchFoods('carrot');
      expect(after).toEqual(before); // same data, recomputed from fresh DB
    });
  });
});
