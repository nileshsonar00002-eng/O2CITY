import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCompactWeather, WeatherAPIError } from './_lib/weather.js';

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const lat = parseCoordinate(req.query.lat, -90, 90);
  const lon = parseCoordinate(req.query.lon, -180, 180);

  if (lat === null || lon === null) {
    res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
    return;
  }

  try {
    const weather = await fetchCompactWeather(lat, lon);
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.status(200).json({ weather });
  } catch (err) {
    if (err instanceof WeatherAPIError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    res.status(500).json({
      error: 'Unable to fetch weather data right now.',
      code: 'WEATHER_INTERNAL_ERROR',
    });
  }
}
