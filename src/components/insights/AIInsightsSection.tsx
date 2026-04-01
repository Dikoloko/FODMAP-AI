import { useMemo, useState, useCallback, useEffect } from 'react';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { toDateString } from '../../utils/dateHelpers';
import { parseClaudeJson } from '../../utils/parseClaudeJson';
import { useAbortController } from '../../hooks/useAbortController';

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

interface Props {
  entries: unknown[];
  symptoms: unknown[];
  user: string;
}

export default function AIInsightsSection({ entries, symptoms, user }: Props) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);
  const [storedFingerprint, setStoredFingerprint] = useState<string | null>(null);
  const beginRequest = useAbortController();

  const dbKey = `ai_insights_${user}`;

  // Load persisted insights from IndexedDB on mount
  useEffect(() => {
    db.userSettings.get(dbKey).then(record => {
      if (!record) return;
      try {
        const stored = JSON.parse(record.value) as {
          insights: AIInsights;
          analyzedAt: string;
          fingerprint: string;
        };
        setInsights(stored.insights);
        setLastAnalyzed(stored.analyzedAt);
        setStoredFingerprint(stored.fingerprint);
      } catch (err) {
        logger.warn('insights_corrupt_stored_data', {
          raw: record.value?.slice(0, 200),
          message: err instanceof Error ? err.message : String(err),
        });
        db.userSettings.delete(dbKey).catch(() => {});
      }
    }).catch(err => {
      logger.error('insights_load_settings_failed', { message: err instanceof Error ? err.message : String(err) });
      setError('Could not load previous analysis.');
    });
  }, [dbKey]);

  // Fingerprint of current entries + symptoms to detect data changes
  const currentFingerprint = useMemo(() => {
    const e = (entries as Array<{ id: string }>).map(x => x.id).sort().join(',');
    const s = (symptoms as Array<{ date: string }>).map(x => x.date).sort().join(',');
    return `${e}|${s}`;
  }, [entries, symptoms]);

  const dataChanged = storedFingerprint !== null && storedFingerprint !== currentFingerprint;

  const analyze = useCallback(async () => {
    // Dedup: skip API call when data is unchanged and we already have results
    if (insights && storedFingerprint === currentFingerprint) return;

    const { signal, cleanup } = beginRequest();
    setLoading(true);
    setError(null);
    try {
      // Limit to 90 days to avoid unbounded payloads
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = toDateString(cutoff);
      const recentEntries = (entries as Array<{ date: string }>).filter(e => e.date >= cutoffStr);
      const recentSymptoms = (symptoms as Array<{ date: string }>).filter(s => s.date >= cutoffStr);

      logger.debug('insights_fetch_start', { entryCount: recentEntries.length, symptomCount: recentSymptoms.length });
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: recentEntries, symptoms: recentSymptoms }),
        signal,
      });
      logger.debug('insights_fetch_complete', { status: res.status, requestId: res.headers.get('X-Request-Id') ?? undefined });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Analysis failed (${res.status})` }));
        throw new Error(errBody.error || `Analysis failed (${res.status})`);
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned unreadable response');
      }
      const text = (data as { content?: Array<{ text: string }> }).content?.[0]?.text || '';
      const parsed = parseClaudeJson<AIInsights>(text);
      const analyzedAt = new Date().toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      setInsights(parsed);
      setLastAnalyzed(analyzedAt);
      setStoredFingerprint(currentFingerprint);

      // Persist result + fingerprint to IndexedDB so it survives navigation
      await db.userSettings.put({
        key: dbKey,
        value: JSON.stringify({ insights: parsed, analyzedAt, fingerprint: currentFingerprint }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      cleanup();
      setLoading(false);
    }
  }, [entries, symptoms, insights, storedFingerprint, currentFingerprint, dbKey, beginRequest]);

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
          <button onClick={analyze} className="text-sm text-purple-600 underline">
            Try again
          </button>
        </div>
      )}

      {insights && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-700 bg-white/60 rounded-lg p-3">
            {insights.summary}
          </p>

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

          {insights.eliminationSuggestion && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs font-semibold text-amber-800 mb-1">🧪 Elimination suggestion</p>
              <p className="text-xs text-amber-700">{insights.eliminationSuggestion}</p>
            </div>
          )}

          <p className="text-xs text-purple-600 text-center italic">
            {insights.encouragement}
          </p>

          {dataChanged && (
            <button
              onClick={analyze}
              className="text-xs text-purple-500 hover:text-purple-700 underline self-center"
            >
              Re-analyze with latest data
            </button>
          )}
        </div>
      )}
    </div>
  );
}
