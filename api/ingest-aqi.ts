import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCPCBData } from './_lib/cpcb.js';
import { getFirebaseAdminDb } from './_lib/firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const cronSecret = process.env.INGEST_CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization ?? '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    const db = getFirebaseAdminDb();
    if (!db) {
      res.status(503).json({ error: 'Firestore Admin is not configured' });
      return;
    }

    const { stations, readings } = await fetchCPCBData();
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

    res.status(200).json({
      ok: true,
      stationsIngested: stations.length,
      readingsIngested: readings.length,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Ingestion failed. Check server configuration.' });
  }
}
