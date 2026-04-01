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
      // DOMException (AbortError from AbortController) does not extend Error in all browsers,
      // so check .name directly rather than relying on instanceof Error.
      const isAbort = err != null && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
      // TypeError means a network-level failure (DNS, connection refused, CORS block, etc.)
      // but only when it's not an abort — some browsers (e.g. Safari) throw TypeError for aborts too.
      const isNetworkError = !isAbort && err instanceof TypeError;
      const message = isAbort
        ? 'Request timed out — please try again'
        : isNetworkError
        ? 'Could not reach product database — check your connection'
        : 'Failed to look up product. Try again.';
      setState({ loading: false, product: null, error: message, notFound: false });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, product: null, error: null, notFound: false });
  }, []);

  return { ...state, lookup, reset };
}
