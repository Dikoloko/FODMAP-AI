import type { FodmapRating } from '../types';
import type { IngredientFlag } from '../utils/fodmapAnalyzer';
import FodmapBadge from './FodmapBadge';

interface Props {
  rating: FodmapRating;
  flags: IngredientFlag[];
  ingredientText: string;
}

export default function IngredientAnalysis({ rating, flags, ingredientText }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">FODMAP Analysis</h3>
          <FodmapBadge rating={rating} />
        </div>
        {rating === 'green' && flags.length === 0 && (
          <p className="text-sm text-gray-500">
            No high-FODMAP ingredients detected. This product appears safe.
          </p>
        )}
      </div>

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
