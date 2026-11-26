import type { Firestore } from 'firebase-admin/firestore';
import type { NormalizedAQI, NormalizedStation } from './cpcb.js';
import { getFirebaseAdminDb } from './firebaseAdmin.js';

export interface IngestSummary {
  success: boolean;
  stationsProcessed: number;
  updated: number;
  skipped: number;
  timestamp: string;
}

export class FirestoreIngestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FirestoreIngestError';
    this.code = code;
  }
}

/**
 * Idempotently writes normalized stations, latest readings, and deterministic history snapshots
 * to Cloud Firestore via Firebase Admin SDK using parallel batch commits.
 */
export async function persistIngestedData(
  stations: readonly NormalizedStation[],
  readings: readonly NormalizedAQI[],
  skippedCount: number
): Promise<IngestSummary> {
  let db: Firestore | null;
  try {
    db = getFirebaseAdminDb();
  } catch (err) {
    const code =
      err instanceof Error && err.message === 'FIREBASE_PRIVATE_KEY_INVALID_FORMAT'
        ? 'FIREBASE_PRIVATE_KEY_INVALID_FORMAT'
        : 'FIREBASE_INIT_FAILED';
    throw new FirestoreIngestError(code, 'Failed to initialize Firebase Admin SDK');
  }

  if (!db) {
    throw new FirestoreIngestError(
      'FIREBASE_NOT_CONFIGURED',
      'Firebase Admin SDK credentials are missing'
    );
  }

  const CHUNK_SIZE = 150;
  let updated = 0;
  const commitPromises: Promise<unknown>[] = [];

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

    commitPromises.push(batch.commit());
  }

  try {
    await Promise.all(commitPromises);
  } catch (err) {
    const errCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'FIRESTORE_BATCH_COMMIT_FAILED';
    throw new FirestoreIngestError(
      'FIRESTORE_WRITE_FAILED',
      `Firestore batch commit failed (${errCode})`
    );
  }

  return {
    success: true,
    stationsProcessed: stations.length,
    updated,
    skipped: skippedCount,
    timestamp: new Date().toISOString(),
  };
}
