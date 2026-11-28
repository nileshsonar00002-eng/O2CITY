import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';

interface HistoryBucketRow {
  station_id: string;
  bucket_at: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
}

interface StationMetaRow {
  station_id: string;
  city: string;
  state: string;
}

interface HourlyPollutantTotals {
  pm25Sum: number;
  pm25Count: number;
  pm10Sum: number;
  pm10Count: number;
  no2Sum: number;
  no2Count: number;
  so2Sum: number;
  so2Count: number;
  coSum: number;
  coCount: number;
  o3Sum: number;
  o3Count: number;
}

function roundAvg(sum: number, count: number, decimals = 0): number | null {
  if (count <= 0) return null;
  const val = sum / count;
  if (decimals === 0) return Math.round(val);
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    res.status(200).json({
      hourlyTrend: [],
      stateDeltas: {},
      cityDeltas: {},
      meta: { bucketCount: 0, earliestBucketAt: null, latestBucketAt: null },
    });
    return;
  }

  try {
    const sinceIso = new Date(Date.now() - 24 * 3_600_000).toISOString();

    const [historyResult, stationsResult] = await Promise.all([
      supabase
        .from('aqi_history')
        .select('station_id, bucket_at, aqi, pm25, pm10, no2, so2, co, o3')
        .gte('bucket_at', sinceIso)
        .order('bucket_at', { ascending: true })
        .limit(15000),
      supabase
        .from('stations')
        .select('station_id, city, state')
        .eq('active', true)
        .limit(2000),
    ]);

    if (historyResult.error) throw historyResult.error;
    if (stationsResult.error) throw stationsResult.error;

    const historyRows = (historyResult.data ?? []) as HistoryBucketRow[];
    const stationMetaMap = new Map<string, { city: string; state: string }>();
    for (const st of (stationsResult.data ?? []) as StationMetaRow[]) {
      stationMetaMap.set(st.station_id, { city: st.city, state: st.state });
    }

    // Group rows by UTC hour bucket_at
    const bucketMap = new Map<string, HistoryBucketRow[]>();
    for (const row of historyRows) {
      const list = bucketMap.get(row.bucket_at) ?? [];
      list.push(row);
      bucketMap.set(row.bucket_at, list);
    }

    const sortedBuckets = Array.from(bucketMap.keys()).sort();
    const recentBuckets = sortedBuckets.slice(-12);

    const hourlyTrend = recentBuckets.map((bucketAt) => {
      const rows = bucketMap.get(bucketAt) ?? [];
      let aqiSum = 0;
      let aqiCount = 0;
      const p: HourlyPollutantTotals = {
        pm25Sum: 0,
        pm25Count: 0,
        pm10Sum: 0,
        pm10Count: 0,
        no2Sum: 0,
        no2Count: 0,
        so2Sum: 0,
        so2Count: 0,
        coSum: 0,
        coCount: 0,
        o3Sum: 0,
        o3Count: 0,
      };

      for (const r of rows) {
        if (r.aqi !== null && Number.isFinite(r.aqi)) {
          aqiSum += r.aqi;
          aqiCount += 1;
        }
        if (r.pm25 !== null && Number.isFinite(r.pm25)) {
          p.pm25Sum += r.pm25;
          p.pm25Count += 1;
        }
        if (r.pm10 !== null && Number.isFinite(r.pm10)) {
          p.pm10Sum += r.pm10;
          p.pm10Count += 1;
        }
        if (r.no2 !== null && Number.isFinite(r.no2)) {
          p.no2Sum += r.no2;
          p.no2Count += 1;
        }
        if (r.so2 !== null && Number.isFinite(r.so2)) {
          p.so2Sum += r.so2;
          p.so2Count += 1;
        }
        if (r.co !== null && Number.isFinite(r.co)) {
          p.coSum += r.co;
          p.coCount += 1;
        }
        if (r.o3 !== null && Number.isFinite(r.o3)) {
          p.o3Sum += r.o3;
          p.o3Count += 1;
        }
      }

      return {
        bucketAt,
        stationCount: aqiCount,
        avgAqi: roundAvg(aqiSum, aqiCount, 0),
        pollutants: {
          pm25: roundAvg(p.pm25Sum, p.pm25Count, 1),
          pm10: roundAvg(p.pm10Sum, p.pm10Count, 1),
          no2: roundAvg(p.no2Sum, p.no2Count, 1),
          so2: roundAvg(p.so2Sum, p.so2Count, 1),
          co: roundAvg(p.coSum, p.coCount, 2),
          o3: roundAvg(p.o3Sum, p.o3Count, 1),
        },
      };
    });

    // Compute state & city deltas comparing earliest vs latest available bucket
    const stateDeltas: Record<
      string,
      { previousAvgAqi: number; currentAvgAqi: number; changePct: number }
    > = {};
    const cityDeltas: Record<
      string,
      { previousAvgAqi: number; currentAvgAqi: number; changePct: number }
    > = {};

    if (recentBuckets.length >= 2) {
      const earliestKey = recentBuckets[0]!;
      const latestKey = recentBuckets[recentBuckets.length - 1]!;
      const earliestRows = bucketMap.get(earliestKey) ?? [];
      const latestRows = bucketMap.get(latestKey) ?? [];

      const aggregateByKey = (
        rows: HistoryBucketRow[],
        keyFn: (meta: { city: string; state: string }) => string
      ) => {
        const acc = new Map<string, { sum: number; count: number }>();
        for (const r of rows) {
          if (r.aqi === null || !Number.isFinite(r.aqi)) continue;
          const stMeta = stationMetaMap.get(r.station_id);
          if (!stMeta) continue;
          const key = keyFn(stMeta);
          const cur = acc.get(key) ?? { sum: 0, count: 0 };
          cur.sum += r.aqi;
          cur.count += 1;
          acc.set(key, cur);
        }
        return acc;
      };

      const prevStates = aggregateByKey(earliestRows, (m) => m.state);
      const currStates = aggregateByKey(latestRows, (m) => m.state);
      for (const [state, curr] of currStates.entries()) {
        const prev = prevStates.get(state);
        if (!prev || prev.count === 0 || curr.count === 0) continue;
        const prevAvg = Math.round(prev.sum / prev.count);
        const currAvg = Math.round(curr.sum / curr.count);
        if (prevAvg <= 0) continue;
        stateDeltas[state] = {
          previousAvgAqi: prevAvg,
          currentAvgAqi: currAvg,
          changePct: Math.round(((currAvg - prevAvg) / prevAvg) * 100),
        };
      }

      const prevCities = aggregateByKey(
        earliestRows,
        (m) => `${m.city.toLowerCase()}__${m.state.toLowerCase()}`
      );
      const currCities = aggregateByKey(
        latestRows,
        (m) => `${m.city.toLowerCase()}__${m.state.toLowerCase()}`
      );
      for (const [cityKey, curr] of currCities.entries()) {
        const prev = prevCities.get(cityKey);
        if (!prev || prev.count === 0 || curr.count === 0) continue;
        const prevAvg = Math.round(prev.sum / prev.count);
        const currAvg = Math.round(curr.sum / curr.count);
        if (prevAvg <= 0) continue;
        cityDeltas[cityKey] = {
          previousAvgAqi: prevAvg,
          currentAvgAqi: currAvg,
          changePct: Math.round(((currAvg - prevAvg) / prevAvg) * 100),
        };
      }
    }

    res.status(200).json({
      hourlyTrend,
      stateDeltas,
      cityDeltas,
      meta: {
        bucketCount: recentBuckets.length,
        earliestBucketAt: recentBuckets[0] ?? null,
        latestBucketAt: recentBuckets[recentBuckets.length - 1] ?? null,
      },
    });
  } catch {
    res.status(500).json({ error: 'Unable to aggregate analytics summary.' });
  }
}
