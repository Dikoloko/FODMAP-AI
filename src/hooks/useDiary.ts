import { useState, useCallback, useEffect } from 'react';
import type { DiaryEntry, DaySymptoms, MealType, DiaryFood, User } from '../types';
import { db } from '../db';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useDiary(user: User) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [symptoms, setSymptoms] = useState<DaySymptoms[]>([]);

  // Load data when user changes
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      db.diaryEntries.where('user').equals(user).toArray(),
      db.symptoms.where('user').equals(user).toArray(),
    ]).then(([rawEntries, rawSymptoms]) => {
      if (cancelled) return;
      setEntries(rawEntries.map(({ user: _u, ...e }) => e as DiaryEntry));
      setSymptoms(rawSymptoms.map(({ user: _u, ...s }) => s as DaySymptoms));
    });
    return () => { cancelled = true; };
  }, [user]);

  const addEntry = useCallback((date: string, meal: MealType, foods: DiaryFood[]) => {
    const entry: DiaryEntry = {
      id: generateId(),
      date,
      meal,
      foods,
      timestamp: new Date().toISOString(),
    };
    setEntries(prev => [...prev, entry]);
    db.diaryEntries.add({ ...entry, user });
    return entry;
  }, [user]);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    db.diaryEntries.delete(id);
  }, []);

  const removeFoodFromEntry = useCallback((entryId: string, foodIndex: number) => {
    setEntries(prev => {
      const entry = prev.find(e => e.id === entryId);
      if (!entry) return prev;
      const newFoods = entry.foods.filter((_, i) => i !== foodIndex);
      if (newFoods.length === 0) {
        db.diaryEntries.delete(entryId);
        return prev.filter(e => e.id !== entryId);
      }
      const updated = { ...entry, foods: newFoods };
      db.diaryEntries.put({ ...updated, user });
      return prev.map(e => e.id === entryId ? updated : e);
    });
  }, [user]);

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
    setSymptoms(prev => {
      const existing = prev.findIndex(s => s.date === daySymptoms.date);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = daySymptoms;
        return updated;
      }
      return [...prev, daySymptoms];
    });
    db.symptoms.put({ ...daySymptoms, user });
  }, [user]);

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
