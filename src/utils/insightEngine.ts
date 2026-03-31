import type { DiaryEntry, DaySymptoms } from '../types';

// Compute a single "symptom severity" score (0-1) from a DaySymptoms record
export function symptomScore(s: DaySymptoms): number {
  const symptoms = [s.bloating, s.pain, s.gas, s.diarrhea, s.constipation, s.nausea, s.fatigue, s.urgency];
  const total = symptoms.reduce((a, b) => a + b, 0);
  // Max possible = 8 * 5 = 40
  return total / 40;
}

// Was this a "bad" day? (overall feeling bad OR symptom score > 0.3)
export function isBadDay(s: DaySymptoms): boolean {
  return s.overallFeeling === 'bad' || symptomScore(s) > 0.3;
}

export function isGoodDay(s: DaySymptoms): boolean {
  return s.overallFeeling === 'good' && symptomScore(s) < 0.15;
}


export interface FoodCorrelation {
  food: string;
  timesEaten: number;
  badDaysAfter: number;     // days you felt bad same-day or next-day after eating this
  goodDaysAfter: number;    // days you felt good same-day or next-day after eating this
  badRate: number;          // 0-1
  goodRate: number;         // 0-1
  avgSymptomScore: number;  // average symptom score on days after eating this
}

// Core correlation: for each food, how often did you feel bad/good within 24h of eating it?
export function computeCorrelations(
  entries: DiaryEntry[],
  symptoms: DaySymptoms[],
): FoodCorrelation[] {
  const symptomMap = new Map(symptoms.map(s => [s.date, s]));

  // Collect all unique foods
  const allFoods = new Set<string>();
  entries.forEach(e => e.foods.forEach(f => allFoods.add(f.name.toLowerCase())));

  const correlations: FoodCorrelation[] = [];

  for (const food of allFoods) {
    // Find all dates this food was eaten
    const datesEaten = new Set<string>();
    entries.forEach(e => {
      if (e.foods.some(f => f.name.toLowerCase() === food)) {
        datesEaten.add(e.date);
      }
    });

    if (datesEaten.size < 2) continue; // Need at least 2 data points

    let badDaysAfter = 0;
    let goodDaysAfter = 0;
    let totalSymptomScore = 0;
    let scoredDays = 0;

    for (const date of datesEaten) {
      // Check same-day symptoms
      const sameDaySym = symptomMap.get(date);
      // Check next-day symptoms (delayed reaction)
      const nextDate = getNextDate(date);
      const nextDaySym = symptomMap.get(nextDate);

      // Use the worse of same-day and next-day
      const relevantSymptoms = [sameDaySym, nextDaySym].filter(Boolean) as DaySymptoms[];

      if (relevantSymptoms.length === 0) continue;

      const worstScore = Math.max(...relevantSymptoms.map(symptomScore));
      const anyBad = relevantSymptoms.some(isBadDay);
      const anyGood = relevantSymptoms.some(isGoodDay) && !anyBad;

      if (anyBad) badDaysAfter++;
      if (anyGood) goodDaysAfter++;
      totalSymptomScore += worstScore;
      scoredDays++;
    }

    if (scoredDays < 2) continue;

    correlations.push({
      food,
      timesEaten: datesEaten.size,
      badDaysAfter,
      goodDaysAfter,
      badRate: badDaysAfter / scoredDays,
      goodRate: goodDaysAfter / scoredDays,
      avgSymptomScore: totalSymptomScore / scoredDays,
    });
  }

  return correlations;
}

function getNextDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Get suspected trigger foods (high bad rate)
export function getTriggerFoods(correlations: FoodCorrelation[]): FoodCorrelation[] {
  return correlations
    .filter(c => c.timesEaten >= 2 && c.badRate >= 0.5)
    .sort((a, b) => b.badRate - a.badRate || b.avgSymptomScore - a.avgSymptomScore);
}

// Get safe foods (high good rate, low bad rate)
export function getSafeFoods(correlations: FoodCorrelation[]): FoodCorrelation[] {
  return correlations
    .filter(c => c.timesEaten >= 2 && c.goodRate >= 0.5 && c.badRate < 0.25)
    .sort((a, b) => b.goodRate - a.goodRate);
}

// Weekly symptom trend: average symptom score per week
export interface WeekTrend {
  weekLabel: string;       // e.g., "Mar 17-23"
  avgScore: number;        // 0-1
  avgBloating: number;
  avgPain: number;
  daysLogged: number;
  badDays: number;
  goodDays: number;
}

