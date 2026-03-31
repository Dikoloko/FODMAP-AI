export type FodmapRating = 'green' | 'amber' | 'red';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type OverallFeeling = 'good' | 'okay' | 'bad';
export type User = 'bram' | 'helena';

// Bristol Stool Scale: 1 (hard lumps) to 7 (watery), 0 = not logged
export type BristolScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FodmapFood {
  name: string;
  nameNL: string;
  nameFR: string;
  category: string;
  rating: FodmapRating;
  fodmapTypes: string[];
  safeServing: string | null;
  notes: string;
  alternatives: string[];
}

export interface HighFodmapIngredient {
  ingredient: string;
  fodmapType: string;
  commonIn: string;
}

export interface FodmapCategory {
  label: string;
  description: string;
  color: string;
}

export interface FodmapDatabase {
  version: string;
  lastUpdated: string;
  foods: FodmapFood[];
  highFodmapIngredients: HighFodmapIngredient[];
  fodmapCategories: Record<string, FodmapCategory>;
}

export interface DiaryFood {
  name: string;
  rating: FodmapRating;
  fodmapTypes: string[];
  portion?: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  meal: MealType;
  foods: DiaryFood[];
  timestamp: string;
}

export interface DaySymptoms {
  date: string;
  bloating: number;       // 0-5
  pain: number;           // 0-5
  gas: number;            // 0-5
  diarrhea: number;       // 0-5
  constipation: number;   // 0-5
  nausea: number;         // 0-5
  fatigue: number;        // 0-5
  urgency: number;        // 0-5
  bristol: BristolScore;  // 0=not logged, 1-7
  otherSymptoms: string;
  overallFeeling: OverallFeeling;
  // Lifestyle factors
  stress: number;         // 0-5
  sleepQuality: number;   // 0-5
  exercise: boolean;
  menstruation: boolean;
}
