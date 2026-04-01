import { useMemo } from 'react';
import type { User } from '../types';
import { useDiary } from '../hooks/useDiary';
import {
  computeCorrelations,
  getTriggerFoods,
  getSafeFoods,
  getWeeklyTrends,
  getLifestyleCorrelations,
} from '../utils/insightEngine';
import { TriggerFoodCard, SafeFoodCard, TrendBar, LifestyleInsight } from '../components/insights/InsightCards';
import AIInsightsSection from '../components/insights/AIInsightsSection';

interface Props {
  user: User;
}

function MinDataMessage() {
  return (
    <div className="text-center py-16">
      <span className="text-5xl block mb-4">📊</span>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Not enough data yet</h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">
        Log your meals and symptoms for at least 5-7 days. The more you log, the better the insights.
      </p>
      <div className="mt-6 flex flex-col gap-2 text-left max-w-xs mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
          Log what you eat in the Diary
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
          Track how you feel each day
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">3</span>
          Come back here for patterns
        </div>
      </div>
    </div>
  );
}

export default function InsightsScreen({ user }: Props) {
  const { entries, symptoms } = useDiary(user, { allTime: true });

  // Fix #6 + #11: batch all derived computations into one useMemo — a single diary change
  // triggers one recompute instead of cascading through five separate useMemos.
  // maxTrendScore is folded in here too to avoid a standalone Math.max on every render.
  const {
    correlations, triggerFoods, safeFoods, weeklyTrends, lifestyleCorrelations, maxTrendScore,
  } = useMemo(() => {
    const correlations = computeCorrelations(entries, symptoms, user);
    const weeklyTrends = getWeeklyTrends(symptoms, 4);
    return {
      correlations,
      triggerFoods: getTriggerFoods(correlations),
      safeFoods: getSafeFoods(correlations),
      weeklyTrends,
      lifestyleCorrelations: getLifestyleCorrelations(symptoms),
      maxTrendScore: Math.max(...weeklyTrends.map(t => t.avgScore), 0.1),
    };
  }, [entries, symptoms, user]);

  const hasEnoughData = entries.length >= 5 && symptoms.length >= 3;

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Insights</h1>
      <p className="text-xs text-gray-400 mb-4">
        Patterns based on your food diary and symptom logs
      </p>

      {!hasEnoughData ? (
        <MinDataMessage />
      ) : (
        <div className="flex flex-col gap-4">

          {/* 4-week trend chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">4-week trend</h3>
            <div className="flex gap-2">
              {weeklyTrends.map((trend, i) => (
                <TrendBar key={i} trend={trend} maxScore={maxTrendScore} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fodmap-green" /> Low symptoms</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fodmap-amber" /> Moderate</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-fodmap-red" /> High symptoms</span>
            </div>
          </div>

          {/* AI-powered analysis */}
          <AIInsightsSection entries={entries} symptoms={symptoms} user={user} />

          {/* Trigger foods */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              🚩 Suspected triggers
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Foods that correlate with bad days (same-day or next-day)
            </p>
            {triggerFoods.length > 0 ? (
              <div className="flex flex-col divide-y divide-gray-50">
                {triggerFoods.slice(0, 8).map(c => (
                  <TriggerFoodCard key={c.food} c={c} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-3 text-center">
                No clear trigger foods detected yet. Keep logging!
              </p>
            )}
          </div>

          {/* Safe foods */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              ✅ Your safe foods
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Foods consistently on your good days
            </p>
            {safeFoods.length > 0 ? (
              <div className="flex flex-col divide-y divide-gray-50">
                {safeFoods.slice(0, 8).map(c => (
                  <SafeFoodCard key={c.food} c={c} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-3 text-center">
                Not enough data yet to identify safe foods.
              </p>
            )}
          </div>

          {/* Lifestyle correlations */}
          {lifestyleCorrelations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                🔗 Lifestyle impact
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                How stress, sleep, and exercise affect your symptoms
              </p>
              <div className="flex flex-col divide-y divide-gray-50">
                {lifestyleCorrelations.map(lc => (
                  <LifestyleInsight key={lc.factor} lc={lc} />
                ))}
              </div>
            </div>
          )}

          {/* Stats summary */}
          <div className="bg-primary-light/30 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-primary mb-2">Data summary</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">{entries.length}</p>
                <p className="text-[10px] text-gray-400">Meals logged</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{symptoms.length}</p>
                <p className="text-[10px] text-gray-400">Days tracked</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{correlations.length}</p>
                <p className="text-[10px] text-gray-400">Foods analyzed</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-300 text-center pb-2">
            Correlations consider food eaten same-day and next-day symptoms. More data = better insights.
          </p>
        </div>
      )}
    </div>
  );
}
