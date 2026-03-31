import { useState, useCallback, useEffect } from 'react';
import { db } from '../db';

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
  const userKey = user ?? 'bram';

  const [state, setState] = useState<State>({
    loading: false,
    recipe: null,
    error: null,
  });

  const [favorites, setFavorites] = useState<Recipe[]>([]);

  // Load favorites from DB when user changes
  useEffect(() => {
    let cancelled = false;
    db.recipeFavorites
      .where('user')
      .equals(userKey)
      .toArray()
      .then(records => {
        if (cancelled) return;
        setFavorites(records.map(r => ({
          name: r.name,
          description: r.description,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
          servings: r.servings,
          ingredients: r.ingredients,
          steps: r.steps,
          tips: r.tips,
          fodmapNotes: r.fodmapNotes,
        })));
      });
    return () => { cancelled = true; };
  }, [userKey]);

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
    setFavorites(prev => {
      if (prev.some(r => r.name === recipe.name)) return prev;
      db.recipeFavorites.add({ ...recipe, user: userKey });
      return [...prev, recipe];
    });
  }, [userKey]);

  const removeFavorite = useCallback((name: string) => {
    setFavorites(prev => {
      db.recipeFavorites
        .where('[user+name]')
        .equals([userKey, name])
        .delete();
      return prev.filter(r => r.name !== name);
    });
  }, [userKey]);

  const reset = useCallback(() => {
    setState({ loading: false, recipe: null, error: null });
  }, []);

  return { ...state, generate, reset, favorites, saveFavorite, removeFavorite };
}
