import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { collection, getDocs, getFirestore, query, where, type Firestore } from 'firebase/firestore';
import { isFirebaseConfigured, publicConfig } from '../config/env';
import type { AQIReading } from '../types/aqi';
import type { MonitoringStation, StationWithAQI } from '../types/station';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseDb(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!appInstance) {
    const existing = getApps();
    appInstance = existing.length > 0 ? existing[0]! : initializeApp(publicConfig.firebase);
  }

  if (!dbInstance) {
    dbInstance = getFirestore(appInstance);
  }

  return dbInstance;
}

/**
 * Direct Firestore read fallback for latest stations.
 * Reads only `stations` (active) and `aqi_latest` — never `aqi_history`.
 */
export async function fetchLatestFromFirestore(): Promise<{
  stations: StationWithAQI[];
  lastUpdated: string | null;
}> {
  const db = getFirebaseDb();
  if (!db) {
    return { stations: [], lastUpdated: null };
  }

  const [stationsSnap, latestSnap] = await Promise.all([
    getDocs(query(collection(db, 'stations'), where('active', '==', true))),
    getDocs(collection(db, 'aqi_latest')),
  ]);

  const readingsMap = new Map<string, AQIReading>();
  let lastUpdated: string | null = null;

  latestSnap.forEach((doc) => {
    const data = doc.data() as AQIReading;
    readingsMap.set(data.stationId, data);
    if (!lastUpdated || (data.fetchedAt && data.fetchedAt > lastUpdated)) {
      lastUpdated = data.fetchedAt;
    }
  });

  const stations: StationWithAQI[] = [];
  stationsSnap.forEach((doc) => {
    const st = doc.data() as MonitoringStation;
    const reading = readingsMap.get(st.stationId);
    stations.push({
      ...st,
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
    });
  });

  return { stations, lastUpdated };
}
