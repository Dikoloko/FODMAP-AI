import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  symptomScore,
  isBadDay,
  isGoodDay,
  computeCorrelations,
  getTriggerFoods,
  getSafeFoods,
  getWeeklyTrends,
  getLifestyleCorrelations,
} from '../insightEngine';
import type { DaySymptoms, DiaryEntry } from '../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

function sym(date: string, overrides: Partial<DaySymptoms> = {}): DaySymptoms {
  return {
    date,
    bloating: 0, pain: 0, gas: 0, diarrhea: 0, constipation: 0,
    nausea: 0, fatigue: 0, urgency: 0, bristol: 0,
    otherSymptoms: '', overallFeeling: 'okay',
    stress: 0, sleepQuality: 0, exercise: false, menstruation: false,
    ...overrides,
  };
}

function entry(id: string, date: string, foods: string[], meal: DiaryEntry['meal'] = 'lunch'): DiaryEntry {
  return {
    id, date, meal,
    timestamp: `${date}T12:00:00Z`,
    foods: foods.map(name => ({ name, rating: 'green' as const, fodmapTypes: [] })),
  };
}

// ─── symptomScore ────────────────────────────────────────────────────────────

describe('symptomScore', () => {
  it('returns 0 for all-zero symptoms', () => {
    expect(symptomScore(sym('2024-01-01'))).toBe(0);
  });

  it('returns 1 for all-maximum (5) symptoms', () => {
    expect(symptomScore(sym('2024-01-01', {
      bloating: 5, pain: 5, gas: 5, diarrhea: 5,
      constipation: 5, nausea: 5, fatigue: 5, urgency: 5,
    }))).toBe(1);
  });

  it('computes 0.5 for half the symptoms maxed (4 of 8 at 5)', () => {
    const score = symptomScore(sym('2024-01-01', { bloating: 5, pain: 5, gas: 5, diarrhea: 5 }));
    expect(score).toBeCloseTo(0.5);
  });

  it('treats undefined fields as 0 via nullish coalescing', () => {
    // Older diary entries may be missing fields; the ?? 0 in symptomScore handles this.
    const s: Record<string, unknown> = { ...sym('2024-01-01') };
    s['bloating'] = undefined;
    expect(symptomScore(s as unknown as DaySymptoms)).toBe(0);
  });
});

// ─── isBadDay ────────────────────────────────────────────────────────────────

describe('isBadDay', () => {
  it('returns true when overallFeeling is "bad"', () => {
    expect(isBadDay(sym('2024-01-01', { overallFeeling: 'bad' }))).toBe(true);
  });

  it('returns true when symptom score is strictly above 0.3', () => {
    // 13/40 = 0.325 > 0.3
    expect(isBadDay(sym('2024-01-01', { bloating: 5, pain: 5, gas: 3 }))).toBe(true);
  });

  it('returns false when symptom score is exactly 0.3 and feeling is okay', () => {
    // 12/40 = 0.3, NOT > 0.3
    expect(isBadDay(sym('2024-01-01', { bloating: 5, pain: 5, gas: 2 }))).toBe(false);
  });

  it('returns false for all-zero symptoms with okay feeling', () => {
    expect(isBadDay(sym('2024-01-01'))).toBe(false);
  });
});

// ─── isGoodDay ───────────────────────────────────────────────────────────────

describe('isGoodDay', () => {
  it('returns true when feeling is good AND score is below 0.15', () => {
    // 5/40 = 0.125 < 0.15
    expect(isGoodDay(sym('2024-01-01', { overallFeeling: 'good', bloating: 5 }))).toBe(true);
  });

  it('returns false when feeling is good but score is >= 0.15', () => {
    // 6/40 = 0.15, NOT < 0.15
    expect(isGoodDay(sym('2024-01-01', { overallFeeling: 'good', bloating: 5, pain: 1 }))).toBe(false);
  });

  it('returns false when score is low but feeling is "okay"', () => {
    expect(isGoodDay(sym('2024-01-01', { overallFeeling: 'okay' }))).toBe(false);
  });

  it('returns false when score is low but feeling is "bad"', () => {
    expect(isGoodDay(sym('2024-01-01', { overallFeeling: 'bad' }))).toBe(false);
  });

  it('returns false for a bad day even if overall feeling was set to "good"', () => {
    // Score 0.5 is NOT < 0.15 → false despite feeling good
    expect(isGoodDay(sym('2024-01-01', {
      overallFeeling: 'good',
      bloating: 5, pain: 5, gas: 5, diarrhea: 5,
    }))).toBe(false);
  });
});

// ─── computeCorrelations ─────────────────────────────────────────────────────

