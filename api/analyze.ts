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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageBase64, prompt } = await req.json();

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Claude API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
