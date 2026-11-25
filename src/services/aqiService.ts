import type { AQIHistoryPoint, AQIResponseMeta } from '../types/aqi';
import type { CitySummary, StationWithAQI } from '../types/station';
import { getAQICategory } from '../utils/aqi';
import { fetchLatestFromFirestore } from './firebaseService';

export interface LatestAQIResponse {
  stations: StationWithAQI[];
  meta: AQIResponseMeta;
}

export async function fetchLatestAQI(): Promise<LatestAQIResponse> {
  try {
    const response = await fetch('/api/aqi/latest', {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = (await response.json()) as LatestAQIResponse;
      if (Array.isArray(data.stations)) {
        return data;
      }
    }
  } catch {
    // Fall through to Firestore client fallback if configured
  }

  try {
    const firestoreData = await fetchLatestFromFirestore();
    if (firestoreData.stations.length > 0) {
      return {
        stations: firestoreData.stations,
        meta: {
          totalStations: firestoreData.stations.length,
          lastUpdated: firestoreData.lastUpdated,
          dataStatus: 'live',
          source: 'Firebase Firestore',
        },
      };
    }
  } catch {
    // Handled below with honest unavailable state
  }

  return {
    stations: [],
    meta: {
      totalStations: 0,
      lastUpdated: null,
      dataStatus: 'unavailable',
      source: 'CPCB / data.gov.in',
    },
  };
}

export async function fetchStationHistory(
  stationId: string,
  limit = 24
): Promise<AQIHistoryPoint[]> {
  try {
    const params = new URLSearchParams({
      stationId,
      limit: String(limit),
    });
    const response = await fetch(`/api/aqi/history?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { history?: AQIHistoryPoint[] };
    return Array.isArray(data.history) ? data.history : [];
  } catch {
    return [];
  }
}

/**
 * Aggregates station-level AQI readings into city-level summaries for search and analytics.
 */
export function aggregateCities(stations: readonly StationWithAQI[]): CitySummary[] {
  const grouped = new Map<string, StationWithAQI[]>();

  for (const station of stations) {
    const key = `${station.city.toLowerCase()}__${station.state.toLowerCase()}`;
    const list = grouped.get(key) ?? [];
    list.push(station);
    grouped.set(key, list);
  }

  const summaries: CitySummary[] = [];

  for (const group of grouped.values()) {
    const primaryStation =
      group.find((s) => s.aqi !== null) ?? group[0]!;
    const validAqis = group
      .map((s) => s.aqi)
      .filter((v): v is number => v !== null && Number.isFinite(v));

    const averageAqi =
      validAqis.length > 0
        ? Math.round(validAqis.reduce((acc, v) => acc + v, 0) / validAqis.length)
        : null;

    const latestTs = group
      .map((s) => s.fetchedAt ?? s.sourceTimestamp)
      .filter((t): t is string => Boolean(t))
      .sort()
      .at(-1) ?? null;

    summaries.push({
      city: primaryStation.city,
      state: primaryStation.state,
      stationCount: group.length,
      averageAqi,
      aqiCategory: getAQICategory(averageAqi),
      primaryStation,
      lastUpdated: latestTs,
    });
  }

  return summaries.sort((a, b) => a.city.localeCompare(b.city));
}
