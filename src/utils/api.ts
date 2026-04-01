import { getCached, setCached } from './storage';
import { logger } from './logger';

export interface OpenFoodFactsProduct {
  product_name: string;
  brands?: string;
  image_front_small_url?: string;
  ingredients_text?: string;
  ingredients_text_nl?: string;
  ingredients_text_fr?: string;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

const NEGATIVE_TTL = 24 * 60 * 60 * 1000; // 24 hours for not-found results

export async function lookupBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  // false = cached as "not found"; null = not in cache at all
  const cached = getCached<OpenFoodFactsProduct | false>(`barcode_${barcode}`);
  if (cached !== null) {
    logger.debug('barcode_cache_hit', { barcode });
    return cached || null;
  }

  // Request only fields we need — dramatically reduces response size and latency
  const fields = 'product_name,brands,image_front_small_url,ingredients_text,ingredients_text_nl,ingredients_text_fr';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const t0 = Date.now();

  let response: Response;
  try {
    response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`,
      {
        headers: {
          'User-Agent': 'FODMAP-AI-App/1.0 (fodmap-ai-assistant)',
        },
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - t0;

  // 404 means the barcode doesn't exist in OFF — treat as not found
  if (response.status === 404) {
    logger.debug('barcode_lookup_not_found', { barcode, durationMs });
    setCached(`barcode_${barcode}`, false, NEGATIVE_TTL);
    return null;
  }
  // Other HTTP errors — throw so the caller can show an error (not "not found")
  if (!response.ok) {
    logger.warn('barcode_lookup_http_error', { barcode, status: response.status, durationMs });
    throw new Error(`Open Food Facts request failed (${response.status})`);
  }

  const data: OpenFoodFactsResponse = await response.json();
  if (data.status !== 1 || !data.product) {
    // Product genuinely not in OpenFoodFacts — cache the negative result
    logger.debug('barcode_lookup_not_found', { barcode, durationMs });
    setCached(`barcode_${barcode}`, false, NEGATIVE_TTL);
    return null;
  }

  logger.debug('barcode_lookup_found', { barcode, durationMs });
  setCached(`barcode_${barcode}`, data.product);
  return data.product;
}
