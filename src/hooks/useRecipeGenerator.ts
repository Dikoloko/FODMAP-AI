import { useState, useCallback } from 'react';

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  fodmapRating: 'green' | 'amber';
  fodmapNote: string | null;
}

export interface Recipe {
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tips: string;
  fodmapNotes: string;
}

interface State {
  loading: boolean;
  recipe: Recipe | null;
  error: string | null;
}

function parseRecipeResponse(responseText: string): Recipe {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

export function useRecipeGenerator(user?: string) {
  const favKey = user ? `fodmap_favorite_recipes_${user}` : 'fodmap_favorite_recipes';

  const [state, setState] = useState<State>({
    loading: false,
    recipe: null,
    error: null,
  });

  const [favorites, setFavorites] = useState<Recipe[]>(() => {
    try {
      const raw = localStorage.getItem(favKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const generate = useCallback(async (prompt: string) => {
    setState({ loading: true, recipe: null, error: null });

    try {
      const response = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      const recipe = parseRecipeResponse(text);
      setState({ loading: false, recipe, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate recipe';
      setState({ loading: false, recipe: null, error: message });
    }
  }, []);

  const saveFavorite = useCallback((recipe: Recipe) => {
    setFavorites((prev) => {
      if (prev.some((r) => r.name === recipe.name)) return prev;
      const updated = [...prev, recipe];
      localStorage.setItem(favKey, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((name: string) => {
    setFavorites((prev) => {
      const updated = prev.filter((r) => r.name !== name);
      localStorage.setItem(favKey, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, recipe: null, error: null });
  }, []);

  return { ...state, generate, reset, favorites, saveFavorite, removeFavorite };
}
