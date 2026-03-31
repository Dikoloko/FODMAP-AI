import { useState } from 'react';
import type { User } from '../types';
import CameraCapture from '../components/CameraCapture';
import FodmapBadge from '../components/FodmapBadge';
import { useClaudeAnalysis, type FoodAnalysis } from '../hooks/useClaudeAnalysis';
import { useDiary } from '../hooks/useDiary';

interface Props {
  user: User;
}

function FoodAnalysisCard({ food, onLog }: { food: FoodAnalysis; onLog: () => void }) {
  const [logged, setLogged] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900 capitalize">{food.name}</h3>
        <FodmapBadge rating={food.rating} />
      </div>

      {food.fodmapTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {food.fodmapTypes.map((type) => (
            <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
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

      <p className="text-sm text-gray-500">{food.explanation}</p>

      {food.alternative && (
        <div className="mt-2 pt-2 border-t border-gray-50">
          <span className="text-xs text-primary font-medium">Try instead: </span>
          <span className="px-2 py-0.5 bg-primary-light text-primary rounded-full text-xs">
            {food.alternative}
          </span>
        </div>
      )}

      {/* Log to diary button */}
      <button
        onClick={() => { onLog(); setLogged(true); }}
        disabled={logged}
        className={`mt-2 w-full py-1.5 text-xs font-medium rounded-lg transition-colors ${
          logged
            ? 'bg-fodmap-green/10 text-fodmap-green'
            : 'bg-gray-50 text-gray-500 active:bg-gray-100'
        }`}
      >
        {logged ? 'Added to diary' : '+ Log to diary'}
      </button>
    </div>
  );
}

export default function PhotoScreen({ user }: Props) {
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { loading, result, error, analyzePhoto, reset } = useClaudeAnalysis();
  const { addEntry } = useDiary(user);
  const [mealForLog, setMealForLog] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');

  const handleCapture = (base64: string) => {
    setPhotoBase64(base64);
    setPhotoPreview(`data:image/jpeg;base64,${base64}`);
  };

  const handleAnalyze = () => {
    if (photoBase64) {
      analyzePhoto(photoBase64);
    }
  };

  const handleReset = () => {
    setPhotoBase64(null);
    setPhotoPreview(null);
    reset();
  };

  const handleLogFood = (food: FoodAnalysis) => {
    const today = new Date().toISOString().split('T')[0];
    addEntry(today, mealForLog, [{
      name: food.name,
      rating: food.rating,
      fodmapTypes: food.fodmapTypes,
      portion: food.safeServing || undefined,
    }]);
  };

  // Guess meal based on time of day
  const guessedMeal = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast' as const;
    if (h < 15) return 'lunch' as const;
    if (h < 21) return 'dinner' as const;
    return 'snack' as const;
  })();

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Analyze Photo</h1>

      {/* Step 1: Capture */}
      {!photoPreview && !result && !error && (
        <CameraCapture onCapture={handleCapture} loading={false} />
      )}

      {/* Step 2: Preview before analysis — Fix #13 */}
      {photoPreview && !result && !error && !loading && (
        <div className="flex flex-col gap-3">
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={photoPreview}
              alt="Food to analyze"
              className="w-full h-64 object-cover"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 py-3 text-sm text-gray-600 font-medium bg-gray-100 rounded-xl active:bg-gray-200"
            >
              Retake
            </button>
            <button
              onClick={handleAnalyze}
              className="flex-[2] py-3 text-sm text-white font-medium bg-primary rounded-xl active:scale-[0.98]"
            >
              Analyze food
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Analyzing..."
              className="w-24 h-24 rounded-xl object-cover mb-4 opacity-60"
            />
          )}
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Analyzing your food...</p>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <div className="p-4 bg-fodmap-red/10 rounded-xl mb-3">
            <p className="text-sm text-fodmap-red font-medium mb-1">Analysis failed</p>
            <p className="text-xs text-fodmap-red/80">{error}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-3 text-sm text-primary font-medium bg-primary-light/50 rounded-xl"
          >
            Try again
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {/* Photo preview + overall rating */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex gap-3 items-start">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Analyzed food"
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm">Overall Rating</h3>
                  <FodmapBadge rating={result.overallRating} />
                </div>
                <p className="text-xs text-gray-400">
                  Confidence: {result.confidence}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">{result.advice}</p>
          </div>

          {/* Meal selector for logging */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Log as:</span>
            {([
              { key: 'breakfast' as const, label: '🌅' },
              { key: 'lunch' as const, label: '☀️' },
              { key: 'dinner' as const, label: '🌙' },
              { key: 'snack' as const, label: '🍎' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMealForLog(key)}
                className={`w-9 h-9 rounded-lg text-center text-base transition-colors ${
                  (mealForLog || guessedMeal) === key ? 'bg-primary-light ring-2 ring-primary/30' : 'bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Individual food items */}
          <h3 className="text-sm font-medium text-gray-700">
            Identified foods ({result.foods.length})
          </h3>
          {result.foods.map((food, i) => (
            <FoodAnalysisCard
              key={i}
              food={food}
              onLog={() => handleLogFood(food)}
            />
          ))}

          {/* Analyze another */}
          <button
            onClick={handleReset}
            className="w-full py-3 text-sm text-primary font-medium bg-primary-light/50 rounded-xl mt-2"
          >
            Analyze another photo
          </button>
        </div>
      )}
    </div>
  );
}
