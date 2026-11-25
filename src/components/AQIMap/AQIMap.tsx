import { MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { isMapplsConfigured } from '../../config/env';
import {
  loadMapplsSDK,
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

interface AQIMapProps {
  stations: readonly StationWithAQI[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  selectedStation?: StationWithAQI | null;
  onSelectStation?: (station: StationWithAQI) => void;
  heightClass?: string;
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapplsMapInstance | null>(null);
  const markersRef = useRef<MapplsMarkerInstance[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapplsEnabled = isMapplsConfigured();

  // Initialize Mappls once
  useEffect(() => {
    if (!mapplsEnabled) return;
    let cancelled = false;

    loadMapplsSDK()
      .then((mappls) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = new mappls.Map(mapContainerRef.current, {
          center: [22.5937, 78.9629],
          zoom: 4.5,
          zoomControl: true,
          location: false,
          search: false,
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('Unable to load Mappls map right now.');
        }
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove?.());
      markersRef.current = [];
      mapInstanceRef.current?.remove?.();
      mapInstanceRef.current = null;
    };
  }, [mapplsEnabled]);

  // Update markers efficiently without reinitializing the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

    markersRef.current.forEach((m) => m.remove?.());
    markersRef.current = [];

    const createdMarkers: MapplsMarkerInstance[] = [];

    for (const station of stations) {
      if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) {
        continue;
      }

      const categoryMeta = getAQIMetaByValue(station.aqi);
      const isSelected = selectedStation?.stationId === station.stationId;
      const size = isSelected ? 18 : 13;

      const markerHtml = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${categoryMeta.colorHex};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,0.35);cursor:pointer;"></div>`;

      const marker = new mappls.Marker({
        map,
        position: { lat: station.latitude, lng: station.longitude },
        html: markerHtml,
        width: size,
        height: size,
        popupHtml: buildPopupHtml(station),
      });

      if (onSelectStation && marker.addListener) {
        marker.addListener('click', () => onSelectStation(station));
      }

      createdMarkers.push(marker);
    }

    if (createdMarkers.length > 0 && mappls.markerCluster) {
      mappls.markerCluster({ map, markers: createdMarkers });
    }

    markersRef.current = createdMarkers;
  }, [mapReady, stations, selectedStation, onSelectStation]);

  // Smoothly pan to selected station
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || !selectedStation) return;
    if (
      Number.isFinite(selectedStation.latitude) &&
      Number.isFinite(selectedStation.longitude)
    ) {
      map.setCenter([selectedStation.latitude, selectedStation.longitude]);
      map.setZoom(10);
    }
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
