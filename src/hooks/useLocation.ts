import { useCallback, useState } from 'react';
import type { NearestStationResult, StationWithAQI } from '../types/station';
import { findNearestStation } from '../utils/geo';

export type LocationStatus = 'idle' | 'locating' | 'found' | 'denied' | 'error';

interface UseLocationResult {
  status: LocationStatus;
  nearest: NearestStationResult | null;
  message: string | null;
  detectLocation: (stations: readonly StationWithAQI[]) => void;
  resetLocation: () => void;
}

export function useLocation(): UseLocationResult {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [nearest, setNearest] = useState<NearestStationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const detectLocation = useCallback((stations: readonly StationWithAQI[]) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('error');
      setMessage('Location detection is not supported in this browser. Search your city instead.');
      return;
    }

    setStatus('locating');
    setMessage('Finding your nearest monitoring station...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const match = findNearestStation(latitude, longitude, stations);

        if (!match) {
          setStatus('error');
          setNearest(null);
          setMessage('No active monitoring stations are available right now.');
          return;
        }

        setNearest(match);
        setStatus('found');
        setMessage(null);
      },
      (geoError) => {
        setNearest(null);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('denied');
          setMessage("Location access wasn't provided. Search your city instead.");
        } else {
          setStatus('error');
          setMessage('Unable to detect your location right now. Search your city instead.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 300_000,
      }
    );
  }, []);

  const resetLocation = useCallback(() => {
    setStatus('idle');
    setNearest(null);
    setMessage(null);
  }, []);

  return {
    status,
    nearest,
    message,
    detectLocation,
    resetLocation,
  };
}
