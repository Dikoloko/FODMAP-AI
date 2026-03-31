import { useState } from 'react';
import type { FodmapFood } from '../types';
import FodmapBadge from './FodmapBadge';

interface Props {
  food: FodmapFood;
  onLog?: () => void;
}

export default function FoodCard({ food, onLog }: Props) {
  const [logged, setLogged] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-semibold text-gray-900 capitalize">{food.name}</h3>
          <p className="text-xs text-gray-400">
            NL: {food.nameNL} · FR: {food.nameFR}
          </p>
        </div>
        <FodmapBadge rating={food.rating} />
      </div>

      {food.fodmapTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {food.fodmapTypes.map((type) => (
            <span
              key={type}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
            >
              {type}
            </span>
          ))}
        </div>
      )}

      {food.safeServing && (
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Safe serving:</span> {food.safeServing}
        </p>
      )}

      <p className="text-sm text-gray-500">{food.notes}</p>

      {food.alternatives.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-1">Alternatives:</p>
          <div className="flex flex-wrap gap-1.5">
            {food.alternatives.map((alt) => (
              <span
                key={alt}
                className="px-2 py-0.5 bg-primary-light text-primary rounded-full text-xs"
              >
                {alt}
              </span>
            ))}
          </div>
        </div>
      )}

      {onLog && (
        <button
          onClick={() => { onLog(); setLogged(true); }}
          disabled={logged}
          className={`mt-2 w-full py-1.5 text-xs font-medium rounded-lg transition-colors ${
            logged
              ? 'bg-fodmap-green/10 text-fodmap-green'
              : 'bg-gray-50 text-gray-500 active:bg-gray-100'
          }`}
        >
          {logged ? 'Added to diary' : '+ Log to today\'s diary'}
        </button>
      )}
    </div>
  );
}
