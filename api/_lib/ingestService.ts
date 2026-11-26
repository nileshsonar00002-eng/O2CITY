import type { NormalizedAQI, NormalizedStation } from './cpcb.js';
import { getFirebaseAdminDb } from './firebaseAdmin.js';

export interface IngestSummary {
  success: boolean;
  stationsProcessed: number;
  updated: number;
  skipped: number;
  timestamp: string;
}

/**
 * Idempotently writes normalized stations, latest readings, and deterministic history snapshots
 * to Cloud Firestore via Firebase Admin SDK.
 */
export async function persistIngestedData(
  stations: readonly NormalizedStation[],
  readings: readonly NormalizedAQI[],
  skippedCount: number
): Promise<IngestSummary> {
  const db = getFirebaseAdminDb();
  if (!db) {
    throw new Error('Firebase Admin SDK is not configured');
  }

  const CHUNK_SIZE = 150;
  let updated = 0;

  for (let i = 0; i < stations.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    const stationSlice = stations.slice(i, i + CHUNK_SIZE);
    const readingSlice = readings.slice(i, i + CHUNK_SIZE);

    for (const s of stationSlice) {
      batch.set(db.collection('stations').doc(s.stationId), s, { merge: true });
    }

    for (const r of readingSlice) {
      batch.set(db.collection('aqi_latest').doc(r.stationId), r, { merge: true });
      updated += 1;

      if (r.sourceTimestamp && r.aqi !== null) {
        const tsKey = r.sourceTimestamp.replace(/[^0-9]/g, '').slice(0, 12);
        const historyId = `${r.stationId}_${tsKey}`;
        batch.set(
          db.collection('aqi_history').doc(historyId),
          {
            id: historyId,
            stationId: r.stationId,
            aqi: r.aqi,
            aqiCategory: r.aqiCategory,
            pm25: r.pollutants.pm25,
            pm10: r.pollutants.pm10,
            sourceTimestamp: r.sourceTimestamp,
            fetchedAt: r.fetchedAt,
          },
          { merge: true }
        );
      }
    }

    await batch.commit();
  }

  return {
    success: true,
    stationsProcessed: stations.length,
    updated,
    skipped: skippedCount,
    timestamp: new Date().toISOString(),
  };
}
