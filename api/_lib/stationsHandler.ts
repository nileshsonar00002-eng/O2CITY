import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { CPCBError, fetchCPCBData, type NormalizedAQI, type NormalizedStation } from './cpcb.js';
import { getFirebaseAdminDb } from './firebaseAdmin.js';
import { FirestoreIngestError, persistIngestedData } from './ingestService.js';

const STALE_THRESHOLD_MS = 65 * 60_000;

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

function extractFirestoreCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: unknown }).code);
  }
  if (err instanceof Error) {
    return err.message === 'FIREBASE_PRIVATE_KEY_INVALID_FORMAT'
      ? 'FIREBASE_PRIVATE_KEY_INVALID_FORMAT'
      : err.name;
  }
  return 'UNKNOWN';
}

export async function handleLatestStations(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  let db: Firestore | null = null;
  try {
    db = getFirebaseAdminDb();
  } catch (err) {
    const code = extractFirestoreCode(err);
    logSafeStationsError('FIREBASE_INIT', code, 'Firebase Admin initialization failed', Date.now() - startedAt);
    res.status(500).json({
      stage: 'FIREBASE_INIT',
      code,
      error: 'Unable to initialize air-quality database connection.',
    });
    return;
  }

  let stations: NormalizedStation[] = [];
  let readingsMap = new Map<string, NormalizedAQI>();
  let latestFetchedAt: string | null = null;

  if (db) {
    try {
      const [stationSnap, latestSnap] = await Promise.all([
        db.collection('stations').where('active', '==', true).get(),
        db.collection('aqi_latest').get(),
      ]);

      stations = stationSnap.docs.map((doc) => doc.data() as NormalizedStation);
      for (const doc of latestSnap.docs) {
        const data = doc.data() as NormalizedAQI;
        readingsMap.set(data.stationId, data);
        if (!latestFetchedAt || (data.fetchedAt && data.fetchedAt > latestFetchedAt)) {
          latestFetchedAt = data.fetchedAt;
        }
      }
    } catch (err) {
      const code = extractFirestoreCode(err);
      logSafeStationsError('FIRESTORE_READ', code, 'Firestore read failed', Date.now() - startedAt);
      res.status(500).json({
        stage: 'FIRESTORE_READ',
        code,
        error: 'Unable to read air-quality data from database.',
      });
      return;
    }
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
        if (db) {
          await persistIngestedData(fresh.stations, fresh.readings, fresh.skippedCount);
        }
      }
    } catch (err) {
      const code =
        err instanceof CPCBError || err instanceof FirestoreIngestError
          ? err.code
          : extractFirestoreCode(err);
      logSafeStationsError(
        err instanceof FirestoreIngestError ? 'FIRESTORE_WRITE' : 'CPCB_FETCH',
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
