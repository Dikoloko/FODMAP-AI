import { callAnthropic } from './_anthropic';
import { logger } from './_logger';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are a FODMAP dietitian AI analyzing a patient's food diary and symptom data.

You will receive structured diary data (food logs with FODMAP ratings, daily symptom scores, lifestyle factors).

Analyze the data for patterns a simple correlation engine would miss:
1. **Combination effects**: Foods that are fine alone but problematic together (FODMAP stacking)
2. **Portion sensitivity**: Foods that appear safe in small amounts but trigger symptoms at larger quantities
3. **Timing patterns**: Delayed reactions (12-48h), time-of-day sensitivity
4. **Lifestyle interactions**: How stress, sleep, exercise, or menstruation amplify food reactions
5. **Hidden triggers**: Ingredients that appear across multiple "safe" foods but correlate with bad days
6. **Improvement trends**: Positive changes over time worth reinforcing

Be specific — reference actual foods and dates from the data. Don't give generic FODMAP advice.
If there isn't enough data for a conclusion, say so honestly.
Use a warm, encouraging tone. This is for personal health tracking, not medical diagnosis.

Respond in JSON format:
{
  "summary": "1-2 sentence overview of their gut health pattern",
  "patterns": [
    {
      "type": "trigger|combination|timing|lifestyle|positive",
      "title": "Short title",
      "description": "Specific finding with food names and data references",
      "confidence": "high|medium|low",
      "actionable": "Concrete suggestion"
    }
  ],
  "encouragement": "A brief motivating note about their tracking progress",
  "eliminationSuggestion": "If applicable: which food to try eliminating for 2 weeks and why, or null"
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
    logger.error('insights_no_api_key', { requestId });
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    });
  }

  try {
    const body = await req.json();
    const { entries, symptoms } = body;

    if (!Array.isArray(entries) || !Array.isArray(symptoms)) {
      logger.warn('insights_bad_request', { requestId, reason: 'entries or symptoms not arrays' });
      return new Response(JSON.stringify({ error: 'Invalid request: entries and symptoms must be arrays' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    // Build a readable summary of the diary data for Claude
    const prompt = buildDiaryPrompt(entries, symptoms);

    if (prompt.length > 100_000) {
      logger.warn('insights_payload_too_large', { requestId, promptLength: prompt.length });
      return new Response(JSON.stringify({ error: 'Payload too large. Please reduce the date range.' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      });
    }

    logger.debug('insights_request', {
      requestId,
      entryCount: entries.length,
      symptomCount: symptoms.length,
      promptChars: prompt.length,
    });

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
      logger.error('insights_api_error', { requestId, status: e.status, message: e.message });
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
    logger.error('insights_unhandled', {
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

interface DiaryEntry {
  date: string;
  meal: string;
  foods: Array<{ name: string; rating: string; fodmapTypes: string[]; portion?: string }>;
}

interface DaySymptoms {
  date: string;
  bloating: number;
  pain: number;
  gas: number;
  diarrhea: number;
  constipation: number;
  nausea: number;
  fatigue: number;
  urgency: number;
  bristol: number;
  otherSymptoms: string;
  overallFeeling: string;
  stress: number;
  sleepQuality: number;
  exercise: boolean;
  menstruation: boolean;
}

function buildDiaryPrompt(entries: DiaryEntry[], symptoms: DaySymptoms[]): string {
  // Get all unique dates, sorted
  const allDates = new Set<string>();
  entries.forEach(e => allDates.add(e.date));
  symptoms.forEach(s => allDates.add(s.date));
  const sortedDates = [...allDates].sort();

  const symptomMap = new Map(symptoms.map(s => [s.date, s]));
  const entryMap = new Map<string, DiaryEntry[]>();
  entries.forEach(e => {
    if (!entryMap.has(e.date)) entryMap.set(e.date, []);
    entryMap.get(e.date)!.push(e);
  });

  let prompt = `Here is my food diary and symptom log for the past ${sortedDates.length} days:\n\n`;

  for (const date of sortedDates) {
    prompt += `--- ${date} ---\n`;

    const dayEntries = entryMap.get(date) || [];
    if (dayEntries.length > 0) {
      for (const entry of dayEntries) {
        const foodList = entry.foods.map(f => {
          let s = `${f.name} (${f.rating})`;
          if (f.portion) s += ` [${f.portion}]`;
          if (f.fodmapTypes.length > 0) s += ` {${f.fodmapTypes.join(', ')}}`;
          return s;
        }).join(', ');
        prompt += `  ${entry.meal}: ${foodList}\n`;
      }
    } else {
      prompt += `  No food logged\n`;
    }

    const sym = symptomMap.get(date);
    if (sym) {
      const activeSymptoms = [];
      if (sym.bloating > 0) activeSymptoms.push(`bloating:${sym.bloating}/5`);
      if (sym.pain > 0) activeSymptoms.push(`pain:${sym.pain}/5`);
      if (sym.gas > 0) activeSymptoms.push(`gas:${sym.gas}/5`);
      if (sym.diarrhea > 0) activeSymptoms.push(`diarrhea:${sym.diarrhea}/5`);
      if (sym.constipation > 0) activeSymptoms.push(`constipation:${sym.constipation}/5`);
      if (sym.nausea > 0) activeSymptoms.push(`nausea:${sym.nausea}/5`);
      if (sym.fatigue > 0) activeSymptoms.push(`fatigue:${sym.fatigue}/5`);
      if (sym.urgency > 0) activeSymptoms.push(`urgency:${sym.urgency}/5`);
      if (sym.bristol > 0) activeSymptoms.push(`bristol:${sym.bristol}/7`);
      if (sym.otherSymptoms) activeSymptoms.push(`other:"${sym.otherSymptoms}"`);

      prompt += `  Feeling: ${sym.overallFeeling}`;
      if (activeSymptoms.length > 0) prompt += ` | ${activeSymptoms.join(', ')}`;
      prompt += '\n';

      const lifestyle = [];
      if (sym.stress > 0) lifestyle.push(`stress:${sym.stress}/5`);
      if (sym.sleepQuality > 0) lifestyle.push(`sleep:${sym.sleepQuality}/5`);
      if (sym.exercise) lifestyle.push('exercised');
      if (sym.menstruation) lifestyle.push('period');
      if (lifestyle.length > 0) prompt += `  Lifestyle: ${lifestyle.join(', ')}\n`;
    }

    prompt += '\n';
  }

  prompt += `\nTotal: ${entries.length} meals logged, ${symptoms.length} days with symptom tracking.\n`;
  prompt += `Please analyze this data for patterns, triggers, and actionable insights.`;

  return prompt;
}
