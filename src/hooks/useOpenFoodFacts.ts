import { useState, useCallback } from 'react';
import { lookupBarcode, type OpenFoodFactsProduct } from '../utils/api';
import { logger } from '../utils/logger';

interface State {
  loading: boolean;
  product: OpenFoodFactsProduct | null;
  error: string | null;
  notFound: boolean;
}

export function useOpenFoodFacts() {
  const [state, setState] = useState<State>({
    loading: false,
    product: null,
    error: null,
    notFound: false,
  });

  const lookup = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    setState({ loading: true, product: null, error: null, notFound: false });

    try {
      const product = await lookupBarcode(barcode.trim());
      if (product) {
        setState({ loading: false, product, error: null, notFound: false });
      } else {
        setState({ loading: false, product: null, error: null, notFound: true });
      }
    } catch (err) {
      logger.error('off_lookup_failed', { message: err instanceof Error ? err.message : String(err) });
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError;
      const message = isTimeout
        ? 'Request timed out — please try again'
        : isNetworkError
        ? 'No internet connection'
        : 'Failed to look up product. Check your connection.';
      setState({ loading: false, product: null, error: message, notFound: false });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, product: null, error: null, notFound: false });
  }, []);

  return { ...state, lookup, reset };
}
