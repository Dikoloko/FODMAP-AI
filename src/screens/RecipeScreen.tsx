import { useState } from 'react';
import type { User } from '../types';
import { useRecipeGenerator, type Recipe } from '../hooks/useRecipeGenerator';

const QUICK_PROMPTS = [
  { label: '🥗 Quick lunch', prompt: 'A quick low-FODMAP lunch I can make in 15 minutes with ingredients from a Belgian supermarket' },
  { label: '🍝 Pasta dinner', prompt: 'A comforting low-FODMAP pasta dinner for 2, using gluten-free pasta' },
  { label: '🥞 Breakfast', prompt: 'A filling low-FODMAP breakfast that gives energy for the morning' },
  { label: '🍲 Belgian classic', prompt: 'A classic Belgian dish adapted to be low-FODMAP safe' },
  { label: '🥘 Meal prep', prompt: 'A low-FODMAP meal prep recipe that keeps well for 3-4 days in the fridge' },
  { label: '🍰 Dessert', prompt: 'A low-FODMAP dessert that is easy to make and satisfying' },
];

function RecipeCard({ recipe, onSave, onRemove, isSaved }: {
  recipe: Recipe;
  onSave: () => void;
  onRemove: () => void;
  isSaved: boolean;
}) {
  const [expandedSteps, setExpandedSteps] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-900">{recipe.name}</h3>
          <button
            onClick={isSaved ? onRemove : onSave}
            className={`shrink-0 p-2 rounded-lg transition-colors ${
              isSaved ? 'bg-fodmap-red/10 text-fodmap-red' : 'bg-primary-light text-primary'
            }`}
          >
            {isSaved ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">{recipe.description}</p>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>⏱ Prep: {recipe.prepTime}</span>
          <span>🔥 Cook: {recipe.cookTime}</span>
          <span>🍽 Serves {recipe.servings}</span>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Ingredients</h4>
        <div className="flex flex-col gap-2">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                ing.fodmapRating === 'green' ? 'bg-fodmap-green' : 'bg-fodmap-amber'
              }`} />
              <div className="flex-1">
                <span className="text-sm text-gray-700">
                  {ing.amount} {ing.unit} <span className="font-medium">{ing.name}</span>
                </span>
                {ing.fodmapNote && (
                  <p className="text-xs text-fodmap-amber mt-0.5">⚠ {ing.fodmapNote}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <button
          onClick={() => setExpandedSteps(!expandedSteps)}
          className="w-full flex items-center justify-between"
        >
          <h4 className="text-sm font-semibold text-gray-900">
            Steps ({recipe.steps.length})
          </h4>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expandedSteps ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSteps && (
          <div className="flex flex-col gap-3 mt-3">
            {recipe.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips & FODMAP notes */}
      {(recipe.tips || recipe.fodmapNotes) && (
        <div className="bg-primary-light/30 rounded-xl p-4">
          {recipe.tips && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-primary mb-1">Tips</h4>
              <p className="text-sm text-gray-700">{recipe.tips}</p>
            </div>
          )}
          {recipe.fodmapNotes && (
            <div>
              <h4 className="text-xs font-semibold text-primary mb-1">FODMAP Notes</h4>
              <p className="text-sm text-gray-700">{recipe.fodmapNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  user: User;
}

export default function RecipeScreen({ user }: Props) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const { loading, recipe, error, generate, reset, favorites, saveFavorite, removeFavorite } = useRecipeGenerator(user);

  const handleGenerate = (prompt: string) => {
    generate(prompt);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      generate(customPrompt.trim());
      setCustomPrompt('');
    }
  };

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        {favorites.length > 0 && (
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              showFavorites ? 'bg-primary text-white' : 'bg-primary-light text-primary'
            }`}
          >
            {showFavorites ? 'Generate new' : `Saved (${favorites.length})`}
          </button>
        )}
      </div>

      {/* Favorites view */}
      {showFavorites && (
        <div className="flex flex-col gap-4">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl block mb-3">📖</span>
              <p className="text-sm font-medium text-gray-700 mb-1">No saved recipes yet</p>
              <p className="text-xs text-gray-400">Generate a recipe and tap the heart to save it here</p>
            </div>
          ) : (
            favorites.map((fav) => (
              <RecipeCard
                key={fav.name}
                recipe={fav}
                isSaved={true}
                onSave={() => {}}
                onRemove={() => removeFavorite(fav.name)}
              />
            ))
          )}
        </div>
      )}

      {/* Generator view */}
      {!showFavorites && (
        <>
          {!recipe && !loading && !error && (
            <>
              {/* Custom prompt */}
              <form onSubmit={handleCustomSubmit} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="What do you want to cook?"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="submit"
                    disabled={!customPrompt.trim()}
                    className="px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl disabled:opacity-40 active:scale-[0.98]"
                  >
                    Generate
                  </button>
                </div>
              </form>

              {/* Quick prompts */}
              <p className="text-xs text-gray-400 mb-2">Or try a suggestion:</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map(({ label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => handleGenerate(prompt)}
                    className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm text-left active:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700">Creating your recipe...</p>
              <p className="text-xs text-gray-400 mt-1">Using low-FODMAP ingredients from Belgian stores</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4">
              <div className="p-4 bg-fodmap-red/10 rounded-xl mb-3">
                <p className="text-sm text-fodmap-red font-medium mb-1">Could not generate recipe</p>
                <p className="text-xs text-fodmap-red/80">{error}</p>
              </div>
              <button
                onClick={reset}
                className="w-full py-3 text-sm text-primary font-medium bg-primary-light/50 rounded-xl"
              >
                Try again
              </button>
            </div>
          )}

          {/* Result */}
          {recipe && (
            <div className="flex flex-col gap-3">
              <RecipeCard
                recipe={recipe}
                isSaved={favorites.some((f) => f.name === recipe.name)}
                onSave={() => saveFavorite(recipe)}
                onRemove={() => removeFavorite(recipe.name)}
              />
              <button
                onClick={reset}
                className="w-full py-3 text-sm text-primary font-medium bg-primary-light/50 rounded-xl mt-2"
              >
                Generate another recipe
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
