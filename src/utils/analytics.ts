import type { AQICategory, Pollutants } from '../types/aqi';
import type { CitySummary, StationWithAQI } from '../types/station';
import { AQI_CATEGORIES, getAQICategory, getAQIMetaByValue } from './aqi.ts';

export const METRO_CITIES = [
  'Delhi',
  'Mumbai',
  'Pune',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Hyderabad',
  'Ahmedabad',
] as const;

export type PollutantKey = keyof Pollutants;

export const POLLUTANT_META: Record<
  PollutantKey,
  { label: string; colorHex: string; standardLimit: number }
> = {
  pm25: { label: 'PM2.5', colorHex: '#ef4444', standardLimit: 60 },
  pm10: { label: 'PM10', colorHex: '#f97316', standardLimit: 100 },
  no2: { label: 'NO2', colorHex: '#eab308', standardLimit: 80 },
  so2: { label: 'SO2', colorHex: '#84cc16', standardLimit: 80 },
  co: { label: 'CO', colorHex: '#06b6d4', standardLimit: 2 },
  o3: { label: 'O3', colorHex: '#8b5cf6', standardLimit: 100 },
  nh3: { label: 'NH3', colorHex: '#ec4899', standardLimit: 400 },
};

export interface DistributionBucket {
  category: AQICategory | 'Unclassified';
  rangeLabel: string;
  colorHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  count: number;
  percentage: number;
}

export interface StateAverageItem {
  state: string;
  averageAqi: number;
  category: AQICategory;
  colorHex: string;
  stationCount: number;
}

export interface PollutantBreakdownItem {
  key: PollutantKey;
  label: string;
  colorHex: string;
  count: number;
  percentage: number;
}

export interface RankedCityItem {
  city: string;
  state: string;
  averageAqi: number;
  category: AQICategory;
  colorHex: string;
  stationCount: number;
  validStationCount: number;
  lowConfidence: boolean;
  dominantPollutant: string;
}

/**
 * Counts how many valid non-null pollutant readings a station has.
 */
export function countValidPollutants(pollutants: Pollutants): number {
  let count = 0;
  for (const val of Object.values(pollutants)) {
    if (val !== null && Number.isFinite(val) && val >= 0) {
      count += 1;
    }
  }
  return count;
}

/**
 * CPCB NAQI rule: AQI is valid for ranking only when at least 3 pollutants
 * are available AND at least one of PM2.5 or PM10 is present.
 */
export function isStationCpcbValid(station: StationWithAQI): boolean {
  if (station.aqi === null || !Number.isFinite(station.aqi) || station.aqi < 0) {
    return false;
  }
  const hasParticulate =
    (station.pollutants.pm25 !== null && Number.isFinite(station.pollutants.pm25)) ||
    (station.pollutants.pm10 !== null && Number.isFinite(station.pollutants.pm10));
  if (!hasParticulate) return false;
  return countValidPollutants(station.pollutants) >= 3;
}

/**
 * Determines dominant pollutant for a station by highest ratio to CPCB NAAQS limit.
 */
export function getDominantPollutantKey(pollutants: Pollutants): PollutantKey | null {
  let bestKey: PollutantKey | null = null;
  let bestRatio = -1;

  (Object.keys(POLLUTANT_META) as PollutantKey[]).forEach((key) => {
    const value = pollutants[key];
    if (value === null || !Number.isFinite(value) || value < 0) return;
    const ratio = value / POLLUTANT_META[key].standardLimit;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestKey = key;
    }
  });

  return bestKey;
}

/**
 * Computes AQI distribution buckets such that the sum of all buckets
 * (6 CPCB categories + Unclassified) ALWAYS equals stations.length.
 */
