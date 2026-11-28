import type { HourlyTrendPoint } from '../utils/analytics';

export interface DeltaEntry {
  previousAvgAqi: number;
  currentAvgAqi: number;
  changePct: number;
}

export interface AnalyticsSummaryResponse {
  hourlyTrend: HourlyTrendPoint[];
  stateDeltas: Record<string, DeltaEntry>;
  cityDeltas: Record<string, DeltaEntry>;
  meta: {
    bucketCount: number;
    earliestBucketAt: string | null;
    latestBucketAt: string | null;
  };
}

export interface AnalyticsAIContextPayload {
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

export interface AnalyticsAIResponse {
  answer: string;
  source: 'gemini' | 'deterministic';
}

const SUMMARY_CACHE_TTL_MS = 5 * 60_000;
let cachedSummary: { data: AnalyticsSummaryResponse; cachedAt: number } | null = null;

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  if (cachedSummary && Date.now() - cachedSummary.cachedAt < SUMMARY_CACHE_TTL_MS) {
    return cachedSummary.data;
  }

  const response = await fetch('/api/analytics/summary', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Analytics summary failed (${response.status})`);
  }

  const data = (await response.json()) as AnalyticsSummaryResponse;
  cachedSummary = { data, cachedAt: Date.now() };
  return data;
}

export async function fetchAnalyticsAI(payload: {
  mode: 'story' | 'ask';
  question?: string;
  context: AnalyticsAIContextPayload;
}): Promise<AnalyticsAIResponse> {
  const response = await fetch('/api/airwatch-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status})`);
  }

  return (await response.json()) as AnalyticsAIResponse;
}
