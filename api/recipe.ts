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
    const { prompt } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Recipe generation failed (${response.status})` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
