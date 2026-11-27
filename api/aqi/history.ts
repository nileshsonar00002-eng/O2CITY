import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';

const STATION_ID_REGEX = /^[a-z0-9-]{2,100}$/;

interface AqiHistoryRow {
  id: number;
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
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      res.status(200).json({ stationId, history: [] });
      return;
    }

    const { data, error } = await supabase
      .from('aqi_history')
      .select(
        'id, station_id, bucket_at, aqi, aqi_category, pm25, pm10, no2, so2, co, o3, nh3, source_timestamp, fetched_at'
      )
      .eq('station_id', stationId)
      .order('bucket_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const history = ((data ?? []) as AqiHistoryRow[])
      .map((row) => ({
        id: String(row.id),
        stationId: row.station_id,
        bucketAt: row.bucket_at,
        aqi: row.aqi,
        aqiCategory: row.aqi_category,
        pm25: row.pm25,
        pm10: row.pm10,
        no2: row.no2,
        so2: row.so2,
        co: row.co,
        o3: row.o3,
        nh3: row.nh3,
        sourceTimestamp: row.source_timestamp,
        fetchedAt: row.fetched_at,
      }))
      .reverse();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ stationId, history });
  } catch {
    res.status(500).json({ error: 'Unable to fetch historical readings.' });
  }
}
