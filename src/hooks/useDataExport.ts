import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { toDateString } from '../utils/dateHelpers';
import type { DiaryEntry, DaySymptoms, User } from '../types';
import type { Recipe } from './useRecipeGenerator';
import { logger } from '../utils/logger';

interface UserExportData {
  diaryEntries: DiaryEntry[];
  symptoms: DaySymptoms[];
  recipeFavorites: Recipe[];
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  users: Partial<Record<User, UserExportData>>;
  settings: Record<string, string>;
}

export function useDataExport() {
  const [importing, setImporting] = useState(false);
  const importSuccessTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { if (importSuccessTimer.current) clearTimeout(importSuccessTimer.current); }, []);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const exportData = useCallback(async () => {
    const users: User[] = ['bram', 'helena'];
    const exportObj: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users: {},
      settings: {},
    };

    for (const user of users) {
      const rawEntries = await db.diaryEntries.where('user').equals(user).toArray();
      const rawSymptoms = await db.symptoms.where('user').equals(user).toArray();
      const rawRecipes = await db.recipeFavorites.where('user').equals(user).toArray();

      exportObj.users[user] = {
        diaryEntries: rawEntries.map(({ user: _, ...e }) => e as DiaryEntry),
        symptoms: rawSymptoms.map(({ user: _, ...s }) => s as DaySymptoms),
        recipeFavorites: rawRecipes.map((r) => ({
          name: r.name,
          description: r.description,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          servings: r.servings,
          ingredients: r.ingredients,
          steps: r.steps,
          tips: r.tips,
          fodmapNotes: r.fodmapNotes,
        })),
      };
    }

    const settingRecords = await db.userSettings.toArray();
    for (const { key, value } of settingRecords) {
      exportObj.settings[key] = value;
    }

    const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const exportDate = new Date();
    a.download = `fodmap-backup-${toDateString(exportDate)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setImportError('File too large. Max 10 MB.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;

      if (data.version !== 1) throw new Error('Unsupported backup format version');
      if (!data.users || typeof data.users !== 'object') throw new Error('Invalid backup file');
      for (const [, userData] of Object.entries(data.users)) {
        if (!userData) continue;
        const u = userData as unknown as Record<string, unknown>;
        if (!Array.isArray(u.diaryEntries)) throw new Error('Invalid backup: diaryEntries must be an array');
        if (!Array.isArray(u.symptoms)) throw new Error('Invalid backup: symptoms must be an array');
      }

      await db.transaction(
        'rw',
        db.diaryEntries,
        db.symptoms,
        db.recipeFavorites,
        db.userSettings,
        async () => {
          for (const [userKey, userData] of Object.entries(data.users)) {
            if (!userData) continue;
            if (userKey !== 'bram' && userKey !== 'helena') continue;
            const user = userKey as User;

            const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
            const VALID_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

            let skippedEntries = 0;
            for (const entry of userData.diaryEntries ?? []) {
              if (
                typeof entry.id !== 'string' ||
                !DATE_RE.test(entry.date) ||
                !Array.isArray(entry.foods) ||
                !VALID_MEALS.has(entry.meal)
              ) {
                skippedEntries++;
                continue;
              }
              const existing = await db.diaryEntries.get(entry.id);
              const entryToSave = existing && existing.user !== user
                ? { ...entry, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
                : entry;
              await db.diaryEntries.put({ ...entryToSave, user });
            }
            if (skippedEntries > 0) {
              logger.warn('import_skipped_invalid_entries', { user: userKey, count: skippedEntries });
            }

            for (const symptom of userData.symptoms ?? []) {
              await db.symptoms.put({
                ...symptom,
                otherSymptoms: String(symptom.otherSymptoms ?? '').slice(0, 500),
                user,
              });
            }

            for (const recipe of userData.recipeFavorites ?? []) {
              const exists = await db.recipeFavorites
                .where('[user+name]')
                .equals([user, recipe.name])
                .count();
              if (exists === 0) {
                await db.recipeFavorites.add({ ...recipe, user });
              }
            }
          }

          for (const [key, value] of Object.entries(data.settings ?? {})) {
            await db.userSettings.put({ key, value: String(value) });
          }
        }
      );

      setImportSuccess(true);
      if (importSuccessTimer.current) clearTimeout(importSuccessTimer.current);
      importSuccessTimer.current = setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setImporting(false);
    }
  }, []);

  return { exportData, importData, importing, importError, importSuccess };
}
