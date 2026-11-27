import { MapPin, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isMapplsConfigured } from '../../config/env';
import {
  loadMapplsSDK,
  type MapplsGlobal,
  type MapplsMapInstance,
  type MapplsMarkerInstance,
} from '../../services/mapplsService';
import type { AQIResponseMeta } from '../../types/aqi';
import type { StationWithAQI } from '../../types/station';
import {
  AQI_CATEGORIES,
  formatPollutantValue,
  formatRelativeTime,
  getAQIMetaByValue,
} from '../../utils/aqi';
import { calculateDistanceKm } from '../../utils/geo';

interface AQIMapProps {
  stations: readonly StationWithAQI[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  selectedStation?: StationWithAQI | null;
  onSelectStation?: (station: StationWithAQI) => void;
  heightClass?: string;
  showLegend?: boolean;
  popupPosition?: 'marker' | 'top-center';
}

const PUNE_FALLBACK = { lat: 18.5204, lng: 73.8567 } as const;
const NEARBY_RADIUS_KM = 50;
const INITIAL_ZOOM = 11;
const MOVE_DEBOUNCE_MS = 400;
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

interface CleanStationPoint {
  station: StationWithAQI;
  lat: number;
  lng: number;
  aqi: number;
}

function getMarkerColor(aqi: number): string {
  if (aqi <= 50) return '#00b050';
  if (aqi <= 100) return '#92d050';
  if (aqi <= 200) return '#ffc000';
  if (aqi <= 300) return '#ff7c00';
  if (aqi <= 400) return '#e53935';
  return '#7e0023';
}

function parseCoordinate(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return parseFloat(raw);
  return NaN;
}

function parseAqiValue(raw: unknown): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === 'string' && raw.trim() === '') return NaN;
  return Number(raw);
}

