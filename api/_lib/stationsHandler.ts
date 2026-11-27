import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  CPCBError,
  fetchCPCBData,
  type AQICategory,
  type NormalizedAQI,
  type NormalizedStation,
} from './cpcb.js';
import { DatabaseIngestError, persistIngestedData } from './ingestService.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

const STALE_THRESHOLD_MS = 65 * 60_000;

interface StationRow {
  station_id: string;
  station_name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  active: boolean;
  source: string;
}

interface AqiLatestRow {
  station_id: string;
  aqi: number | null;
  aqi_category: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  nh3: number | null;
  source_timestamp: string | null;
  fetched_at: string;
  data_status: 'live' | 'delayed' | 'unavailable';
}

function logSafeStationsError(
  stage: string,
  code: string,
  message: string,
  durationMs: number
): void {
  console.error(
    JSON.stringify({
      event: 'stations_latest_failed',
      stage,
      code,
      message,
      durationMs,
      timestamp: new Date().toISOString(),
    })
  );
}

function extractErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code) {
    return String((err as { code: unknown }).code);
  }
  if (err instanceof Error) {
    return err.name;
  }
  return 'UNKNOWN';
}

function mapStationRow(row: StationRow): NormalizedStation {
  return {
    stationId: row.station_id,
    stationName: row.station_name,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    active: row.active,
    source: row.source,
  };
}

function mapLatestRow(row: AqiLatestRow): NormalizedAQI {
  return {
    stationId: row.station_id,
    aqi: row.aqi,
    aqiCategory: row.aqi_category as AQICategory,
    pollutants: {
      pm25: row.pm25,
      pm10: row.pm10,
      no2: row.no2,
      so2: row.so2,
      co: row.co,
      o3: row.o3,
      nh3: row.nh3,
    },
    sourceTimestamp: row.source_timestamp,
    fetchedAt: row.fetched_at,
    dataStatus: row.data_status,
  };
}

export async function handleLatestStations(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logSafeStationsError(
      'SUPABASE_INIT',
      'SUPABASE_NOT_CONFIGURED',
      'Supabase server credentials missing',
      Date.now() - startedAt
    );
    res.status(500).json({
      stage: 'SUPABASE_INIT',
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'Unable to initialize air-quality database connection.',
    });
    return;
  }

  let stations: NormalizedStation[] = [];
  let readingsMap = new Map<string, NormalizedAQI>();
  let latestFetchedAt: string | null = null;

  try {
    const [stationsResult, latestResult] = await Promise.all([
      supabase
        .from('stations')
        .select('station_id, station_name, city, state, latitude, longitude, active, source')
        .eq('active', true)
        .limit(2000),
      supabase
        .from('aqi_latest')
        .select(
          'station_id, aqi, aqi_category, pm25, pm10, no2, so2, co, o3, nh3, source_timestamp, fetched_at, data_status'
        )
        .limit(2000),
    ]);

    if (stationsResult.error) {
      throw stationsResult.error;
    }
    if (latestResult.error) {
      throw latestResult.error;
    }

    stations = ((stationsResult.data ?? []) as StationRow[]).map(mapStationRow);
    for (const row of (latestResult.data ?? []) as AqiLatestRow[]) {
      const reading = mapLatestRow(row);
      readingsMap.set(reading.stationId, reading);
      if (!latestFetchedAt || (reading.fetchedAt && reading.fetchedAt > latestFetchedAt)) {
        latestFetchedAt = reading.fetchedAt;
      }
    }
  } catch (err) {
    const code = extractErrorCode(err);
    logSafeStationsError('SUPABASE_READ', code, 'Supabase read failed', Date.now() - startedAt);
    res.status(500).json({
      stage: 'SUPABASE_READ',
      code,
      error: 'Unable to read air-quality data from database.',
    });
    return;
  }

  const isStale =
    stations.length === 0 ||
    !latestFetchedAt ||
    Date.now() - Date.parse(latestFetchedAt) > STALE_THRESHOLD_MS;

  if (isStale && process.env.CPCB_API_KEY?.trim()) {
    try {
      const fresh = await fetchCPCBData();
      if (fresh.stations.length > 0) {
        stations = fresh.stations;
        readingsMap = new Map(fresh.readings.map((r) => [r.stationId, r]));
        latestFetchedAt = fresh.readings[0]?.fetchedAt ?? new Date().toISOString();
        await persistIngestedData(fresh.stations, fresh.readings, fresh.skippedCount);
      }
    } catch (err) {
      const code =
        err instanceof CPCBError || err instanceof DatabaseIngestError
          ? err.code
          : extractErrorCode(err);
      logSafeStationsError(
        err instanceof DatabaseIngestError ? 'SUPABASE_WRITE' : 'CPCB_FETCH',
        code,
        'Background refresh failed; falling back to cached stations if available',
        Date.now() - startedAt
      );

      if (stations.length > 0) {
        for (const [id, reading] of readingsMap.entries()) {
          readingsMap.set(id, { ...reading, dataStatus: 'delayed' });
        }
      }
    }
  }

  const combined = stations.map((station) => {
    const reading = readingsMap.get(station.stationId);
    return {
      ...station,
      aqi: reading?.aqi ?? null,
      aqiCategory: reading?.aqiCategory ?? 'Unavailable',
      pollutants: reading?.pollutants ?? {
        pm25: null,
        pm10: null,
        no2: null,
        so2: null,
        co: null,
        o3: null,
        nh3: null,
      },
      sourceTimestamp: reading?.sourceTimestamp ?? null,
      fetchedAt: reading?.fetchedAt ?? null,
      dataStatus: reading?.dataStatus ?? 'unavailable',
    };
  });

  const overallStatus =
    combined.length === 0
      ? 'unavailable'
      : combined.some((s) => s.dataStatus === 'delayed')
        ? 'delayed'
        : 'live';

  res.status(200).json({
    stations: combined,
    count: combined.length,
    lastUpdated: latestFetchedAt,
    dataStatus: overallStatus,
    meta: {
      totalStations: combined.length,
      lastUpdated: latestFetchedAt,
      dataStatus: overallStatus,
      source: 'CPCB / data.gov.in via O2CITY',
    },
  });
}
