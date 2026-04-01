import { useState, useCallback } from 'react';
import { parseClaudeJson } from '../utils/parseClaudeJson';
import { useAbortController } from './useAbortController';
import { logger } from '../utils/logger';

export interface FoodAnalysis {
  name: string;
  rating: 'green' | 'amber' | 'red';
  fodmapTypes: string[];
  safeServing: string | null;
  explanation: string;
  alternative: string | null;
}

export interface PhotoAnalysisResult {
  foods: FoodAnalysis[];
  overallRating: 'green' | 'amber' | 'red';
  advice: string;
  confidence: 'high' | 'medium' | 'low';
}

interface State {
  loading: boolean;
  result: PhotoAnalysisResult | null;
  error: string | null;
}

function parseAnalysisResponse(responseText: string): PhotoAnalysisResult {
  return parseClaudeJson<PhotoAnalysisResult>(responseText);
}

export function useClaudeAnalysis() {
  const [state, setState] = useState<State>({
    loading: false,
    result: null,
    error: null,
  });
  const beginRequest = useAbortController();

  const analyzePhoto = useCallback(async (imageBase64: string) => {
    const { signal, cleanup } = beginRequest();
    setState({ loading: true, result: null, error: null });

    try {
      logger.debug('analyze_fetch_start', {});
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          prompt: 'Analyze this food photo for FODMAP content. Identify every visible food item.',
        }),
        signal,
      });
      logger.debug('analyze_fetch_complete', { status: response.status, requestId: response.headers.get('X-Request-Id') ?? undefined });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned unreadable response');
      }

      // Claude API returns { content: [{ type: 'text', text: '...' }] }
      const text = (data as { content?: Array<{ type: string; text: string }> }).content?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      setState({ loading: false, result: parseAnalysisResponse(text), error: null });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setState({ loading: false, result: null, error: message });
    } finally {
      cleanup();
    }
  }, [beginRequest]);

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, analyzePhoto, reset };
}
