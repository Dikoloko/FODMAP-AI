import { useState, useCallback, useEffect } from 'react';
import type { DiaryEntry, DaySymptoms, MealType, DiaryFood, User } from '../types';

function getKey(user: User, type: 'entries' | 'symptoms') {
  return `diary_${user}_${type}`;
}

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useDiary(user: User) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [symptoms, setSymptoms] = useState<DaySymptoms[]>([]);

  // Load data when user changes
  useEffect(() => {
    setEntries(load<DiaryEntry>(getKey(user, 'entries')));
    setSymptoms(load<DaySymptoms>(getKey(user, 'symptoms')));
  }, [user]);

  const persist = useCallback((newEntries: DiaryEntry[], newSymptoms?: DaySymptoms[]) => {
    save(getKey(user, 'entries'), newEntries);
    setEntries(newEntries);
    if (newSymptoms !== undefined) {
      save(getKey(user, 'symptoms'), newSymptoms);
      setSymptoms(newSymptoms);
    }
  }, [user]);

  const addEntry = useCallback((date: string, meal: MealType, foods: DiaryFood[]) => {
    const entry: DiaryEntry = {
      id: generateId(),
      date,
      meal,
      foods,
      timestamp: new Date().toISOString(),
    };
    const updated = [...entries, entry];
    persist(updated);
    return entry;
  }, [entries, persist]);

  const removeEntry = useCallback((id: string) => {
    const updated = entries.filter(e => e.id !== id);
    persist(updated);
  }, [entries, persist]);

  const removeFoodFromEntry = useCallback((entryId: string, foodIndex: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const newFoods = entry.foods.filter((_, i) => i !== foodIndex);
    if (newFoods.length === 0) {
      // Remove entire entry if no foods left
      persist(entries.filter(e => e.id !== entryId));
    } else {
      persist(entries.map(e => e.id === entryId ? { ...e, foods: newFoods } : e));
    }
  }, [entries, persist]);

  const getEntriesForDate = useCallback((date: string) => {
    return entries.filter(e => e.date === date);
  }, [entries]);

  const getEntriesByMeal = useCallback((date: string) => {
    const dayEntries = entries.filter(e => e.date === date);
    const grouped: Record<MealType, DiaryEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    dayEntries.forEach(e => grouped[e.meal].push(e));
    return grouped;
  }, [entries]);

  const setSymptomsForDate = useCallback((daySymptoms: DaySymptoms) => {
    const existing = symptoms.findIndex(s => s.date === daySymptoms.date);
    let updated: DaySymptoms[];
    if (existing >= 0) {
      updated = [...symptoms];
      updated[existing] = daySymptoms;
    } else {
      updated = [...symptoms, daySymptoms];
    }
    save(getKey(user, 'symptoms'), updated);
    setSymptoms(updated);
  }, [symptoms, user]);

  const getSymptomsForDate = useCallback((date: string): DaySymptoms | undefined => {
    return symptoms.find(s => s.date === date);
  }, [symptoms]);

  const getDayRating = useCallback((date: string): 'green' | 'amber' | 'red' | null => {
    const dayEntries = entries.filter(e => e.date === date);
    if (dayEntries.length === 0) return null;
    const allFoods = dayEntries.flatMap(e => e.foods);
    if (allFoods.some(f => f.rating === 'red')) return 'red';
    if (allFoods.some(f => f.rating === 'amber')) return 'amber';
    return 'green';
  }, [entries]);

  return {
    entries,
    symptoms,
    addEntry,
    removeEntry,
    removeFoodFromEntry,
    getEntriesForDate,
    getEntriesByMeal,
    setSymptomsForDate,
    getSymptomsForDate,
    getDayRating,
  };
}
