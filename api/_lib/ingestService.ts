import type { NormalizedAQI, NormalizedStation } from './cpcb.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export interface IngestSummary {
  success: boolean;
  stationsProcessed: number;
  updated: number;
  skipped: number;
  timestamp: string;
}

export class DatabaseIngestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DatabaseIngestError';
    this.code = code;
  }
}

interface StationUpsertRow {
  station_id: string;
  station_name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  active: boolean;
  source: string;
  updated_at: string;
}

interface AqiLatestUpsertRow {
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
  updated_at: string;
}

interface AqiHistoryUpsertRow {
  station_id: string;
  bucket_at: string;
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
}

const CHUNK_SIZE = 200;

/**
 * Converts an ingestion fetchedAt timestamp to UTC and truncates it
 * to the beginning of its UTC hour (YYYY-MM-DDTHH:00:00.000Z).
 */
export function computeUtcHourBucket(fetchedAt: string): string {
  const ms = Date.parse(fetchedAt);
  if (!Number.isFinite(ms)) {
    throw new DatabaseIngestError(
      'INVALID_FETCHED_AT',
      'Invalid fetchedAt timestamp for UTC hourly bucket calculation'
    );
  }
  const hourStartMs = Math.floor(ms / 3_600_000) * 3_600_000;
  return new Date(hourStartMs).toISOString();
}

function formatSupabaseErrorDetail(err: { code?: string; message?: string }): string {
  return err.code ? `${err.code}: ${err.message ?? 'Unknown error'}` : err.message ?? 'Unknown error';
}

/**
 * Idempotently upserts normalized stations, latest AQI readings, and 1-hour UTC
 * history snapshots into Supabase PostgreSQL in strict sequential order:
 * 1) stations -> 2) aqi_latest -> 3) aqi_history.
 */
export async function persistIngestedData(
  stations: readonly NormalizedStation[],
  readings: readonly NormalizedAQI[],
  skippedCount: number
): Promise<IngestSummary> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new DatabaseIngestError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase server credentials (SUPABASE_URL / SUPABASE_SECRET_KEY) are missing'
    );
  }

  const nowIso = new Date().toISOString();

  const stationMap = new Map<string, StationUpsertRow>();
  for (const s of stations) {
    stationMap.set(s.stationId, {
      station_id: s.stationId,
      station_name: s.stationName,
      city: s.city,
      state: s.state,
      latitude: s.latitude,
      longitude: s.longitude,
      active: s.active,
      source: s.source,
      updated_at: nowIso,
    });
  }
  const stationRows = Array.from(stationMap.values());

  const latestMap = new Map<string, AqiLatestUpsertRow>();
  const historyMap = new Map<string, AqiHistoryUpsertRow>();

  for (const r of readings) {
    latestMap.set(r.stationId, {
      station_id: r.stationId,
      aqi: r.aqi,
      aqi_category: r.aqiCategory,
      pm25: r.pollutants.pm25,
      pm10: r.pollutants.pm10,
      no2: r.pollutants.no2,
      so2: r.pollutants.so2,
      co: r.pollutants.co,
      o3: r.pollutants.o3,
      nh3: r.pollutants.nh3,
      source_timestamp: r.sourceTimestamp,
      fetched_at: r.fetchedAt,
      data_status: r.dataStatus,
      updated_at: nowIso,
    });

    if (r.aqi !== null) {
      const bucketAt = computeUtcHourBucket(r.fetchedAt);
      historyMap.set(`${r.stationId}__${bucketAt}`, {
        station_id: r.stationId,
        bucket_at: bucketAt,
        aqi: r.aqi,
        aqi_category: r.aqiCategory,
        pm25: r.pollutants.pm25,
        pm10: r.pollutants.pm10,
        no2: r.pollutants.no2,
        so2: r.pollutants.so2,
        co: r.pollutants.co,
        o3: r.pollutants.o3,
        nh3: r.pollutants.nh3,
        source_timestamp: r.sourceTimestamp,
        fetched_at: r.fetchedAt,
      });
    }
  }

  const latestRows = Array.from(latestMap.values());
  const historyRows = Array.from(historyMap.values());

  // Stage 1: Upsert all stations first
  for (let i = 0; i < stationRows.length; i += CHUNK_SIZE) {
    const chunk = stationRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('stations')
      .upsert(chunk, { onConflict: 'station_id' });

    if (error) {
      throw new DatabaseIngestError(
        'SUPABASE_STATIONS_WRITE_FAILED',
        `Supabase stations upsert failed (${formatSupabaseErrorDetail(error)})`
      );
    }
  }

  // Stage 2: Upsert aqi_latest only after all stations upserts succeed
  for (let i = 0; i < latestRows.length; i += CHUNK_SIZE) {
    const chunk = latestRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('aqi_latest')
      .upsert(chunk, { onConflict: 'station_id' });

    if (error) {
      throw new DatabaseIngestError(
        'SUPABASE_LATEST_WRITE_FAILED',
        `Supabase aqi_latest upsert failed (${formatSupabaseErrorDetail(error)})`
      );
    }
  }

  // Stage 3: Upsert aqi_history only after all aqi_latest upserts succeed
  for (let i = 0; i < historyRows.length; i += CHUNK_SIZE) {
    const chunk = historyRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('aqi_history')
      .upsert(chunk, { onConflict: 'station_id,bucket_at' });

    if (error) {
      throw new DatabaseIngestError(
        'SUPABASE_HISTORY_WRITE_FAILED',
        `Supabase aqi_history upsert failed (${formatSupabaseErrorDetail(error)})`
      );
    }
  }

  return {
    success: true,
    stationsProcessed: stationRows.length,
    updated: latestRows.length,
    skipped: skippedCount,
    timestamp: new Date().toISOString(),
  };
}