export function getWeeklyTrends(symptoms: DaySymptoms[], numWeeks = 4): WeekTrend[] {
  const today = new Date();
  const trends: WeekTrend[] = [];

  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const weekSymptoms = symptoms.filter(s => s.date >= startStr && s.date <= endStr);

    const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

    if (weekSymptoms.length === 0) {
      trends.push({ weekLabel, avgScore: 0, avgBloating: 0, avgPain: 0, daysLogged: 0, badDays: 0, goodDays: 0 });
      continue;
    }

    const avgScore = weekSymptoms.reduce((a, s) => a + symptomScore(s), 0) / weekSymptoms.length;
    const avgBloating = weekSymptoms.reduce((a, s) => a + s.bloating, 0) / weekSymptoms.length;
    const avgPain = weekSymptoms.reduce((a, s) => a + s.pain, 0) / weekSymptoms.length;

    trends.push({
      weekLabel,
      avgScore,
      avgBloating,
      avgPain,
      daysLogged: weekSymptoms.length,
      badDays: weekSymptoms.filter(isBadDay).length,
      goodDays: weekSymptoms.filter(isGoodDay).length,
    });
  }

  return trends;
}

// Lifestyle correlation: does stress/sleep/exercise/menstruation correlate with bad days?
export interface LifestyleCorrelation {
  factor: string;
  emoji: string;
  avgScoreWhenPresent: number;
  avgScoreWhenAbsent: number;
  daysPresent: number;
  difference: number; // positive = factor makes symptoms worse
}

export function getLifestyleCorrelations(symptoms: DaySymptoms[]): LifestyleCorrelation[] {
  if (symptoms.length < 5) return [];

  const results: LifestyleCorrelation[] = [];

  // Stress (high = 4-5)
  const highStress = symptoms.filter(s => s.stress >= 4);
  const lowStress = symptoms.filter(s => s.stress <= 2 && s.stress > 0);
  if (highStress.length >= 2 && lowStress.length >= 2) {
    const avgHigh = highStress.reduce((a, s) => a + symptomScore(s), 0) / highStress.length;
    const avgLow = lowStress.reduce((a, s) => a + symptomScore(s), 0) / lowStress.length;
    results.push({
      factor: 'High stress', emoji: '😰',
      avgScoreWhenPresent: avgHigh, avgScoreWhenAbsent: avgLow,
      daysPresent: highStress.length, difference: avgHigh - avgLow,
    });
  }

  // Poor sleep (1-2)
  const poorSleep = symptoms.filter(s => s.sleepQuality >= 1 && s.sleepQuality <= 2);
  const goodSleep = symptoms.filter(s => s.sleepQuality >= 4);
  if (poorSleep.length >= 2 && goodSleep.length >= 2) {
    const avgPoor = poorSleep.reduce((a, s) => a + symptomScore(s), 0) / poorSleep.length;
    const avgGood = goodSleep.reduce((a, s) => a + symptomScore(s), 0) / goodSleep.length;
    results.push({
      factor: 'Poor sleep', emoji: '🛏️',
      avgScoreWhenPresent: avgPoor, avgScoreWhenAbsent: avgGood,
      daysPresent: poorSleep.length, difference: avgPoor - avgGood,
    });
  }

  // Exercise
  const withExercise = symptoms.filter(s => s.exercise);
  const noExercise = symptoms.filter(s => !s.exercise);
  if (withExercise.length >= 2 && noExercise.length >= 2) {
    const avgWith = withExercise.reduce((a, s) => a + symptomScore(s), 0) / withExercise.length;
    const avgWithout = noExercise.reduce((a, s) => a + symptomScore(s), 0) / noExercise.length;
    results.push({
      factor: 'Exercise', emoji: '🏃',
      avgScoreWhenPresent: avgWith, avgScoreWhenAbsent: avgWithout,
      daysPresent: withExercise.length, difference: avgWith - avgWithout,
    });
  }

  // Menstruation
  const withPeriod = symptoms.filter(s => s.menstruation);
  const noPeriod = symptoms.filter(s => !s.menstruation);
  if (withPeriod.length >= 2 && noPeriod.length >= 2) {
    const avgWith = withPeriod.reduce((a, s) => a + symptomScore(s), 0) / withPeriod.length;
    const avgWithout = noPeriod.reduce((a, s) => a + symptomScore(s), 0) / noPeriod.length;
    results.push({
      factor: 'Period', emoji: '🩸',
      avgScoreWhenPresent: avgWith, avgScoreWhenAbsent: avgWithout,
      daysPresent: withPeriod.length, difference: avgWith - avgWithout,
    });
  }

  return results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}
