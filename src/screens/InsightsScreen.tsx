import { useMemo, useState, useCallback } from 'react';
import type { User } from '../types';
import { useDiary } from '../hooks/useDiary';
import {
  computeCorrelations,
  getTriggerFoods,
  getSafeFoods,
  getWeeklyTrends,
  getLifestyleCorrelations,
  type FoodCorrelation,
  type WeekTrend,
  type LifestyleCorrelation,
} from '../utils/insightEngine';

interface Props {
  user: User;
}

function TriggerFoodCard({ c }: { c: FoodCorrelation }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-fodmap-red shrink-0" />
        <div>
          <span className="text-sm text-gray-900 capitalize font-medium">{c.food}</span>
          <p className="text-xs text-gray-400">
            Eaten {c.timesEaten}x · Bad {Math.round(c.badRate * 100)}% of the time
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-xs font-semibold text-fodmap-red">
          {Math.round(c.avgSymptomScore * 100)}%
        </span>
        <p className="text-[10px] text-gray-400">severity</p>
      </div>
    </div>
  );
}

function SafeFoodCard({ c }: { c: FoodCorrelation }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-fodmap-green shrink-0" />
        <div>
          <span className="text-sm text-gray-900 capitalize font-medium">{c.food}</span>
          <p className="text-xs text-gray-400">
            Eaten {c.timesEaten}x · Good {Math.round(c.goodRate * 100)}% of the time
          </p>
        </div>
      </div>
      <span className="text-xs font-semibold text-fodmap-green">
        Safe
      </span>
    </div>
  );
}

function TrendBar({ trend, maxScore }: { trend: WeekTrend; maxScore: number }) {
  const height = maxScore > 0 ? (trend.avgScore / maxScore) * 100 : 0;
  const color = trend.avgScore > 0.3 ? 'bg-fodmap-red' : trend.avgScore > 0.15 ? 'bg-fodmap-amber' : 'bg-fodmap-green';

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-full h-24 bg-gray-50 rounded-lg relative overflow-hidden flex items-end">
        {trend.daysLogged > 0 ? (
          <div
            className={`w-full ${color} rounded-lg transition-all duration-300`}
            style={{ height: `${Math.max(height, 8)}%` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] text-gray-300">—</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-gray-400 text-center leading-tight">{trend.weekLabel}</span>
      {trend.daysLogged > 0 && (
        <div className="flex gap-1">
          {trend.goodDays > 0 && <span className="text-[10px] text-fodmap-green">{trend.goodDays}😊</span>}
          {trend.badDays > 0 && <span className="text-[10px] text-fodmap-red">{trend.badDays}😣</span>}
        </div>
      )}
    </div>
  );
}

function LifestyleInsight({ lc }: { lc: LifestyleCorrelation }) {
  const isWorse = lc.difference > 0.05;
  const isBetter = lc.difference < -0.05;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{lc.emoji}</span>
        <div>
          <span className="text-sm text-gray-900 font-medium">{lc.factor}</span>
          <p className="text-xs text-gray-400">{lc.daysPresent} days logged</p>
        </div>
      </div>
      <span className={`text-xs font-semibold ${
        isWorse ? 'text-fodmap-red' : isBetter ? 'text-fodmap-green' : 'text-gray-400'
      }`}>
        {isWorse ? `+${Math.round(lc.difference * 100)}% worse`
          : isBetter ? `${Math.round(lc.difference * 100)}% better`
          : 'No clear effect'}
      </span>
    </div>
  );
}

interface AIPattern {
  type: 'trigger' | 'combination' | 'timing' | 'lifestyle' | 'positive';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  actionable: string;
}

interface AIInsights {
  summary: string;
  patterns: AIPattern[];
  encouragement: string;
  eliminationSuggestion: string | null;
}

const patternEmoji: Record<string, string> = {
  trigger: '🚩',
  combination: '🔀',
  timing: '⏰',
  lifestyle: '🧘',
  positive: '✅',
};

const confidenceLabel: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence — need more data',
};

function AIInsightsSection({ entries, symptoms }: { entries: unknown[]; symptoms: unknown[] }) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, symptoms }),
      });

      if (!res.ok) {
        throw new Error(`Analysis failed (${res.status})`);
      }

      const data = await res.json();
      // Extract JSON from Claude's response
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const parsed: AIInsights = JSON.parse(jsonMatch[0]);
      setInsights(parsed);
      setLastAnalyzed(new Date().toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [entries, symptoms]);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <span className="text-base">🤖</span> AI Analysis
        </h3>
        {lastAnalyzed && (
          <span className="text-[10px] text-gray-400">{lastAnalyzed}</span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Sends your diary data to Claude for deeper pattern analysis
      </p>

      {!insights && !loading && (
        <button
          onClick={analyze}
          className="w-full py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 active:scale-[0.98] transition-all"
        >
          ✨ Analyze my data with AI
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-purple-600">Analyzing your patterns...</span>
        </div>
      )}

      {error && (
        <div className="text-center py-3">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            onClick={analyze}
            className="text-sm text-purple-600 underline"
          >
            Try again
          </button>
        </div>
      )}

      {insights && (
        <div className="flex flex-col gap-3">
          {/* Summary */}
          <p className="text-sm text-gray-700 bg-white/60 rounded-lg p-3">
            {insights.summary}
          </p>

          {/* Patterns */}
          {insights.patterns.map((p, i) => (
            <div key={i} className="bg-white/60 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-1">
                <span className="text-base shrink-0">{patternEmoji[p.type] || '📌'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{p.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      p.confidence === 'high' ? 'bg-green-100 text-green-700'
                        : p.confidence === 'medium' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {confidenceLabel[p.confidence]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                  <p className="text-xs text-purple-700 mt-1.5 font-medium">
                    💡 {p.actionable}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Elimination suggestion */}
          {insights.eliminationSuggestion && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs font-semibold text-amber-800 mb-1">🧪 Elimination suggestion</p>
              <p className="text-xs text-amber-700">{insights.eliminationSuggestion}</p>
            </div>
          )}

          {/* Encouragement */}
          <p className="text-xs text-purple-600 text-center italic">
            {insights.encouragement}
          </p>

          {/* Re-analyze button */}
          <button
            onClick={analyze}
            className="text-xs text-purple-500 hover:text-purple-700 underline self-center"
          >
            Re-analyze with latest data
          </button>
        </div>
      )}
    </div>
  );
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
  const { entries, symptoms } = useDiary(user);

  const correlations = useMemo(() => computeCorrelations(entries, symptoms), [entries, symptoms]);
  const triggerFoods = useMemo(() => getTriggerFoods(correlations), [correlations]);
  const safeFoods = useMemo(() => getSafeFoods(correlations), [correlations]);
  const weeklyTrends = useMemo(() => getWeeklyTrends(symptoms, 4), [symptoms]);
  const lifestyleCorrelations = useMemo(() => getLifestyleCorrelations(symptoms), [symptoms]);

  const hasEnoughData = entries.length >= 5 && symptoms.length >= 3;
  const maxTrendScore = Math.max(...weeklyTrends.map(t => t.avgScore), 0.1);

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
          <AIInsightsSection entries={entries} symptoms={symptoms} />

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