describe('computeCorrelations', () => {
  it('excludes foods eaten fewer than 2 times', () => {
    const entries = [entry('e1', '2024-01-01', ['apple'])];
    const symptoms = [sym('2024-01-01', { overallFeeling: 'bad' })];
    expect(computeCorrelations(entries, symptoms, 'bram')).toHaveLength(0);
  });

  it('excludes foods with fewer than 2 scored days (no matching symptoms)', () => {
    const entries = [
      entry('e-ns1', '2024-04-01', ['pear']),
      entry('e-ns2', '2024-04-03', ['pear']),
    ];
    // No symptom data for those dates or the day after
    expect(computeCorrelations(entries, [], 'bram')).toHaveLength(0);
  });

  it('computes badRate = 1 when all logged days have bad symptoms', () => {
    const entries = [
      entry('e-bad1', '2024-02-01', ['onion']),
      entry('e-bad2', '2024-02-03', ['onion']),
    ];
    const symptoms = [
      sym('2024-02-01', { overallFeeling: 'bad' }),
      sym('2024-02-03', { overallFeeling: 'bad' }),
    ];
    const result = computeCorrelations(entries, symptoms, 'bram');
    expect(result).toHaveLength(1);
    expect(result[0].food).toBe('onion');
    expect(result[0].badRate).toBe(1);
    expect(result[0].goodRate).toBe(0);
  });

  it('counts next-day symptoms as delayed reaction', () => {
    const entries = [
      entry('e-nd1', '2024-03-01', ['garlic']),
      entry('e-nd2', '2024-03-05', ['garlic']),
    ];
    const symptoms = [
      sym('2024-03-02', { overallFeeling: 'bad' }),  // next day after e-nd1
      sym('2024-03-06', { overallFeeling: 'good' }), // next day after e-nd2 (good)
    ];
    const result = computeCorrelations(entries, symptoms, 'bram');
    expect(result).toHaveLength(1);
    expect(result[0].badDaysAfter).toBe(1);
    expect(result[0].goodDaysAfter).toBe(1);
  });

  it('uses the worse of same-day and next-day symptoms', () => {
    // same-day: okay, next-day: bad → should count as bad
    const entries = [
      entry('e-w1', '2024-05-01', ['milk']),
      entry('e-w2', '2024-05-05', ['milk']),
    ];
    const symptoms = [
      sym('2024-05-01', { overallFeeling: 'okay' }),  // same day: okay
      sym('2024-05-02', { overallFeeling: 'bad' }),   // next day: bad → worse wins
      sym('2024-05-05', { overallFeeling: 'bad' }),
      sym('2024-05-06', { overallFeeling: 'okay' }),
    ];
    const result = computeCorrelations(entries, symptoms, 'bram');
    expect(result[0].badRate).toBe(1); // both instances had a bad day within 24h
  });

  it('returns the same reference for identical inputs (cache hit)', () => {
    const entries = [
      entry('e-c1', '2024-06-01', ['banana']),
      entry('e-c2', '2024-06-03', ['banana']),
    ];
    const symptoms = [sym('2024-06-01', { overallFeeling: 'okay' })];
    const first = computeCorrelations(entries, symptoms, 'bram');
    const second = computeCorrelations(entries, symptoms, 'bram');
    expect(first).toBe(second); // same object reference = cached
  });

  it('invalidates the cache when entry IDs change', () => {
    const entries1 = [
      entry('e-i1', '2024-07-01', ['rice']),
      entry('e-i2', '2024-07-03', ['rice']),
    ];
    const entries2 = [
      entry('e-i1', '2024-07-01', ['rice']),
      entry('e-i3', '2024-07-05', ['rice']), // different id → different cache key
    ];
    const symptoms = [sym('2024-07-01', { overallFeeling: 'bad' })];
    const first = computeCorrelations(entries1, symptoms, 'bram');
    const second = computeCorrelations(entries2, symptoms, 'bram');
    expect(first).not.toBe(second);
  });

  it('is case-insensitive for food names', () => {
    const entries = [
      entry('e-ci1', '2024-08-01', ['Apple']),
      entry('e-ci2', '2024-08-03', ['apple']), // lowercase
    ];
    const symptoms = [
      sym('2024-08-01', { overallFeeling: 'bad' }),
      sym('2024-08-03', { overallFeeling: 'bad' }),
    ];
    const result = computeCorrelations(entries, symptoms, 'bram');
    // Both 'Apple' and 'apple' should be the same food
    expect(result).toHaveLength(1);
    expect(result[0].timesEaten).toBe(2);
  });
});

// ─── getTriggerFoods ──────────────────────────────────────────────────────────

