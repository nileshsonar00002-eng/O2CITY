import type { CompactWeatherData } from '../types/weather';

const CLIENT_CACHE_TTL_MS = 10 * 60_000;

interface CachedWeatherEntry {
  data: CompactWeatherData;
  cachedAt: number;
}

const weatherCache = new Map<string, CachedWeatherEntry>();

function buildCoordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function fetchCompactWeather(
  lat: number,
  lon: number
): Promise<CompactWeatherData> {
  const key = buildCoordKey(lat, lon);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CLIENT_CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
  });

  const response = await fetch(`/api/weather?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }

  const payload = (await response.json()) as { weather?: CompactWeatherData };
  if (!payload.weather || typeof payload.weather.tempC !== 'number') {
    throw new Error('Weather response missing payload');
  }

  weatherCache.set(key, {
    data: payload.weather,
    cachedAt: Date.now(),
  });

  return payload.weather;
}
