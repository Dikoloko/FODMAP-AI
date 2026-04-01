/**
 * Extract and parse a JSON object from a Claude API response string.
 * Claude sometimes wraps JSON in markdown code fences or prose; this
 * pulls out the first `{...}` block and parses it.
 */
export function parseClaudeJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI response could not be read — please try again');
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new Error('AI response could not be read — please try again');
  }
}
