import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCPCBData, type NormalizedAQI, type NormalizedStation } from '../_lib/cpcb.js';
import { getFirebaseAdminDb } from '../_lib/firebaseAdmin.js';

const STALE_THRESHOLD_MS = 15 * 60_000;

async function persistToFirestore(
  stations: NormalizedStation[],
  readings: NormalizedAQI[]
): Promise<void> {
  const db = getFirebaseAdminDb();
  if (!db) return;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < stations.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    const stationSlice = stations.slice(i, i + CHUNK_SIZE);
    const readingSlice = readings.slice(i, i + CHUNK_SIZE);

    for (const s of stationSlice) {
      batch.set(db.collection('stations').doc(s.stationId), s, { merge: true });
    }

    for (const r of readingSlice) {
      batch.set(db.collection('aqi_latest').doc(r.stationId), r, { merge: true });

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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  try {
    const db = getFirebaseAdminDb();
    let stations: NormalizedStation[] = [];
    let readingsMap = new Map<string, NormalizedAQI>();
    let latestFetchedAt: string | null = null;

    if (db) {
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
    }

    const isStale =
      stations.length === 0 ||
      !latestFetchedAt ||
      Date.now() - Date.parse(latestFetchedAt) > STALE_THRESHOLD_MS;

    if (isStale && process.env.CPCB_API_KEY) {
      try {
        const fresh = await fetchCPCBData();
        if (fresh.stations.length > 0) {
          stations = fresh.stations;
          readingsMap = new Map(fresh.readings.map((r) => [r.stationId, r]));
          latestFetchedAt = fresh.readings[0]?.fetchedAt ?? new Date().toISOString();
          await persistToFirestore(fresh.stations, fresh.readings);
        }
      } catch {
        // Fall back to last valid Firestore records if CPCB API fails
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
      meta: {
        totalStations: combined.length,
        lastUpdated: latestFetchedAt,
        dataStatus: overallStatus,
        source: 'CPCB / data.gov.in via O2CITY',
      },
    });
  } catch {
    res.status(500).json({
      error: 'Unable to load air-quality data right now. Please try again shortly.',
    });
  }
}
