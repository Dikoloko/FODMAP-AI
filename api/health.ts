export const config = { runtime: 'edge' };

export default function handler(_req: Request): Response {
  const apiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  if (!apiKeyPresent) {
    return new Response(JSON.stringify({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, model }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
