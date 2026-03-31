import { useState, useCallback } from 'react';
import { lookupBarcode, type OpenFoodFactsProduct } from '../utils/api';

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
    } catch {
      setState({ loading: false, product: null, error: 'Failed to look up product. Check your connection.', notFound: false });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, product: null, error: null, notFound: false });
  }, []);

  return { ...state, lookup, reset };
}
