import { useState } from 'react';
import type { FodmapRating } from '../types';
import type { IngredientFlag } from '../utils/fodmapAnalyzer';
import FodmapBadge from './FodmapBadge';

interface AIResult {
  rating: FodmapRating;
  flags: { ingredient: string; fodmapType: string; explanation: string }[];
  safe: boolean;
}

function AIFallbackButton({ ingredientText, onResult }: { ingredientText: string; onResult: (r: AIResult) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze this ingredient list for FODMAP content. Be strict — flag anything that contains lactose, fructans, GOS, excess fructose, or polyols. Consider the language (may be Dutch, French, German, or English).

Ingredient list: "${ingredientText}"

Respond in JSON:
{
  "rating": "green|amber|red",
  "flags": [{"ingredient": "name", "fodmapType": "type", "explanation": "why"}],
  "safe": true/false
}`,
        }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Could not parse response');
      onResult(JSON.parse(match[0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-purple-600">AI is checking ingredients...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-500 text-center py-1">{error}</p>;
  }

  return (
    <button
      onClick={check}
      className="w-full text-xs text-purple-600 hover:text-purple-800 py-1.5 flex items-center justify-center gap-1"
    >
      <span>🤖</span> Not sure? Let AI double-check
    </button>
  );
}

interface Props {
  rating: FodmapRating;
  flags: IngredientFlag[];
  ingredientText: string;
}

export default function IngredientAnalysis({ rating: initialRating, flags: initialFlags, ingredientText }: Props) {
  const [aiResult, setAiResult] = useState<AIResult | null>(null);

  // Use AI result if available, otherwise use local analysis
  const rating = aiResult ? aiResult.rating : initialRating;
  const flags = aiResult ? [] : initialFlags;
  const aiFlags = aiResult?.flags || [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">
            FODMAP Analysis
            {aiResult && <span className="text-[10px] text-purple-500 ml-1.5">AI verified</span>}
          </h3>
          <FodmapBadge rating={rating} />
        </div>
        {rating === 'green' && flags.length === 0 && aiFlags.length === 0 && (
          <p className="text-sm text-gray-500">
            No high-FODMAP ingredients detected. This product appears safe.
          </p>
        )}
      </div>

      {/* Local flags */}
      {flags.length > 0 && (
        <div className="p-4 border-b border-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Flagged ingredients ({flags.length})
          </h4>
          <div className="flex flex-col gap-2">
            {flags.map((flag, i) => (
              <div key={i} className="p-2 bg-fodmap-red/5 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-fodmap-red shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {flag.ingredient}
                    </p>
                    <p className="text-xs text-gray-500">
                      {flag.fodmapType} — commonly found in {flag.commonIn}
                    </p>
                  </div>
                </div>
                {flag.alternatives.length > 0 && (
                  <div className="mt-1.5 ml-4 flex flex-wrap gap-1">
                    <span className="text-xs text-primary font-medium">Try instead:</span>
                    {flag.alternatives.map((alt) => (
                      <span key={alt} className="px-2 py-0.5 bg-primary-light text-primary rounded-full text-xs">
                        {alt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI flags */}
      {aiFlags.length > 0 && (
        <div className="p-4 border-b border-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            AI found ({aiFlags.length})
          </h4>
          <div className="flex flex-col gap-2">
            {aiFlags.map((flag, i) => (
              <div key={i} className="p-2 bg-fodmap-red/5 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 mt-1.5 rounded-full bg-fodmap-red shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{flag.ingredient}</p>
                    <p className="text-xs text-gray-500">{flag.fodmapType} — {flag.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI fallback: show when local analysis found nothing suspicious */}
      {!aiResult && ingredientText && (
        <div className="px-4 py-2 border-b border-gray-50">
          <AIFallbackButton ingredientText={ingredientText} onResult={setAiResult} />
        </div>
      )}

      {ingredientText && (
        <details className="p-4">
          <summary className="text-xs text-gray-400 cursor-pointer">
            Full ingredient list
          </summary>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            {ingredientText}
          </p>
        </details>
      )}
    </div>
  );
}