describe('getTriggerFoods', () => {
  it('includes foods with badRate >= 0.5', () => {
    const correlations = [
      { food: 'onion', timesEaten: 4, badDaysAfter: 4, goodDaysAfter: 0, badRate: 1.0, goodRate: 0, avgSymptomScore: 0.7 },
      { food: 'carrot', timesEaten: 4, badDaysAfter: 1, goodDaysAfter: 3, badRate: 0.25, goodRate: 0.75, avgSymptomScore: 0.1 },
    ];
    const triggers = getTriggerFoods(correlations);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].food).toBe('onion');
  });

  it('excludes foods with badRate exactly below 0.5', () => {
    const correlations = [
      { food: 'rice', timesEaten: 4, badDaysAfter: 1, goodDaysAfter: 2, badRate: 0.49, goodRate: 0.5, avgSymptomScore: 0.2 },
    ];
    expect(getTriggerFoods(correlations)).toHaveLength(0);
  });

  it('sorts by badRate descending, ties broken by avgSymptomScore', () => {
    const correlations = [
      { food: 'a', timesEaten: 4, badDaysAfter: 3, goodDaysAfter: 0, badRate: 0.75, goodRate: 0, avgSymptomScore: 0.3 },
      { food: 'b', timesEaten: 4, badDaysAfter: 4, goodDaysAfter: 0, badRate: 1.0, goodRate: 0, avgSymptomScore: 0.2 },
      { food: 'c', timesEaten: 4, badDaysAfter: 3, goodDaysAfter: 0, badRate: 0.75, goodRate: 0, avgSymptomScore: 0.6 },
    ];
    const result = getTriggerFoods(correlations);
    expect(result[0].food).toBe('b');  // highest badRate
    expect(result[1].food).toBe('c');  // tied badRate, higher avgSymptomScore
    expect(result[2].food).toBe('a');
  });
});

// ─── getSafeFoods ─────────────────────────────────────────────────────────────

describe('getSafeFoods', () => {
  it('includes foods with goodRate >= 0.5 AND badRate < 0.25', () => {
    const correlations = [
      { food: 'rice', timesEaten: 5, badDaysAfter: 0, goodDaysAfter: 4, badRate: 0, goodRate: 0.8, avgSymptomScore: 0.05 },
    ];
    const safe = getSafeFoods(correlations);
    expect(safe).toHaveLength(1);
    expect(safe[0].food).toBe('rice');
  });

  it('excludes foods with badRate >= 0.25 even when goodRate is high', () => {
    const correlations = [
      { food: 'oats', timesEaten: 5, badDaysAfter: 1, goodDaysAfter: 4, badRate: 0.25, goodRate: 0.8, avgSymptomScore: 0.2 },
    ];
    expect(getSafeFoods(correlations)).toHaveLength(0);
  });

  it('excludes foods with goodRate < 0.5 even when badRate is zero', () => {
    const correlations = [
      { food: 'pasta', timesEaten: 5, badDaysAfter: 0, goodDaysAfter: 2, badRate: 0, goodRate: 0.4, avgSymptomScore: 0.1 },
    ];
    expect(getSafeFoods(correlations)).toHaveLength(0);
  });

  it('sorts by goodRate descending', () => {
    const correlations = [
      { food: 'a', timesEaten: 5, badDaysAfter: 0, goodDaysAfter: 3, badRate: 0, goodRate: 0.6, avgSymptomScore: 0.05 },
      { food: 'b', timesEaten: 5, badDaysAfter: 0, goodDaysAfter: 5, badRate: 0, goodRate: 1.0, avgSymptomScore: 0.05 },
    ];
    const result = getSafeFoods(correlations);
    expect(result[0].food).toBe('b');
    expect(result[1].food).toBe('a');
  });
});

// ─── getWeeklyTrends ──────────────────────────────────────────────────────────

