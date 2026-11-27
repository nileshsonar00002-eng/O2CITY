import { useEffect, useState } from 'react';
import { fetchCompactWeather } from '../services/weatherService';
import type { CompactWeatherData } from '../types/weather';

interface UseWeatherResult {
  weather: CompactWeatherData | null;
  isLoading: boolean;
  error: string | null;
}

export function useWeather(
  lat: number | null,
  lon: number | null,
  enabled: boolean
): UseWeatherResult {
  const [weather, setWeather] = useState<CompactWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchCompactWeather(lat, lon);
        if (!cancelled) {
          setWeather(data);
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
          setError('Weather unavailable right now.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lon, enabled]);

  return { weather, isLoading, error };
}
