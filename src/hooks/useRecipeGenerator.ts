import { useState, useCallback, useEffect } from 'react';
import { parseClaudeJson } from '../utils/parseClaudeJson';
import { useAbortController } from './useAbortController';
import { db } from '../db';
import { logger } from '../utils/logger';

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
  return parseClaudeJson<Recipe>(responseText);
}

export function useRecipeGenerator(user?: string) {
  const userKey = user ?? 'bram';

  const [state, setState] = useState<State>({
    loading: false,
    recipe: null,
    error: null,
  });

  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const beginRequest = useAbortController();

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
      })
      .catch(err => {
        logger.error('recipe_load_favorites_failed', { message: err instanceof Error ? err.message : String(err) });
        if (!cancelled) setFavoritesError('Could not load saved recipes.');
      });
    return () => { cancelled = true; };
  }, [userKey]);

  const generate = useCallback(async (prompt: string) => {
    const { signal, cleanup } = beginRequest();
    setState({ loading: true, recipe: null, error: null });

    try {
      logger.debug('recipe_fetch_start', { promptChars: prompt.length });
      const response = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal,
      });
      logger.debug('recipe_fetch_complete', { status: response.status, requestId: response.headers.get('X-Request-Id') ?? undefined });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      setState({ loading: false, recipe: parseRecipeResponse(text), error: null });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to generate recipe';
      setState({ loading: false, recipe: null, error: message });
    } finally {
      cleanup();
    }
  }, [beginRequest]);

  const saveFavorite = useCallback((recipe: Recipe) => {
    setFavorites(prev => {
      if (prev.some(r => r.name === recipe.name)) return prev;
      db.recipeFavorites.add({ ...recipe, user: userKey }).catch(err => {
        logger.error('recipe_save_favorite_failed', { message: err instanceof Error ? err.message : String(err) });
        setFavorites(p => p.filter(r => r.name !== recipe.name));
      });
      return [...prev, recipe];
    });
  }, [userKey]);

  const removeFavorite = useCallback((name: string) => {
    setFavorites(prev => prev.filter(r => r.name !== name));
    db.recipeFavorites
      .where('[user+name]')
      .equals([userKey, name])
      .delete()
      .catch(err => { logger.error('recipe_remove_favorite_failed', { message: err instanceof Error ? err.message : String(err) }); });
  }, [userKey]);

  const reset = useCallback(() => {
    setState({ loading: false, recipe: null, error: null });
  }, []);

  return { ...state, generate, reset, favorites, favoritesError, saveFavorite, removeFavorite };
}
