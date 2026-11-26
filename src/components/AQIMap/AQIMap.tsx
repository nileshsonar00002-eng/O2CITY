import { MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
}

const PUNE_FALLBACK = { lat: 18.5204, lng: 73.8567 } as const;
const NEARBY_RADIUS_KM = 50;
const INITIAL_ZOOM = 11;
const MOVE_DEBOUNCE_MS = 400;

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
  meta,
  isLoading,
  selectedStation,
  onSelectStation,
  heightClass = 'h-[380px] sm:h-[440px]',
}: AQIMapProps) {
  const containerId = useId().replace(/:/g, '');
  const mapContainerId = `mappls-${containerId}`;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapplsMapInstance | null>(null);
  const markersRef = useRef<MapplsMarkerInstance[]>([]);
  const selectedMarkerRef = useRef<MapplsMarkerInstance | null>(null);
  const onSelectStationRef = useRef(onSelectStation);
  const hasSelectedStationRef = useRef(Boolean(selectedStation));
  const [activeCenter, setActiveCenter] = useState<{ lat: number; lng: number }>(PUNE_FALLBACK);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapplsEnabled = isMapplsConfigured();

  useEffect(() => {
    onSelectStationRef.current = onSelectStation;
  }, [onSelectStation]);

  useEffect(() => {
    hasSelectedStationRef.current = Boolean(selectedStation);
  }, [selectedStation]);

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

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || hasSelectedStationRef.current) return;
          const lat = Number(pos.coords.latitude);
          const lng = Number(pos.coords.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          setActiveCenter({ lat, lng });
          const map = mapInstanceRef.current;
          if (map) {
            map.setCenter([lat, lng]);
            map.setZoom(INITIAL_ZOOM);
          }
        },
        () => {
          // Permission denied or unavailable -> keep Pune fallback center
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
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
          if (!cancelled) {
            setMapReady(true);
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
              return movedEnough ? nextCenter : prev;
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
      setMapReady(false);
    };
  }, [mapplsEnabled, mapContainerId]);

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

      const markerHtml = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};border:2px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,0.32);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:11px;font-family:Inter,system-ui,sans-serif;line-height:1;cursor:pointer;">${aqi}</div>`;

      const marker = new mappls.Marker({
        map,
        position: { lat, lng },
        html: markerHtml,
        width: size,
        height: size,
        popupHtml: buildPopupHtml(station),
      });

      if (marker.addListener) {
        marker.addListener('click', () => onSelectStationRef.current?.(station));
      }

      createdMarkers.push(marker);
    }

    markersRef.current = createdMarkers;
  }, [mapReady, nearbyStations]);

  // Highlight selected station and pan smoothly
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

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
    const highlightHtml = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};border:3px solid #0f172a;box-shadow:0 0 0 3px #ffffff,0 4px 10px rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:800;font-size:12px;font-family:Inter,system-ui,sans-serif;line-height:1;cursor:pointer;">${label}</div>`;

    const highlightMarker = new mappls.Marker({
      map,
      position: { lat, lng },
      html: highlightHtml,
      width: size,
      height: size,
      popupHtml: buildPopupHtml(selectedStation),
    });

    if (highlightMarker.addListener) {
      highlightMarker.addListener('click', () => onSelectStationRef.current?.(selectedStation));
    }

    selectedMarkerRef.current = highlightMarker;

    map.setCenter([lat, lng]);
    map.setZoom(INITIAL_ZOOM);
  }, [mapReady, selectedStation]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/5">
      {/* Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-xs font-bold tracking-wider text-slate-900 uppercase">
            Live AQI Monitoring
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {isLoading ? 'Loading stations...' : `${meta.totalStations} monitoring stations`}
          </span>
          <span>{formatRelativeTime(meta.lastUpdated)}</span>
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
    </div>
  );
}
