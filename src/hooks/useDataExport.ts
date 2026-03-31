import { useCallback, useState } from 'react';
import { db } from '../db';
import type { DiaryEntry, DaySymptoms, User } from '../types';
import type { Recipe } from './useRecipeGenerator';

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
        diaryEntries: rawEntries.map(({ user: _u, ...e }) => e as DiaryEntry),
        symptoms: rawSymptoms.map(({ user: _u, ...s }) => s as DaySymptoms),
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

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fodmap-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importData = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;

      if (data.version !== 1) throw new Error('Unsupported backup format version');
      if (!data.users || typeof data.users !== 'object') throw new Error('Invalid backup file');

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

            for (const entry of userData.diaryEntries ?? []) {
              await db.diaryEntries.put({ ...entry, user });
            }

            for (const symptom of userData.symptoms ?? []) {
              await db.symptoms.put({ ...symptom, user });
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
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, []);

  return { exportData, importData, importing, importError, importSuccess };
}
