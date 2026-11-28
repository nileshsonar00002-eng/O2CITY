import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface AnalyticsAIContext {
  nationalAvgAqi: number | null;
  nationalCategory: string;
  activeStations: number;
  monitoredCities: number;
  veryPoorPlusCount: number;
  veryPoorPlusPct: number;
  changePct12h: number | null;
  dominantPollutant: string | null;
  worstStates: Array<{ state: string; averageAqi: number; changePct?: number | null }>;
  cleanestStates: Array<{ state: string; averageAqi: number; changePct?: number | null }>;
  forecastDirection: string;
}

interface AirwatchRequestBody {
  mode?: 'story' | 'ask';
  question?: string;
  context?: AnalyticsAIContext;
}

function buildDeterministicExplanation(
  ctx: AnalyticsAIContext,
  question?: string
): string {
  const aqiPart =
    ctx.nationalAvgAqi !== null
      ? `India's national average AQI is ${ctx.nationalAvgAqi} (${ctx.nationalCategory}) across ${ctx.activeStations} monitoring stations in ${ctx.monitoredCities} cities, with ${ctx.veryPoorPlusCount} stations (${ctx.veryPoorPlusPct}%) in Very Poor or Severe levels.`
      : `O2CITY is tracking ${ctx.activeStations} stations across ${ctx.monitoredCities} cities.`;

  const trendPart =
    ctx.changePct12h !== null
      ? `Over the available historical window, national AQI shifted by ${ctx.changePct12h > 0 ? `+${ctx.changePct12h}` : ctx.changePct12h}%${ctx.dominantPollutant ? `, driven primarily by ${ctx.dominantPollutant}` : ''}.`
      : ctx.dominantPollutant
        ? `${ctx.dominantPollutant} is currently the leading pollutant across reporting stations.`
        : '';

  const worst = ctx.worstStates[0];
  const clean = ctx.cleanestStates[0];
  const geoPart =
    worst && clean
      ? `${worst.state} (${worst.averageAqi} AQI) is among the most polluted states, while ${clean.state} (${clean.averageAqi} AQI) remains comparatively cleaner.`
      : '';

  const outlookPart =
    ctx.forecastDirection && ctx.forecastDirection !== 'unavailable'
      ? `Near-term statistical outlook points toward ${ctx.forecastDirection} conditions.`
      : '';

  if (question && question.toLowerCase().includes('state') && ctx.worstStates.length > 0) {
    const topList = ctx.worstStates
      .slice(0, 3)
      .map((s) => `${s.state} (${s.averageAqi}${typeof s.changePct === 'number' ? `, ${s.changePct > 0 ? `+${s.changePct}` : s.changePct}%` : ''})`)
      .join(', ');
    return `Highest state-level averages right now are ${topList}. ${trendPart} ${outlookPart}`.trim();
  }

  return [aqiPart, trendPart, geoPart, outlookPart].filter(Boolean).join(' ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as AirwatchRequestBody;
  const ctx = body.context;
  if (!ctx || typeof ctx !== 'object') {
    res.status(400).json({ error: 'Structured analytics context is required.' });
    return;
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 300) : '';
  const fallbackAnswer = buildDeterministicExplanation(ctx, question);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(200).json({
      answer: fallbackAnswer,
      source: 'deterministic',
    });
    return;
  }

  const systemInstruction =
    'You are O2CITY Air Quality Intelligence. Explain air quality concisely in 2 to 4 plain sentences using ONLY the structured JSON metrics provided. NEVER invent numbers, percentages, forecasts, or locations not present in the JSON.';

  const userPrompt = question
    ? `Question: ${question}\n\nVerified O2CITY Analytics JSON:\n${JSON.stringify(ctx)}`
    : `Summarize what changed, what is driving today's air quality, which areas are most affected, and what users should understand.\n\nVerified O2CITY Analytics JSON:\n${JSON.stringify(ctx)}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 220,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      res.status(200).json({ answer: fallbackAnswer, source: 'deterministic' });
      return;
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      res.status(200).json({ answer: fallbackAnswer, source: 'deterministic' });
      return;
    }

    res.status(200).json({ answer: text, source: 'gemini' });
  } catch {
    res.status(200).json({ answer: fallbackAnswer, source: 'deterministic' });
  }
}
