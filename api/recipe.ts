import { callAnthropic } from './_anthropic';
import { logger } from './_logger';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are a creative chef specialized in low-FODMAP cooking for people in Belgium/Europe.

Generate a recipe based on the user's request. Requirements:
- All ingredients must be low FODMAP or have FODMAP-safe serving sizes noted
- Use ingredients commonly available in Belgian supermarkets (Delhaize, Colruyt, Carrefour, Albert Heijn)
- Include metric measurements (grams, ml)
- Flag any ingredients that are portion-sensitive with exact safe amounts
- Suggest modifications for common trigger foods
- Base your ratings on Monash University FODMAP research

Respond in JSON format:
{
  "name": "string",
  "description": "string",
  "prepTime": "string",
  "cookTime": "string",
  "servings": number,
  "ingredients": [
    {
      "name": "string",
      "amount": "string",
      "unit": "string",
      "fodmapRating": "green|amber",
      "fodmapNote": "string or null"
    }
  ],
  "steps": ["string"],
  "tips": "string",
  "fodmapNotes": "string"
}`;

export default async function handler(req: Request) {
  const requestId = crypto.randomUUID();

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error('recipe_no_api_key', { requestId });
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      logger.warn('recipe_bad_request', { requestId, reason: 'prompt missing or empty' });
      return new Response(JSON.stringify({ error: 'Invalid request: prompt must be a non-empty string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    logger.debug('recipe_request', { requestId, promptChars: prompt.length });

    let response: Response;
    try {
      response = await callAnthropic({
        apiKey,
        requestId,
        body: {
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        },
      });
    } catch (apiErr: unknown) {
      const e = apiErr as { status?: number; message?: string };
      logger.error('recipe_api_error', { requestId, status: e.status, message: e.message });
      return new Response(JSON.stringify({ error: e.message ?? 'Recipe generation failed' }), {
        status: e.status ?? 500,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  } catch (err) {
    logger.error('recipe_unhandled', {
      requestId,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response(
      JSON.stringify({ error: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId } }
    );
  }
}
