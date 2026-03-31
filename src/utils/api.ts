import { getCached, setCached } from './storage';

export interface OpenFoodFactsProduct {
  product_name: string;
  brands?: string;
  image_front_small_url?: string;
  ingredients_text?: string;
  ingredients_text_nl?: string;
  ingredients_text_fr?: string;
  nutriments?: Record<string, number>;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

export async function lookupBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const cached = getCached<OpenFoodFactsProduct>(`barcode_${barcode}`);
  if (cached) return cached;

  // Request only fields we need — dramatically reduces response size and latency
  const fields = 'product_name,brands,image_front_small_url,ingredients_text,ingredients_text_nl,ingredients_text_fr';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`,
    {
      headers: {
        'User-Agent': 'FODMAP-AI-App/1.0 (fodmap-ai-assistant)',
      },
      signal: controller.signal,
    }
  );

  clearTimeout(timeout);

  if (!response.ok) return null;

  const data: OpenFoodFactsResponse = await response.json();
  if (data.status !== 1 || !data.product) return null;

  setCached(`barcode_${barcode}`, data.product);
  return data.product;
}
