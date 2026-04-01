import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataExport } from '../useDataExport';
import { db } from '../../db';
import type { ExportData } from '../useDataExport';

// ─── DB cleanup between tests ─────────────────────────────────────────────────

beforeEach(async () => {
  await db.diaryEntries.clear();
  await db.symptoms.clear();
  await db.recipeFavorites.clear();
  await db.userSettings.clear();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeFile(content: string, sizeOverride?: number): File {
  const file = new File([content], 'backup.json', { type: 'application/json' });
  if (sizeOverride !== undefined) {
    Object.defineProperty(file, 'size', { value: sizeOverride, configurable: true });
  }
  return file;
}

function makeBackup(overrides: Partial<ExportData> = {}): ExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    users: {
      bram: {
        diaryEntries: [],
        symptoms: [],
        recipeFavorites: [],
      },
    },
    settings: {},
    ...overrides,
  };
}

function backupFile(data: ExportData | unknown): File {
  return makeFile(JSON.stringify(data));
}

// ─── file size guard ──────────────────────────────────────────────────────────

describe('importData — file size guard', () => {
  it('sets importError and returns early when file exceeds 10 MB', async () => {
    const { result } = renderHook(() => useDataExport());
    const bigFile = makeFile('{}', 11 * 1024 * 1024);

    await act(async () => {
      await result.current.importData(bigFile);
    });

    expect(result.current.importError).toBe('File too large. Max 10 MB.');
    expect(result.current.importing).toBe(false);
  });

  it('does not write to the DB when the file is too large', async () => {
    const { result } = renderHook(() => useDataExport());
    const bigFile = makeFile('{}', 11 * 1024 * 1024);

    await act(async () => {
      await result.current.importData(bigFile);
    });

    expect(await db.diaryEntries.count()).toBe(0);
  });
});

// ─── schema validation ────────────────────────────────────────────────────────

describe('importData — schema validation', () => {
  it('sets importError for unsupported version', async () => {
    const { result } = renderHook(() => useDataExport());

    await act(async () => {
      await result.current.importData(backupFile({ ...makeBackup(), version: 99 }));
    });

    expect(result.current.importError).toContain('Unsupported backup format version');
  });

  it('sets importError when users is missing', async () => {
    const { result } = renderHook(() => useDataExport());

    await act(async () => {
      await result.current.importData(backupFile({ version: 1 }));
    });

    expect(result.current.importError).toBeTruthy();
  });

  it('sets importError when diaryEntries is not an array', async () => {
    const { result } = renderHook(() => useDataExport());
    const bad = makeBackup();
    (bad.users.bram as unknown as Record<string, unknown>)['diaryEntries'] = 'not-an-array';

    await act(async () => {
      await result.current.importData(backupFile(bad));
    });

    expect(result.current.importError).toContain('diaryEntries must be an array');
  });

  it('sets importError for unparseable JSON', async () => {
    const { result } = renderHook(() => useDataExport());

    await act(async () => {
      await result.current.importData(makeFile('{bad json}'));
    });

    expect(result.current.importError).toBeTruthy();
  });
});

// ─── diary entry import ───────────────────────────────────────────────────────

