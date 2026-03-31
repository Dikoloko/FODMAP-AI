import { db } from './db';
import type { DiaryEntry, DaySymptoms, User } from './types';
import type { Recipe } from './hooks/useRecipeGenerator';

const MIGRATION_KEY = 'localStorage_v1';

function tryParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as T[]; } catch { return []; }
}

export async function runMigration(): Promise<void> {
  const already = await db.migrations.get(MIGRATION_KEY);
  if (already) return;

  const users: User[] = ['bram', 'helena'];

  await db.transaction(
    'rw',
    [db.diaryEntries, db.symptoms, db.recipeFavorites, db.userSettings, db.migrations],
    async () => {
      for (const user of users) {
        const entries = tryParse<DiaryEntry>(localStorage.getItem(`diary_${user}_entries`));
        for (const entry of entries) {
          await db.diaryEntries.put({ ...entry, user });
        }

        const symptoms = tryParse<DaySymptoms>(localStorage.getItem(`diary_${user}_symptoms`));
        for (const symptom of symptoms) {
          await db.symptoms.put({ ...symptom, user });
        }

        const recipes = tryParse<Recipe>(localStorage.getItem(`fodmap_favorite_recipes_${user}`));
        for (const recipe of recipes) {
          const exists = await db.recipeFavorites
            .where('[user+name]')
            .equals([user, recipe.name])
            .count();
          if (exists === 0) {
            await db.recipeFavorites.add({ ...recipe, user });
          }
        }
      }

      // Global (non-user-specific) recipe favorites → migrate to bram
      const globalRecipes = tryParse<Recipe>(localStorage.getItem('fodmap_favorite_recipes'));
      for (const recipe of globalRecipes) {
        const exists = await db.recipeFavorites
          .where('[user+name]')
          .equals(['bram', recipe.name])
          .count();
        if (exists === 0) {
          await db.recipeFavorites.add({ ...recipe, user: 'bram' });
        }
      }

      const currentUser = localStorage.getItem('fodmap_current_user');
      if (currentUser === 'bram' || currentUser === 'helena') {
        await db.userSettings.put({ key: 'current_user', value: currentUser });
      }

      await db.migrations.put({ key: MIGRATION_KEY });
    }
  );
}
