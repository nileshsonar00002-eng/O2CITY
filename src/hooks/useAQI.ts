import { useCallback, useEffect, useMemo, useState } from 'react';
import { aggregateCities, fetchLatestAQI } from '../services/aqiService';
import type { AQIResponseMeta } from '../types/aqi';
import type { CitySummary, StationWithAQI } from '../types/station';

interface UseAQIResult {
  stations: StationWithAQI[];
  cities: CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const INITIAL_META: AQIResponseMeta = {
  totalStations: 0,
  lastUpdated: null,
  dataStatus: 'unavailable',
  source: 'CPCB / data.gov.in',
};

export function useAQI(): UseAQIResult {
  const [stations, setStations] = useState<StationWithAQI[]>([]);
  const [meta, setMeta] = useState<AQIResponseMeta>(INITIAL_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchLatestAQI();
      setStations(response.stations);
      setMeta(response.meta);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchLatestAQI();
        if (!cancelled) {
          setStations(response.stations);
          setMeta(response.meta);
        }
      } catch {
        if (!cancelled) {
          setError('Something went wrong. Please try again.');
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
  }, []);

  const cities = useMemo(() => aggregateCities(stations), [stations]);

  return {
    stations,
    cities,
    meta,
    isLoading,
    error,
    refresh: load,
  };
}