describe('importData — diary entries', () => {
  it('imports valid diary entries into the DB', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [{
            id: 'e1',
            date: '2024-01-15',
            meal: 'lunch',
            foods: [{ name: 'Rice', rating: 'green', fodmapTypes: [] }],
            timestamp: '2024-01-15T12:00:00Z',
          }],
          symptoms: [],
          recipeFavorites: [],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    expect(result.current.importSuccess).toBe(true);
    const entries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('e1');
    expect(entries[0].user).toBe('bram');
  });

  it('skips entries with an invalid meal type (warns, does not abort)', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [
            { id: 'bad', date: '2024-01-15', meal: 'midnight-snack' as never, foods: [], timestamp: '2024-01-15T00:00:00Z' },
            { id: 'good', date: '2024-01-16', meal: 'dinner', foods: [], timestamp: '2024-01-16T18:00:00Z' },
          ],
          symptoms: [],
          recipeFavorites: [],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    expect(result.current.importSuccess).toBe(true); // import completed
    const entries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(entries).toHaveLength(1);        // invalid entry was skipped
    expect(entries[0].id).toBe('good');
  });

  it('skips entries with an invalid date format', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [
            { id: 'bad-date', date: '15/01/2024', meal: 'lunch', foods: [], timestamp: '2024-01-15T12:00:00Z' },
          ],
          symptoms: [],
          recipeFavorites: [],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    expect(await db.diaryEntries.count()).toBe(0);
  });

  it('generates a new ID when an entry ID belongs to a different user', async () => {
    // Plant an existing entry for helena with id 'shared-id'
    await db.diaryEntries.put({
      id: 'shared-id', date: '2024-01-10', meal: 'breakfast', foods: [],
      timestamp: '2024-01-10T08:00:00Z', user: 'helena',
    });

    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [{
            id: 'shared-id',          // same id, but this is bram's entry
            date: '2024-01-15',
            meal: 'lunch',
            foods: [],
            timestamp: '2024-01-15T12:00:00Z',
          }],
          symptoms: [],
          recipeFavorites: [],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    // Both helena's original and bram's new entry must coexist
    const helenaEntry = await db.diaryEntries.get('shared-id');
    expect(helenaEntry?.user).toBe('helena'); // original preserved

    const bramEntries = await db.diaryEntries.where('user').equals('bram').toArray();
    expect(bramEntries).toHaveLength(1);
    expect(bramEntries[0].id).not.toBe('shared-id'); // got a new ID
  });

  it('silently ignores unknown user keys', async () => {
    const { result } = renderHook(() => useDataExport());
    // "charlie" is not a valid User
    const backup = { ...makeBackup(), users: { charlie: { diaryEntries: [], symptoms: [], recipeFavorites: [] } } };

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    // No error, but nothing written
    expect(result.current.importError).toBeNull();
    expect(await db.diaryEntries.count()).toBe(0);
  });
});

// ─── symptom import ───────────────────────────────────────────────────────────

describe('importData — symptoms', () => {
  it('imports symptoms and truncates otherSymptoms to 500 characters', async () => {
    const { result } = renderHook(() => useDataExport());
    const longText = 'x'.repeat(600);
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [],
          symptoms: [{
            date: '2024-01-15',
            bloating: 2, pain: 0, gas: 1, diarrhea: 0, constipation: 0,
            nausea: 0, fatigue: 0, urgency: 0, bristol: 3,
            otherSymptoms: longText,
            overallFeeling: 'okay',
            stress: 1, sleepQuality: 3, exercise: false, menstruation: false,
          }],
          recipeFavorites: [],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    const symptoms = await db.symptoms.where('user').equals('bram').toArray();
    expect(symptoms).toHaveLength(1);
    expect(symptoms[0].otherSymptoms).toHaveLength(500);
  });
});

// ─── recipe import ────────────────────────────────────────────────────────────

describe('importData — recipe favorites', () => {
  it('imports recipe favorites', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [],
          symptoms: [],
          recipeFavorites: [{
            name: 'Low-FODMAP Pasta',
            description: 'Simple',
            prepTime: '10 min', cookTime: '20 min', servings: 2,
            ingredients: [], steps: ['Boil pasta'], tips: '', fodmapNotes: '',
          }],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    const recipes = await db.recipeFavorites.where('user').equals('bram').toArray();
    expect(recipes).toHaveLength(1);
    expect(recipes[0].name).toBe('Low-FODMAP Pasta');
  });

  it('does not insert a duplicate recipe with the same [user+name]', async () => {
    // Pre-seed a recipe
    await db.recipeFavorites.add({
      name: 'Low-FODMAP Pasta', description: 'Existing', prepTime: '10 min',
      cookTime: '20 min', servings: 2, ingredients: [], steps: [], tips: '', fodmapNotes: '',
      user: 'bram',
    });

    const { result } = renderHook(() => useDataExport());
    const backup = makeBackup({
      users: {
        bram: {
          diaryEntries: [],
          symptoms: [],
          recipeFavorites: [{
            name: 'Low-FODMAP Pasta', // same name
            description: 'Duplicate',
            prepTime: '10 min', cookTime: '20 min', servings: 2,
            ingredients: [], steps: [], tips: '', fodmapNotes: '',
          }],
        },
      },
    });

    await act(async () => {
      await result.current.importData(backupFile(backup));
    });

    const recipes = await db.recipeFavorites.where('user').equals('bram').toArray();
    expect(recipes).toHaveLength(1); // not doubled
    expect(recipes[0].description).toBe('Existing'); // original kept
  });
});

// ─── export ───────────────────────────────────────────────────────────────────

describe('exportData', () => {
  it('does not throw when the database is empty', async () => {
    const { result } = renderHook(() => useDataExport());
    // exportData triggers a download; in jsdom that is a no-op but must not throw
    await act(async () => {
      await expect(result.current.exportData()).resolves.not.toThrow();
    });
  });
});