function extractMapCenter(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lat = Number(raw[0]);
    const lng = Number(raw[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const lat = Number(obj.lat ?? obj.latitude);
    const lng = Number(obj.lng ?? obj.lon ?? obj.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  return null;
}

function removeMarkerInstance(
  mappls: MapplsGlobal | undefined,
  map: MapplsMapInstance | null,
  marker: MapplsMarkerInstance | null
): void {
  if (!marker) return;
  try {
    marker.remove?.();
  } catch {
    // Ignore marker.remove errors
  }
  if (map && mappls?.remove) {
    try {
      mappls.remove({ map, layer: marker });
    } catch {
      // Ignore mappls.remove errors
    }
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPopupHtml(station: StationWithAQI): string {
  const meta = getAQIMetaByValue(station.aqi);
  const aqiText = station.aqi !== null ? String(station.aqi) : '—';
  const catText = station.aqi !== null ? meta.category : 'Unavailable';
  const pm25 = formatPollutantValue(station.pollutants.pm25);
  const pm10 = formatPollutantValue(station.pollutants.pm10);
  const updated = formatRelativeTime(station.sourceTimestamp ?? station.fetchedAt);

  return `
    <div style="font-family:Inter,system-ui,sans-serif;min-width:190px;padding:4px 2px;color:#0f172a;">
      <div style="font-weight:700;font-size:13px;line-height:1.3;">${escapeHtml(station.stationName)}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(station.city)}, ${escapeHtml(station.state)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 8px;border-radius:8px;background:#f8fafc;">
        <span style="font-weight:700;font-size:18px;color:${meta.colorHex};">AQI ${escapeHtml(aqiText)}</span>
        <span style="font-size:12px;font-weight:600;color:#334155;">${escapeHtml(catText)}</span>
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#475569;">
        <span>PM2.5: <strong>${escapeHtml(pm25)}</strong></span>
        <span>PM10: <strong>${escapeHtml(pm10)}</strong></span>
      </div>
      <div style="margin-top:6px;font-size:10px;color:#64748b;">${escapeHtml(updated)}</div>
    </div>
  `;
}

export function AQIMap({
  stations,
  meta: _meta,
  isLoading,
  selectedStation,
  onSelectStation,
  heightClass = 'h-[380px] sm:h-[440px]',
  showLegend = true,
  popupPosition = 'marker',
}: AQIMapProps) {
  const containerId = useId().replace(/:/g, '');
  const mapContainerId = `mappls-${containerId}`;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapplsMapInstance | null>(null);
  const mapReadyRef = useRef(false);
  const pendingGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const markersRef = useRef<MapplsMarkerInstance[]>([]);
  const selectedMarkerRef = useRef<MapplsMarkerInstance | null>(null);
  const onSelectStationRef = useRef(onSelectStation);
  const clickedFromMapRef = useRef<string | null>(null);
  const selectedStationIdRef = useRef<string | null>(selectedStation?.stationId ?? null);
  const hasSelectedStationRef = useRef(Boolean(selectedStation));
  const [activeCenter, setActiveCenter] = useState<{ lat: number; lng: number }>(PUNE_FALLBACK);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activePopupStation, setActivePopupStation] = useState<StationWithAQI | null>(null);
  const mapplsEnabled = isMapplsConfigured();

  const availableStates = useMemo(() => {
    const unique = new Set<string>();
    for (const s of stations) {
      if (s.state) unique.add(s.state);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [stations]);

  const effectiveState = selectedStation?.state ?? availableStates[0] ?? '';

  const availableCities = useMemo(() => {
    const unique = new Set<string>();
    for (const s of stations) {
      if (s.state === effectiveState && s.city) {
        unique.add(s.city);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [stations, effectiveState]);

  const effectiveCity =
    selectedStation?.state === effectiveState &&
    selectedStation?.city &&
    availableCities.includes(selectedStation.city)
      ? selectedStation.city
      : (availableCities[0] ?? '');

  const availableStations = useMemo(() => {
    return stations
      .filter((s) => s.state === effectiveState && s.city === effectiveCity)
      .sort((a, b) => a.stationName.localeCompare(b.stationName));
  }, [stations, effectiveState, effectiveCity]);

  const effectiveStationId =
    selectedStation &&
    selectedStation.state === effectiveState &&
    selectedStation.city === effectiveCity
      ? selectedStation.stationId
      : (availableStations[0]?.stationId ?? '');

  const handleStateChange = (nextState: string) => {
    const stateStations = stations.filter((s) => s.state === nextState);
    if (stateStations.length === 0) return;
    const sortedCities = Array.from(new Set(stateStations.map((s) => s.city))).sort((a, b) =>
      a.localeCompare(b)
    );
    const firstCity = sortedCities[0];
    const cityStations = stateStations.filter((s) => s.city === firstCity);
    const nextStation = cityStations.find((s) => s.aqi !== null) ?? cityStations[0];
    if (nextStation) {
      onSelectStation?.(nextStation);
    }
  };

  const handleCityChange = (nextCity: string) => {
    const cityStations = stations.filter(
      (s) => s.state === effectiveState && s.city === nextCity
    );
    if (cityStations.length === 0) return;
    const nextStation = cityStations.find((s) => s.aqi !== null) ?? cityStations[0];
    if (nextStation) {
      onSelectStation?.(nextStation);
    }
  };

  const handleStationChange = (nextStationId: string) => {
    const match = stations.find((s) => s.stationId === nextStationId);
    if (match) {
      onSelectStation?.(match);
    }
  };

  const handleResetStation = () => {
    const primary =
      availableStations.find((s) => s.aqi !== null) ?? availableStations[0];
    if (primary) {
      onSelectStation?.(primary);
    }
  };

  useEffect(() => {
    onSelectStationRef.current = onSelectStation;
  }, [onSelectStation]);

  useEffect(() => {
    hasSelectedStationRef.current = Boolean(selectedStation);
    selectedStationIdRef.current = selectedStation?.stationId ?? null;
  }, [selectedStation]);

  const applyMapCenter = useCallback(
    (lat: number, lng: number, zoom: number, reason: string) => {
      const cleanLat = Number(lat);
      const cleanLng = Number(lng);
      if (!Number.isFinite(cleanLat) || !Number.isFinite(cleanLng)) return;

      console.log(`[O2CITY Map] Center changed (${reason}):`, {
        lat: cleanLat,
        lng: cleanLng,
        zoom,
      });

      setActiveCenter({ lat: cleanLat, lng: cleanLng });

      const map = mapInstanceRef.current;
      if (map && mapReadyRef.current) {
        map.setCenter({ lat: cleanLat, lng: cleanLng });
        map.setZoom(zoom);
      }
    },
    []
  );

  // Clean and validate station coordinates + AQI once per stations fetch
  const cleanedStations = useMemo<CleanStationPoint[]>(() => {
    const valid: CleanStationPoint[] = [];
    for (const station of stations) {
      const lat = parseCoordinate(station.latitude);
      const lng = parseCoordinate(station.longitude);
      const aqi = parseAqiValue(station.aqi);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !Number.isFinite(aqi) ||
        aqi < 0 ||
        (lat === 0 && lng === 0)
      ) {
        continue;
      }

      valid.push({ station, lat, lng, aqi: Math.round(aqi) });
    }
    return valid;
  }, [stations]);

  // Filter stations within 50 km of active map center using Haversine formula
  const nearbyStations = useMemo<CleanStationPoint[]>(() => {
    return cleanedStations.filter(
      (item) =>
        calculateDistanceKm(activeCenter.lat, activeCenter.lng, item.lat, item.lng) <=
        NEARBY_RADIUS_KM
    );
  }, [cleanedStations, activeCenter]);

  // Initialize Mappls once + request user geolocation + attach debounced move/zoom listeners
  useEffect(() => {
    if (!mapplsEnabled) return;
    let cancelled = false;
    let debounceTimer: number | undefined;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      console.warn('[O2CITY GPS] navigator.geolocation unavailable; using Pune fallback:', PUNE_FALLBACK);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const lat = Number(pos.coords.latitude);
          const lng = Number(pos.coords.longitude);
          console.log('[O2CITY GPS] Initial location acquired:', {
            lat,
            lng,
            accuracy: pos.coords.accuracy,
          });
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || hasSelectedStationRef.current) {
            return;
          }
          if (mapReadyRef.current && mapInstanceRef.current) {
            applyMapCenter(lat, lng, INITIAL_ZOOM, 'gps-init');
          } else {
            pendingGpsRef.current = { lat, lng };
            console.log('[O2CITY GPS] Map not loaded yet; queued GPS center for load event:', { lat, lng });
          }
        },
        (err) => {
          console.warn('[O2CITY GPS] Initial geolocation failed:', {
            code: err.code,
            message: err.message,
            fallback: PUNE_FALLBACK,
          });
        },
        GEOLOCATION_OPTIONS
      );
    }

    loadMapplsSDK()
      .then((mappls) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = new mappls.Map(mapContainerId, {
          center: [PUNE_FALLBACK.lat, PUNE_FALLBACK.lng],
          zoom: INITIAL_ZOOM,
          zoomControl: true,
          location: false,
          search: false,
        });

        mapInstanceRef.current = map;

        const markReady = () => {
          if (cancelled || mapReadyRef.current) return;
          mapReadyRef.current = true;
          setMapReady(true);

          if (pendingGpsRef.current && !hasSelectedStationRef.current) {
            const pending = pendingGpsRef.current;
            pendingGpsRef.current = null;
            applyMapCenter(pending.lat, pending.lng, INITIAL_ZOOM, 'pending-gps-after-load');
          } else {
            console.log('[O2CITY Map] Map loaded at initial center:', PUNE_FALLBACK);
          }
        };

        const markError = () => {
          if (!cancelled) {
            setMapError('Unable to load Mappls map right now.');
          }
        };

        const handleViewportChange = () => {
          if (cancelled) return;
          if (debounceTimer !== undefined) {
            window.clearTimeout(debounceTimer);
          }
          debounceTimer = window.setTimeout(() => {
            if (cancelled || !mapInstanceRef.current || typeof mapInstanceRef.current.getCenter !== 'function') {
              return;
            }
            const nextCenter = extractMapCenter(mapInstanceRef.current.getCenter());
            if (!nextCenter) return;
            setActiveCenter((prev) => {
              const movedEnough =
                Math.abs(prev.lat - nextCenter.lat) > 0.001 ||
                Math.abs(prev.lng - nextCenter.lng) > 0.001;
              if (movedEnough) {
                console.log('[O2CITY Map] Center changed (user pan/zoom):', nextCenter);
                return nextCenter;
              }
              return prev;
            });
          }, MOVE_DEBOUNCE_MS);
        };

        const bindEvent = (event: string, cb: () => void) => {
          if (typeof map.addListener === 'function') {
            map.addListener(event, cb);
          } else if (typeof map.on === 'function') {
            map.on(event, cb);
          }
        };

        if (typeof map.addListener === 'function' || typeof map.on === 'function') {
          bindEvent('load', markReady);
          bindEvent('error', markError);
          bindEvent('moveend', handleViewportChange);
          bindEvent('dragend', handleViewportChange);
          bindEvent('zoomend', handleViewportChange);
          if (typeof map.loaded === 'function' && map.loaded()) {
            markReady();
          }
        } else if (typeof map.loaded === 'function' && map.loaded()) {
          markReady();
        } else {
          markError();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('Unable to load Mappls map right now.');
        }
      });

    return () => {
      cancelled = true;
      if (debounceTimer !== undefined) {
        window.clearTimeout(debounceTimer);
      }
      const currentMap = mapInstanceRef.current;
      const mappls = window.mappls;

      removeMarkerInstance(mappls, currentMap, selectedMarkerRef.current);
      selectedMarkerRef.current = null;

      for (const m of markersRef.current) {
        removeMarkerInstance(mappls, currentMap, m);
      }
      markersRef.current = [];

      try {
        currentMap?.remove?.();
      } catch {
        // Ignore cleanup errors
      }
      mapInstanceRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
  }, [mapplsEnabled, mapContainerId, applyMapCenter]);

  // Render individual round AQI markers for stations within 50 km (no count clusters)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

    for (const m of markersRef.current) {
      removeMarkerInstance(mappls, map, m);
    }
    markersRef.current = [];

    const createdMarkers: MapplsMarkerInstance[] = [];

    for (const item of nearbyStations) {
      const { station, lat, lng, aqi } = item;
      const bgColor = getMarkerColor(aqi);
      const size = 32;

      const isSelectedMarker = selectedStationIdRef.current === station.stationId;
      const markerHtml = `<div data-o2-station-id="${escapeHtml(station.stationId)}" class="${isSelectedMarker ? 'o2-marker-blink' : ''}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};border:2px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,0.32);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:11px;font-family:Inter,system-ui,sans-serif;line-height:1;cursor:pointer;">${aqi}</div>`;

      const marker = new mappls.Marker({
        map,
        position: { lat, lng },
        html: markerHtml,
        width: size,
        height: size,
        popupHtml: popupPosition === 'marker' ? buildPopupHtml(station) : undefined,
        fitbounds: false,
      });

      if (marker.addListener) {
        marker.addListener('click', () => {
          clickedFromMapRef.current = station.stationId;
          if (popupPosition === 'top-center') {
            setActivePopupStation(station);
          }
          onSelectStationRef.current?.(station);
        });
      }

      createdMarkers.push(marker);
    }

    markersRef.current = createdMarkers;
  }, [mapReady, nearbyStations, popupPosition]);

  // Highlight selected station and pan smoothly when selected from outside the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

    if (selectedStation && clickedFromMapRef.current === selectedStation.stationId) {
      // Marker was clicked directly on the map: keep its open popup intact without panning/rebuilding
      clickedFromMapRef.current = null;
      return;
    }

    removeMarkerInstance(mappls, map, selectedMarkerRef.current);
    selectedMarkerRef.current = null;

    if (!selectedStation) return;

    const lat = parseCoordinate(selectedStation.latitude);
    const lng = parseCoordinate(selectedStation.longitude);
    const aqiRaw = parseAqiValue(selectedStation.aqi);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const hasValidAqi = Number.isFinite(aqiRaw) && aqiRaw >= 0;
    const roundedAqi = hasValidAqi ? Math.round(aqiRaw) : null;
    const bgColor = roundedAqi !== null ? getMarkerColor(roundedAqi) : '#64748b';
    const label = roundedAqi !== null ? String(roundedAqi) : '—';
    const size = 36;
    const highlightHtml = `<div data-o2-station-id="${escapeHtml(selectedStation.stationId)}" class="o2-marker-blink" style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};border:3px solid #0f172a;box-shadow:0 0 0 3px #ffffff,0 4px 10px rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:12px;font-family:Inter,system-ui,sans-serif;line-height:1;cursor:pointer;">${label}</div>`;

    const highlightMarker = new mappls.Marker({
      map,
      position: { lat, lng },
      html: highlightHtml,
      width: size,
      height: size,
      popupHtml: popupPosition === 'marker' ? buildPopupHtml(selectedStation) : undefined,
      fitbounds: false,
    });

    if (highlightMarker.addListener) {
      highlightMarker.addListener('click', () => {
        if (popupPosition === 'top-center') {
          setActivePopupStation(selectedStation);
        }
        onSelectStationRef.current?.(selectedStation);
      });
    }

    selectedMarkerRef.current = highlightMarker;

    console.log('[O2CITY Map] Center changed (selectedStation):', {
      lat,
      lng,
      stationName: selectedStation.stationName,
    });
    map.setCenter({ lat, lng });
    map.setZoom(INITIAL_ZOOM);
  }, [mapReady, selectedStation, popupPosition]);

  // Sync blinking indicator on the map marker whose data is currently shown in the card
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!mapReady || !container) return;

    const targetId = selectedStation?.stationId ?? null;
    const nodes = container.querySelectorAll<HTMLElement>('[data-o2-station-id]');
    nodes.forEach((el) => {
      if (targetId && el.dataset.o2StationId === targetId) {
        el.classList.add('o2-marker-blink');
      } else {
        el.classList.remove('o2-marker-blink');
      }
    });
  }, [mapReady, nearbyStations, selectedStation]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/5">
      {/* Map Header */}
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-[11px] font-bold tracking-wider text-slate-900 uppercase">
            Live AQI Monitoring
          </span>
        </div>

        {/* Compact State / City / Station Dropdowns */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:items-center lg:justify-end">
          <div className="flex min-w-0 items-center gap-1.5 lg:w-48">
            <label
              htmlFor={`state-select-${containerId}`}
              className="shrink-0 text-[11px] font-medium text-slate-600"
            >
              State <span className="text-rose-500">*</span>
            </label>
            <select
              id={`state-select-${containerId}`}
              aria-label="Select state"
              value={effectiveState}
              disabled={isLoading || availableStates.length === 0}
              onChange={(e) => handleStateChange(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-800 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {availableStates.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                availableStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 lg:w-44">
            <label
              htmlFor={`city-select-${containerId}`}
              className="shrink-0 text-[11px] font-medium text-slate-600"
            >
              City <span className="text-rose-500">*</span>
            </label>
            <select
              id={`city-select-${containerId}`}
              aria-label="Select city"
              value={effectiveCity}
              disabled={isLoading || availableCities.length === 0}
              onChange={(e) => handleCityChange(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-800 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {availableCities.length === 0 ? (
                <option value="">Loading...</option>
              ) : (
                availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 lg:w-64">
            <label
              htmlFor={`station-select-${containerId}`}
              className="shrink-0 text-[11px] font-medium text-slate-600"
            >
              Station
            </label>
            <div className="relative flex min-w-0 flex-1 items-center">
              <select
                id={`station-select-${containerId}`}
                aria-label="Select station"
                value={effectiveStationId}
                disabled={isLoading || availableStations.length === 0}
                onChange={(e) => handleStationChange(e.target.value)}
                className="h-7 w-full rounded-md border border-slate-200 bg-white pr-6 pl-2 text-[11px] font-medium text-slate-800 shadow-2xs transition-colors focus:border-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                {availableStations.length === 0 ? (
                  <option value="">Loading...</option>
                ) : (
                  availableStations.map((st) => (
                    <option key={st.stationId} value={st.stationId}>
                      {st.stationName}
                    </option>
                  ))
                )}
              </select>
              {availableStations.length > 1 && effectiveStationId && (
                <button
                  type="button"
                  onClick={handleResetStation}
                  title="Reset to primary station"
                  aria-label="Reset to primary station"
                  className="absolute right-5 inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map Viewport */}
      <div className={`relative w-full bg-slate-100 ${heightClass}`}>
        {mapplsEnabled && !mapError ? (
          <>
            <div
              id={`mappls-${containerId}`}
              ref={mapContainerRef}
              className="h-full w-full"
              aria-label="India AQI monitoring stations map"
            />
            {popupPosition === 'top-center' && activePopupStation && (() => {
              const popupMeta = getAQIMetaByValue(activePopupStation.aqi);
              const aqiText =
                activePopupStation.aqi !== null ? String(activePopupStation.aqi) : '—';
              const catText =
                activePopupStation.aqi !== null ? popupMeta.category : 'Unavailable';
              return (
                <div
                  role="dialog"
                  aria-label={`${activePopupStation.stationName} AQI details`}
                  className="absolute top-2.5 left-1/2 z-30 w-[min(92%,260px)] -translate-x-1/2 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-lg shadow-slate-900/15 backdrop-blur-sm"
                >
                  <button
                    type="button"
                    onClick={() => setActivePopupStation(null)}
                    aria-label="Close station card"
                    className="absolute top-2 right-2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <div className="pr-6 text-xs font-bold leading-snug text-slate-900">
                    {activePopupStation.stationName}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {activePopupStation.city}, {activePopupStation.state}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span
                      className="font-mono text-base font-bold"
                      style={{ color: popupMeta.colorHex }}
                    >
                      AQI {aqiText}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{catText}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      PM2.5:{' '}
                      <strong className="text-slate-900">
                        {formatPollutantValue(activePopupStation.pollutants.pm25)}
                      </strong>
                    </span>
                    <span>
                      PM10:{' '}
                      <strong className="text-slate-900">
                        {formatPollutantValue(activePopupStation.pollutants.pm10)}
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })()}
            {(!mapReady || isLoading) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-50/75 backdrop-blur-[1px]">
                <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600 motion-reduce:hidden" />
                  <span>Loading latest air-quality data...</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-sky-50/50 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <MapPin className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            </div>
            <p className="mt-4 font-display text-base font-semibold text-slate-900">
              India AQI Map Ready for Mappls SDK
            </p>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
              {mapError
                ? mapError
                : 'Configure VITE_MAPPLS_MAP_KEY in your environment to render live Mappls vector tiles and real CPCB monitoring station markers across India.'}
            </p>
          </div>
        )}
      </div>

      {/* AQI Legend */}
      {showLegend && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-700">
              {AQI_CATEGORIES.map((item) => (
                <li key={item.category} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.colorHex }}
                    aria-hidden="true"
                  />
                  <span>{item.category}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