describe('getWeeklyTrends', () => {
  // Pin time to a Saturday so week boundaries are predictable
  const FIXED_NOW = new Date('2024-06-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns exactly numWeeks entries', () => {
    expect(getWeeklyTrends([], 1)).toHaveLength(1);
    expect(getWeeklyTrends([], 4)).toHaveLength(4);
    expect(getWeeklyTrends([], 8)).toHaveLength(8);
  });

  it('returns zero-value entries for weeks with no logged symptoms', () => {
    const trends = getWeeklyTrends([], 2);
    for (const t of trends) {
      expect(t.avgScore).toBe(0);
      expect(t.daysLogged).toBe(0);
      expect(t.badDays).toBe(0);
      expect(t.goodDays).toBe(0);
    }
  });

  it('places a symptom in the correct week bucket', () => {
    // Today = Jun 15. Current week = Jun 09–15. A symptom on Jun 12 should land there.
    const symptoms = [
      sym('2024-06-12', {
        bloating: 5, pain: 5, gas: 5, diarrhea: 5,
        constipation: 5, nausea: 5, fatigue: 5, urgency: 5,
      }),
    ];
    const trends = getWeeklyTrends(symptoms, 1);
    expect(trends[0].daysLogged).toBe(1);
    expect(trends[0].avgScore).toBeCloseTo(1.0);
  });

  it('excludes symptoms older than the requested window', () => {
    // 5 weeks ago: ~May 11 — outside a 4-week window
    const symptoms = [sym('2024-05-11', { bloating: 5 })];
    const trends = getWeeklyTrends(symptoms, 4);
    const total = trends.reduce((s, t) => s + t.daysLogged, 0);
    expect(total).toBe(0);
  });

  it('correctly counts bad and good days per week', () => {
    const symptoms = [
      sym('2024-06-10', { overallFeeling: 'bad' }),
      sym('2024-06-11', { overallFeeling: 'good' }),
    ];
    const [week] = getWeeklyTrends(symptoms, 1);
    expect(week.badDays).toBe(1);
    expect(week.goodDays).toBe(1);
    expect(week.daysLogged).toBe(2);
  });

  it('includes a symptom on the last day of the week boundary', () => {
    // Jun 15 is the end of the current week — must be included
    const symptoms = [sym('2024-06-15', { bloating: 3 })];
    const [week] = getWeeklyTrends(symptoms, 1);
    expect(week.daysLogged).toBe(1);
  });
});

// ─── getLifestyleCorrelations ─────────────────────────────────────────────────

describe('getLifestyleCorrelations', () => {
  it('returns [] when fewer than 5 symptoms are provided', () => {
    expect(getLifestyleCorrelations([
      sym('2024-01-01'), sym('2024-01-02'), sym('2024-01-03'),
    ])).toHaveLength(0);
  });

  it('includes a stress correlation when both high-stress and low-stress groups have ≥ 2 days', () => {
    const symptoms = [
      sym('2024-01-01', { stress: 5, bloating: 5, pain: 5 }),
      sym('2024-01-02', { stress: 4, bloating: 5, pain: 5 }),
      sym('2024-01-03', { stress: 1, bloating: 0 }),
      sym('2024-01-04', { stress: 2, bloating: 0 }),
      sym('2024-01-05', { stress: 1, bloating: 0 }),
    ];
    const results = getLifestyleCorrelations(symptoms);
    const stress = results.find(r => r.factor === 'High stress');
    expect(stress).toBeDefined();
    expect(stress!.difference).toBeGreaterThan(0); // stress makes things worse
    expect(stress!.daysPresent).toBe(2);
  });

  it('omits a factor when one group has fewer than 2 data points', () => {
    // Only 1 high-stress day → stress factor excluded
    const symptoms = [
      sym('2024-01-01', { stress: 5 }),
      sym('2024-01-02', { stress: 1 }),
      sym('2024-01-03', { stress: 1 }),
      sym('2024-01-04', { stress: 2 }),
      sym('2024-01-05', { stress: 1 }),
    ];
    const results = getLifestyleCorrelations(symptoms);
    expect(results.find(r => r.factor === 'High stress')).toBeUndefined();
  });

  it('includes exercise correlation and computes difference correctly', () => {
    const symptoms = [
      sym('2024-01-01', { exercise: true, bloating: 0 }),
      sym('2024-01-02', { exercise: true, bloating: 0 }),
      sym('2024-01-03', { exercise: false, bloating: 5, pain: 5 }),
      sym('2024-01-04', { exercise: false, bloating: 5, pain: 5 }),
      sym('2024-01-05', { exercise: false, bloating: 5 }),
    ];
    const results = getLifestyleCorrelations(symptoms);
    const ex = results.find(r => r.factor === 'Exercise');
    expect(ex).toBeDefined();
    // Exercise days are better (lower score) → difference should be negative
    expect(ex!.difference).toBeLessThan(0);
  });

  it('sorts results by absolute difference descending', () => {
    // Create data so stress has a larger difference than exercise
    const symptoms = [
      sym('2024-01-01', { stress: 5, bloating: 5, pain: 5, gas: 5, exercise: true }),
      sym('2024-01-02', { stress: 5, bloating: 5, pain: 5, gas: 5, exercise: false }),
      sym('2024-01-03', { stress: 1, bloating: 0, exercise: true }),
      sym('2024-01-04', { stress: 1, bloating: 0, exercise: false }),
      sym('2024-01-05', { stress: 1, exercise: true }),
      sym('2024-01-06', { stress: 1, exercise: false }),
    ];
    const results = getLifestyleCorrelations(symptoms);
    for (let i = 1; i < results.length; i++) {
      expect(Math.abs(results[i - 1].difference))
        .toBeGreaterThanOrEqual(Math.abs(results[i].difference));
    }
  });
});
