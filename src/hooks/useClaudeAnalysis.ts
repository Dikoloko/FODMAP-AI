import { useState, useCallback } from 'react';

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
  // Try to extract JSON from the response — Claude may wrap it in markdown
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

export function useClaudeAnalysis() {
  const [state, setState] = useState<State>({
    loading: false,
    result: null,
    error: null,
  });

  const analyzePhoto = useCallback(async (imageBase64: string) => {
    setState({ loading: true, result: null, error: null });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          prompt: 'Analyze this food photo for FODMAP content. Identify every visible food item.',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();

      // Claude API returns { content: [{ type: 'text', text: '...' }] }
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      const result = parseAnalysisResponse(text);
      setState({ loading: false, result, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setState({ loading: false, result: null, error: message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, result: null, error: null });
  }, []);

  return { ...state, analyzePhoto, reset };
}
