import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseAdminDb } from '../_lib/firebaseAdmin.js';

const STATION_ID_REGEX = /^[a-z0-9-]{2,100}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId.trim() : '';
  if (!STATION_ID_REGEX.test(stationId)) {
    res.status(400).json({ error: 'Invalid stationId parameter' });
    return;
  }

  const rawLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 24;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 72) : 24;

  try {
    const db = getFirebaseAdminDb();
    if (!db) {
      res.status(200).json({ stationId, history: [] });
      return;
    }

    const snap = await db
      .collection('aqi_history')
      .where('stationId', '==', stationId)
      .orderBy('sourceTimestamp', 'desc')
      .limit(limit)
      .get();

    const history = snap.docs.map((doc) => doc.data()).reverse();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ stationId, history });
  } catch {
    res.status(500).json({ error: 'Unable to fetch historical readings.' });
  }
}
