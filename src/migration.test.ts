import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { runMigration } from './migration';

// ─── helpers ──────────────────────────────────────────────────────────────────

function seedLocalStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const MIGRATION_KEY = 'localStorage_v1';

const SAMPLE_ENTRY = {
  id: 'entry-1',
  date: '2024-01-15',
  meal: 'lunch',
  foods: [{ name: 'Rice', rating: 'green', fodmapTypes: [] }],
  timestamp: '2024-01-15T12:00:00Z',
};

const SAMPLE_SYMPTOM = {
  date: '2024-01-15',
  bloating: 2, pain: 1, gas: 0, diarrhea: 0, constipation: 0,
  nausea: 0, fatigue: 1, urgency: 0, bristol: 3,
  otherSymptoms: '', overallFeeling: 'okay',
  stress: 2, sleepQuality: 3, exercise: false, menstruation: false,
};

const SAMPLE_RECIPE = {
  name: 'Low-FODMAP Pasta',
  description: 'Simple pasta',
  prepTime: '10 min',
  cookTime: '20 min',
  servings: 2,
  ingredients: [],
  steps: ['Boil pasta'],
  tips: '',
  fodmapNotes: '',
};

beforeEach(async () => {
  localStorage.clear();
  await db.diaryEntries.clear();
  await db.symptoms.clear();
  await db.recipeFavorites.clear();
  await db.userSettings.clear();
  await db.migrations.clear();
});

// ─── basic migration ──────────────────────────────────────────────────────────

describe('runMigration — basic data migration', () => {
  it('migrates bram diary entries to IndexedDB', async () => {
    seedLocalStorage('diary_bram_entries', [SAMPLE_ENTRY]);
    await runMigration();

    const entries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('entry-1');
    expect(entries[0].user).toBe('bram');
    expect(entries[0].date).toBe('2024-01-15');
  });

  it('migrates helena diary entries to IndexedDB', async () => {
    const helenaEntry = { ...SAMPLE_ENTRY, id: 'entry-h1' };
    seedLocalStorage('diary_helena_entries', [helenaEntry]);
    await runMigration();

    const entries = await db.diaryEntries.where('user').equals('helena').toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].user).toBe('helena');
  });

  it('migrates symptoms for both users', async () => {
    seedLocalStorage('diary_bram_symptoms', [SAMPLE_SYMPTOM]);
    seedLocalStorage('diary_helena_symptoms', [{ ...SAMPLE_SYMPTOM, date: '2024-01-16' }]);
    await runMigration();

    const bramSymptoms = await db.symptoms.where('user').equals('bram').toArray();
    const helenaSymptoms = await db.symptoms.where('user').equals('helena').toArray();
    expect(bramSymptoms).toHaveLength(1);
    expect(helenaSymptoms).toHaveLength(1);
  });

  it('migrates per-user recipe favorites', async () => {
    seedLocalStorage('fodmap_favorite_recipes_bram', [SAMPLE_RECIPE]);
    await runMigration();

    const recipes = await db.recipeFavorites.where('user').equals('bram').toArray();
    expect(recipes).toHaveLength(1);
    expect(recipes[0].name).toBe('Low-FODMAP Pasta');
  });

  it('migrates global (non-user) recipe favorites to bram', async () => {
    const globalRecipe = { ...SAMPLE_RECIPE, name: 'Global Recipe' };
    seedLocalStorage('fodmap_favorite_recipes', [globalRecipe]);
    await runMigration();

    const recipes = await db.recipeFavorites.where('user').equals('bram').toArray();
    expect(recipes.some(r => r.name === 'Global Recipe')).toBe(true);
  });

  it('migrates current_user setting when it is "bram"', async () => {
    localStorage.setItem('fodmap_current_user', 'bram');
    await runMigration();

    const setting = await db.userSettings.get('current_user');
    expect(setting?.value).toBe('bram');
  });

  it('migrates current_user setting when it is "helena"', async () => {
    localStorage.setItem('fodmap_current_user', 'helena');
    await runMigration();

    const setting = await db.userSettings.get('current_user');
    expect(setting?.value).toBe('helena');
  });

  it('does NOT migrate an invalid current_user value', async () => {
    localStorage.setItem('fodmap_current_user', 'charlie');
    await runMigration();

    const setting = await db.userSettings.get('current_user');
    expect(setting).toBeUndefined();
  });
});

// ─── idempotency ──────────────────────────────────────────────────────────────

describe('runMigration — idempotency', () => {
  it('writes the migration record after completion', async () => {
    await runMigration();
    const record = await db.migrations.get(MIGRATION_KEY);
    expect(record).toBeDefined();
    expect(record?.key).toBe(MIGRATION_KEY);
  });

  it('is a no-op when called a second time', async () => {
    seedLocalStorage('diary_bram_entries', [SAMPLE_ENTRY]);
    await runMigration(); // first run: migrates data
    await runMigration(); // second run: should be a no-op

    const entries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(entries).toHaveLength(1); // not doubled
  });

  it('does not duplicate a global recipe already migrated to bram', async () => {
    const recipe = { ...SAMPLE_RECIPE, name: 'Once Only' };
    seedLocalStorage('fodmap_favorite_recipes_bram', [recipe]);
    seedLocalStorage('fodmap_favorite_recipes', [recipe]); // same name — should not duplicate
    await runMigration();

    const recipes = await db.recipeFavorites.where('user').equals('bram').toArray();
    expect(recipes.filter(r => r.name === 'Once Only')).toHaveLength(1);
  });
});

// ─── malformed / missing localStorage data ────────────────────────────────────

describe('runMigration — malformed input', () => {
  it('handles malformed JSON in diary entries gracefully (migrates nothing for that key)', async () => {
    localStorage.setItem('diary_bram_entries', '{not valid json}');
    await expect(runMigration()).resolves.not.toThrow();

    const entries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(entries).toHaveLength(0);
  });

  it('handles missing localStorage keys (no legacy data) without throwing', async () => {
    // Nothing seeded — all tryParse calls get null → return []
    await expect(runMigration()).resolves.not.toThrow();
  });

  it('handles malformed JSON in symptoms gracefully', async () => {
    localStorage.setItem('diary_bram_symptoms', 'INVALID');
    await expect(runMigration()).resolves.not.toThrow();
  });
});

// ─── localStorage cleanup ─────────────────────────────────────────────────────

describe('runMigration — localStorage cleanup', () => {
  const LEGACY_KEYS = [
    'diary_bram_entries',
    'diary_helena_entries',
    'diary_bram_symptoms',
    'diary_helena_symptoms',
    'fodmap_favorite_recipes',
    'fodmap_favorite_recipes_bram',
    'fodmap_favorite_recipes_helena',
  ];

  it('removes all legacy localStorage keys after migration', async () => {
    for (const key of LEGACY_KEYS) {
      localStorage.setItem(key, '[]');
    }
    await runMigration();

    for (const key of LEGACY_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('does not remove unrelated localStorage keys', async () => {
    localStorage.setItem('unrelated_key', 'keep me');
    await runMigration();
    expect(localStorage.getItem('unrelated_key')).toBe('keep me');
  });
});