export function computeAqiDistribution(
  stations: readonly StationWithAQI[]
): DistributionBucket[] {
  const counts = new Map<AQICategory | 'Unclassified', number>();
  for (const cat of AQI_CATEGORIES) {
    counts.set(cat.category, 0);
  }
  counts.set('Unclassified', 0);

  for (const station of stations) {
    if (station.aqi === null || !Number.isFinite(station.aqi) || station.aqi < 0) {
      counts.set('Unclassified', (counts.get('Unclassified') ?? 0) + 1);
      continue;
    }
    const category = getAQICategory(station.aqi);
    if (category === 'Unavailable') {
      counts.set('Unclassified', (counts.get('Unclassified') ?? 0) + 1);
    } else {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const total = stations.length || 1;
  const result: DistributionBucket[] = AQI_CATEGORIES.map((cat) => {
    const count = counts.get(cat.category) ?? 0;
    return {
      category: cat.category,
      rangeLabel: cat.rangeLabel,
      colorHex: cat.colorHex,
      bgClass: cat.bgClass,
      textClass: cat.textClass,
      borderClass: cat.borderClass,
      dotClass: cat.dotClass,
      count,
      percentage: stations.length > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });

  const unclassifiedCount = counts.get('Unclassified') ?? 0;
  if (unclassifiedCount > 0) {
    result.push({
      category: 'Unclassified',
      rangeLabel: 'N/A',
      colorHex: '#94A3B8',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700',
      borderClass: 'border-slate-200',
      dotClass: 'bg-slate-400',
      count: unclassifiedCount,
      percentage: stations.length > 0 ? Math.round((unclassifiedCount / total) * 1000) / 10 : 0,
    });
  }

  return result;
}

/**
 * Computes state-wise average AQI for states with at least `minStations` valid stations.
 */
export function computeStateAverages(
  stations: readonly StationWithAQI[],
  minStations = 2
): StateAverageItem[] {
  const byState = new Map<string, number[]>();

  for (const station of stations) {
    if (station.aqi === null || !Number.isFinite(station.aqi) || station.aqi < 0) continue;
    const stateName = station.state.trim();
    if (!stateName) continue;
    const list = byState.get(stateName);
    if (list) list.push(station.aqi);
    else byState.set(stateName, [station.aqi]);
  }

  const averages: StateAverageItem[] = [];
  for (const [state, values] of byState.entries()) {
    if (values.length < minStations) continue;
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const meta = getAQIMetaByValue(avg);
    averages.push({
      state,
      averageAqi: avg,
      category: meta.category,
      colorHex: meta.colorHex,
      stationCount: values.length,
    });
  }

  return averages.sort((a, b) => b.averageAqi - a.averageAqi);
}

/**
 * Returns Top N and Bottom N states from state averages.
 */
export function getTopAndBottomStates(
  stateAverages: readonly StateAverageItem[],
  count = 10
): { top: StateAverageItem[]; bottom: StateAverageItem[] } {
  const sortedDesc = [...stateAverages].sort((a, b) => b.averageAqi - a.averageAqi);
  const top = sortedDesc.slice(0, count);
  const bottom = [...stateAverages]
    .sort((a, b) => a.averageAqi - b.averageAqi)
    .slice(0, count);
  return { top, bottom };
}

/**
 * Computes dominant pollutant breakdown across stations.
 */
export function computeDominantPollutantBreakdown(
  stations: readonly StationWithAQI[]
): PollutantBreakdownItem[] {
  const counts = new Map<PollutantKey, number>();
  let totalMatched = 0;

  for (const station of stations) {
    const dom = getDominantPollutantKey(station.pollutants);
    if (!dom) continue;
    counts.set(dom, (counts.get(dom) ?? 0) + 1);
    totalMatched += 1;
  }

  const denom = totalMatched || 1;
  return (Object.keys(POLLUTANT_META) as PollutantKey[])
    .map((key) => {
      const count = counts.get(key) ?? 0;
      return {
        key,
        label: POLLUTANT_META[key].label,
        colorHex: POLLUTANT_META[key].colorHex,
        count,
        percentage: totalMatched > 0 ? Math.round((count / denom) * 1000) / 10 : 0,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Builds ranked city summaries with CPCB validity checks and low-confidence flags.
 */
export function buildRankedCities(stations: readonly StationWithAQI[]): RankedCityItem[] {
  const grouped = new Map<
    string,
    {
      city: string;
      state: string;
      allCount: number;
      validAqis: number[];
      fallbackAqis: number[];
      dominantCounts: Map<PollutantKey, number>;
    }
  >();

  for (const s of stations) {
    const key = `${s.city.trim().toLowerCase()}|${s.state.trim().toLowerCase()}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        city: s.city.trim(),
        state: s.state.trim(),
        allCount: 0,
        validAqis: [],
        fallbackAqis: [],
        dominantCounts: new Map(),
      };
      grouped.set(key, entry);
    }
    entry.allCount += 1;

    if (s.aqi !== null && Number.isFinite(s.aqi) && s.aqi >= 0) {
      entry.fallbackAqis.push(s.aqi);
      if (isStationCpcbValid(s)) {
        entry.validAqis.push(s.aqi);
      }
    }

    const dom = getDominantPollutantKey(s.pollutants);
    if (dom) {
      entry.dominantCounts.set(dom, (entry.dominantCounts.get(dom) ?? 0) + 1);
    }
  }

  const items: RankedCityItem[] = [];
  for (const entry of grouped.values()) {
    const usedAqis = entry.validAqis.length > 0 ? entry.validAqis : entry.fallbackAqis;
    if (usedAqis.length === 0) continue;

    const avg = Math.round(usedAqis.reduce((sum, v) => sum + v, 0) / usedAqis.length);
    const meta = getAQIMetaByValue(avg);

    let dominantLabel = '—';
    let maxDomCount = -1;
    for (const [k, c] of entry.dominantCounts.entries()) {
      if (c > maxDomCount) {
        maxDomCount = c;
        dominantLabel = POLLUTANT_META[k].label;
      }
    }

    items.push({
      city: entry.city,
      state: entry.state,
      averageAqi: avg,
      category: meta.category,
      colorHex: meta.colorHex,
      stationCount: entry.allCount,
      validStationCount: entry.validAqis.length,
      lowConfidence: entry.validAqis.length < 2,
      dominantPollutant: dominantLabel,
    });
  }

  return items;
}

/**
 * Computes max timestamp across station `sourceTimestamp` / `fetchedAt` and fallback.
 */
export function getMaxUpdateTimestamp(
  stations: readonly StationWithAQI[],
  fallbackIso: string | null
): string | null {
  let maxMs = fallbackIso ? Date.parse(fallbackIso) : NaN;
  let maxIso = !Number.isNaN(maxMs) ? fallbackIso : null;

  for (const s of stations) {
    const candidate = s.sourceTimestamp ?? s.fetchedAt;
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (!Number.isNaN(ms) && (Number.isNaN(maxMs) || ms > maxMs)) {
      maxMs = ms;
      maxIso = candidate;
    }
  }

  return maxIso;
}

/**
 * Generates rule-based Hinglish "Aaj ka insight" summary from live station and state stats.
 */
export function generateAajKaInsight(
  stations: readonly StationWithAQI[],
  stateAverages: readonly StateAverageItem[]
): string {
  if (stations.length === 0) {
    return 'Abhi live CPCB stations ka data load ho raha hai.';
  }

  const veryPoorPlusCount = stations.filter(
    (s) => s.aqi !== null && Number.isFinite(s.aqi) && s.aqi > 300
  ).length;

  const sortedDesc = [...stateAverages].sort((a, b) => b.averageAqi - a.averageAqi);
  const mostAffected = sortedDesc[0];
  const cleanest = sortedDesc[sortedDesc.length - 1];

  const parts: string[] = [];
  parts.push(
    `Desh ke ${stations.length} active stations me se ${veryPoorPlusCount} station Very Poor ya Severe (AQI 301+) category me hain.`
  );

  if (mostAffected && cleanest && mostAffected.state !== cleanest.state) {
    parts.push(
      `Sabse zyada prabhavit state ${mostAffected.state} (avg AQI ${mostAffected.averageAqi}) hai, jabki ${cleanest.state} (avg AQI ${cleanest.averageAqi}) sabse saaf hai.`
    );
  } else if (mostAffected) {
    parts.push(
      `Sabse zyada prabhavit state ${mostAffected.state} (avg AQI ${mostAffected.averageAqi}) hai.`
    );
  }

  return parts.join(' ');
}

/**
 * Extracts comparison summaries for the 8 major Indian metro cities.
 */
export function getMetroCitiesSummary(
  cities: readonly CitySummary[],
  stations: readonly StationWithAQI[]
): RankedCityItem[] {
  const ranked = buildRankedCities(stations);
  return METRO_CITIES.map((metroName) => {
    const fromRanked = ranked.find(
      (c) => c.city.toLowerCase() === metroName.toLowerCase()
    );
    if (fromRanked) return fromRanked;

    const fromCities = cities.find(
      (c) => c.city.toLowerCase() === metroName.toLowerCase()
    );
    const avg = fromCities?.averageAqi ?? 0;
    const meta = getAQIMetaByValue(fromCities?.averageAqi ?? null);
    return {
      city: metroName,
      state: fromCities?.state ?? 'India',
      averageAqi: avg,
      category: meta.category,
      colorHex: meta.colorHex,
      stationCount: fromCities?.stationCount ?? 0,
      validStationCount: 0,
      lowConfidence: true,
      dominantPollutant: '—',
    };
  });
}
