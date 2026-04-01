import { useState, useCallback, useEffect, useMemo } from 'react';
import type { DiaryEntry, DaySymptoms, MealType, DiaryFood, User } from '../types';
import { db } from '../db';
import { logger } from '../utils/logger';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function useDiary(user: User, { allTime = false }: { allTime?: boolean } = {}) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [symptoms, setSymptoms] = useState<DaySymptoms[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load data when user changes; default to last 90 days to keep memory bounded.
  // Pass { allTime: true } for screens that need the full history (insights, export).
  useEffect(() => {
    let cancelled = false;
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const cutoff = allTime
      ? undefined
      : `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    const entriesQuery = cutoff
      ? db.diaryEntries.where('[user+date]').between([user, cutoff], [user, '\uffff'])
      : db.diaryEntries.where('user').equals(user);

    const symptomsQuery = cutoff
      ? db.symptoms.where('[user+date]').between([user, cutoff], [user, '\uffff'])
      : db.symptoms.where('user').equals(user);

    Promise.all([entriesQuery.toArray(), symptomsQuery.toArray()]).then(([rawEntries, rawSymptoms]) => {
      if (cancelled) return;
      setEntries(rawEntries.map(({ user: _, ...e }) => e as DiaryEntry));
      setSymptoms(rawSymptoms.map(({ user: _, ...s }) => s as DaySymptoms));
    }).catch(err => {
      logger.error('diary_load_failed', { message: err instanceof Error ? err.message : String(err) });
      if (!cancelled) setError('Could not load diary — please restart the app.');
    });
    return () => { cancelled = true; };
  }, [user, allTime]);

  // Fix #1: date-keyed Maps for O(1) lookups — avoid re-filtering full array on every call
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date);
      if (arr) arr.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [entries]);

  const symptomsByDate = useMemo(() => new Map(symptoms.map(s => [s.date, s])), [symptoms]);

  const addEntry = useCallback((date: string, meal: MealType, foods: DiaryFood[], restore?: Pick<DiaryEntry, 'id' | 'timestamp'>) => {
    const entry: DiaryEntry = {
      id: restore?.id ?? generateId(),
      date,
      meal,
      foods,
      timestamp: restore?.timestamp ?? new Date().toISOString(),
    };
    setEntries(prev => {
      // Undo restore: overwrite if entry with same ID already exists (partially modified)
      if (restore && prev.some(e => e.id === entry.id)) {
        return prev.map(e => e.id === entry.id ? entry : e);
      }
      return [...prev, entry];
    });
    db.diaryEntries.put({ ...entry, user }).catch(err => {
      logger.error('diary_add_entry_failed', { message: err instanceof Error ? err.message : String(err) });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    });
    return entry;
  }, [user]);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => {
      const removed = prev.find(e => e.id === id);
      db.diaryEntries.delete(id).catch(err => {
        logger.error('diary_remove_entry_failed', { message: err instanceof Error ? err.message : String(err) });
        if (removed) setEntries(p => [...p, removed]);
      });
      return prev.filter(e => e.id !== id);
    });
  }, []);

  const removeFoodFromEntry = useCallback((entryId: string, foodIndex: number) => {
    setEntries(prev => {
      const entry = prev.find(e => e.id === entryId);
      if (!entry) return prev;
      const newFoods = entry.foods.filter((_, i) => i !== foodIndex);
      if (newFoods.length === 0) {
        db.diaryEntries.delete(entryId).catch(err => {
          logger.error('diary_remove_food_delete_failed', { message: err instanceof Error ? err.message : String(err) });
          setEntries(p => [...p, entry]);
        });
        return prev.filter(e => e.id !== entryId);
      }
      const updated = { ...entry, foods: newFoods };
      db.diaryEntries.put({ ...updated, user }).catch(err => {
        logger.error('diary_remove_food_put_failed', { message: err instanceof Error ? err.message : String(err) });
        setEntries(p => p.map(e => e.id === entryId ? entry : e));
      });
      return prev.map(e => e.id === entryId ? updated : e);
    });
  }, [user]);

  const getEntriesForDate = useCallback((date: string) => {
    return entriesByDate.get(date) ?? [];
  }, [entriesByDate]);

  const getEntriesByMeal = useCallback((date: string) => {
    const dayEntries = entriesByDate.get(date) ?? [];
    const grouped: Record<MealType, DiaryEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    dayEntries.forEach(e => grouped[e.meal].push(e));
    return grouped;
  }, [entriesByDate]);

  const setSymptomsForDate = useCallback((daySymptoms: DaySymptoms) => {
    setSymptoms(prev => {
      const prevEntry = prev.find(s => s.date === daySymptoms.date) ?? null;
      db.symptoms.put({ ...daySymptoms, user }).catch(err => {
        logger.error('diary_set_symptoms_failed', { message: err instanceof Error ? err.message : String(err) });
        setSymptoms(p => {
          if (prevEntry) return p.map(s => s.date === daySymptoms.date ? prevEntry : s);
          return p.filter(s => s.date !== daySymptoms.date);
        });
      });
      const existing = prev.findIndex(s => s.date === daySymptoms.date);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = daySymptoms;
        return updated;
      }
      return [...prev, daySymptoms];
    });
  }, [user]);

  const getSymptomsForDate = useCallback((date: string): DaySymptoms | undefined => {
    return symptomsByDate.get(date);
  }, [symptomsByDate]);

  const getDayRating = useCallback((date: string): 'green' | 'amber' | 'red' | null => {
    const dayEntries = entriesByDate.get(date) ?? [];
    if (dayEntries.length === 0) return null;
    const allFoods = dayEntries.flatMap(e => e.foods);
    if (allFoods.some(f => f.rating === 'red')) return 'red';
    if (allFoods.some(f => f.rating === 'amber')) return 'amber';
    return 'green';
  }, [entriesByDate]);

  return {
    entries,
    symptoms,
    error,
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
