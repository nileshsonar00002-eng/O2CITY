import type { NearestStationResult, StationWithAQI } from '../types/station';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Finds the nearest monitoring station to a given coordinate.
 * Prefers stations with valid AQI readings when distances are nearly identical.
 */
export function findNearestStation(
  latitude: number,
  longitude: number,
  stations: readonly StationWithAQI[]
): NearestStationResult | null {
  if (stations.length === 0) return null;

  let best: NearestStationResult | null = null;

  for (const station of stations) {
    if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) {
      continue;
    }
    const distanceKm = calculateDistanceKm(
      latitude,
      longitude,
      station.latitude,
      station.longitude
    );

    if (
      !best ||
      distanceKm < best.distanceKm ||
      (Math.abs(distanceKm - best.distanceKm) < 1 &&
        best.station.aqi === null &&
        station.aqi !== null)
    ) {
      best = { station, distanceKm };
    }
  }

  return best;
}
