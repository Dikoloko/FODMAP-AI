import { callAnthropic } from './_anthropic';
import { logger } from './_logger';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are a FODMAP diet expert analyzing a photo of food.

Identify every food item visible in the image. For each food:
1. Name the food
2. Rate it: GREEN (low FODMAP), AMBER (moderate — portion dependent), or RED (high FODMAP)
3. Specify which FODMAP type(s) are relevant (fructans, GOS, lactose, excess fructose, sorbitol, mannitol)
4. Note safe serving size if applicable
5. Suggest a low-FODMAP alternative if the food is amber/red

Then give an overall meal rating and practical advice.

Be specific about portion sizes in grams where possible.
If you cannot identify a food clearly, say so rather than guessing.
Base your ratings on Monash University FODMAP research.

Respond in JSON format:
{
  "foods": [
    {
      "name": "string",
      "rating": "green|amber|red",
      "fodmapTypes": ["string"],
      "safeServing": "string or null",
      "explanation": "string",
      "alternative": "string or null"
    }
  ],
  "overallRating": "green|amber|red",
  "advice": "string",
  "confidence": "high|medium|low"
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
    logger.error('analyze_no_api_key', { requestId });
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  }

  try {
    const body = await req.json();
    const { imageBase64, prompt } = body;

    if (!imageBase64 && !prompt) {
      logger.warn('analyze_bad_request', { requestId, reason: 'missing imageBase64 and prompt' });
      return new Response(JSON.stringify({ error: 'Invalid request: imageBase64 or prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    if (imageBase64) {
      // base64 encodes 3 bytes as 4 chars; reject if decoded size > 1 MB
      const approxBytes = Math.floor(imageBase64.length * 3 / 4);
      if (approxBytes > 1 * 1024 * 1024) {
        logger.warn('analyze_image_too_large', { requestId, sizeKb: Math.round(approxBytes / 1024) });
        return new Response(JSON.stringify({ error: 'Image too large (max 1 MB)' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
        });
      }
      logger.debug('analyze_request', { requestId, type: 'image', sizeKb: Math.round(approxBytes / 1024) });
    } else {
      logger.debug('analyze_request', { requestId, type: 'text' });
    }

    const userContent: Array<Record<string, unknown>> = [];

    if (imageBase64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: prompt || 'Analyze this food photo for FODMAP content.',
    });

    let response: Response;
    try {
      response = await callAnthropic({
        apiKey,
        requestId,
        body: {
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        },
      });
    } catch (apiErr: unknown) {
      const e = apiErr as { status?: number; message?: string };
      logger.error('analyze_api_error', { requestId, status: e.status, message: e.message });
      return new Response(JSON.stringify({ error: e.message ?? 'Analysis failed' }), {
        status: e.status ?? 500,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  } catch (err) {
    logger.error('analyze_unhandled', {
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
