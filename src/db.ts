import Dexie, { type Table } from 'dexie';
import type { DiaryEntry, DaySymptoms, User } from './types';

export interface DiaryEntryRecord extends DiaryEntry {
  user: User;
}

export interface SymptomsRecord extends DaySymptoms {
  user: User;
}

// Inline to avoid circular dependency with useRecipeGenerator
export interface RecipeFavoriteIngredient {
  name: string;
  amount: string;
  unit: string;
  fodmapRating: 'green' | 'amber';
  fodmapNote: string | null;
}

export interface RecipeFavoriteRecord {
  _id?: number;
  user: string;
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: RecipeFavoriteIngredient[];
  steps: string[];
  tips: string;
  fodmapNotes: string;
}

export interface UserSettingRecord {
  key: string;
  value: string;
}

export class FodmapDatabase extends Dexie {
  diaryEntries!: Table<DiaryEntryRecord, string>;
  symptoms!: Table<SymptomsRecord, [string, string]>;
  recipeFavorites!: Table<RecipeFavoriteRecord, number>;
  userSettings!: Table<UserSettingRecord, string>;
  migrations!: Table<{ key: string }, string>;

  constructor() {
    super('FodmapDB');
    this.version(1).stores({
      diaryEntries: 'id, user, date, [user+date]',
      symptoms: '[user+date], user, date',
      recipeFavorites: '++_id, user, name, [user+name]',
      userSettings: 'key',
      migrations: 'key',
    });
  }
}

export const db = new FodmapDatabase();
