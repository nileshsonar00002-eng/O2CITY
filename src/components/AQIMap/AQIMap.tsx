import { MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { isMapplsConfigured } from '../../config/env';
import {
  loadMapplsSDK,
  type MapplsGeoJsonFeature,
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

function removeMapLayer(
  mappls: MapplsGlobal | undefined,
  map: MapplsMapInstance | null,
  layer: MapplsMarkerInstance | null
): void {
  if (!layer || !map || !mappls?.remove) return;
  try {
    mappls.remove({ map, layer });
  } catch {
    // Ignore cleanup errors during map teardown or layer refresh
  }
}

function createCategoryIconDataUrl(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="${colorHex}" stroke="#ffffff" stroke-width="2.5"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  const bulkMarkerLayerRef = useRef<MapplsMarkerInstance | null>(null);
  const selectedMarkerRef = useRef<MapplsMarkerInstance | null>(null);
  const stationsByIdRef = useRef<Map<string, StationWithAQI>>(new Map());
  const onSelectStationRef = useRef(onSelectStation);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapplsEnabled = isMapplsConfigured();

  useEffect(() => {
    onSelectStationRef.current = onSelectStation;
  }, [onSelectStation]);

  useEffect(() => {
    const mapById = new Map<string, StationWithAQI>();
    for (const s of stations) {
      mapById.set(s.stationId, s);
    }
    stationsByIdRef.current = mapById;
  }, [stations]);

  // Initialize Mappls once and wait for genuine map load event
  useEffect(() => {
    if (!mapplsEnabled) return;
    let cancelled = false;

    loadMapplsSDK()
      .then((mappls) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = new mappls.Map(mapContainerId, {
          center: [22.5937, 78.9629],
          zoom: 4.5,
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

        if (typeof map.addListener === 'function') {
          map.addListener('load', markReady);
          map.addListener('error', markError);
          if (typeof map.loaded === 'function' && map.loaded()) {
            markReady();
          }
        } else if (typeof map.on === 'function') {
          map.on('load', markReady);
          map.on('error', markError);
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
      const currentMap = mapInstanceRef.current;
      const mappls = window.mappls;

      removeMapLayer(mappls, currentMap, selectedMarkerRef.current);
      selectedMarkerRef.current = null;

      removeMapLayer(mappls, currentMap, bulkMarkerLayerRef.current);
      bulkMarkerLayerRef.current = null;

      try {
        currentMap?.remove?.();
      } catch {
        // Ignore cleanup errors
      }
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [mapplsEnabled, mapContainerId]);

  // Render unified GeoJSON bulk clustered markers (never rebuilt on selectedStation change)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

    removeMapLayer(mappls, map, bulkMarkerLayerRef.current);
    bulkMarkerLayerRef.current = null;

    const features: MapplsGeoJsonFeature[] = [];

    for (const station of stations) {
      if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) {
        continue;
      }

      const categoryMeta = getAQIMetaByValue(station.aqi);
      features.push({
        type: 'Feature',
        properties: {
          stationId: station.stationId,
          icon: createCategoryIconDataUrl(categoryMeta.colorHex),
          htmlPopup: buildPopupHtml(station),
          colorHex: categoryMeta.colorHex,
        },
        geometry: {
          type: 'Point',
          coordinates: [station.longitude, station.latitude],
        },
      });
    }

    if (features.length === 0) return;

    const layer = new mappls.Marker({
      map,
      position: {
        type: 'FeatureCollection',
        features,
      },
      cType: 1,
      clusters: true,
      clustersOptions: {
        background: [
          [2, '#10b981'],
          [10, '#eab308'],
          [25, '#f97316'],
          [50, '#ef4444'],
        ],
        radius: [
          [2, 16],
          [10, 20],
          [25, 26],
          [50, 32],
        ],
        maxZoom: 10,
      },
    });

    if (layer.addListener) {
      layer.addListener('click', (eventData: unknown) => {
        const payload = eventData as {
          properties?: { stationId?: string };
          features?: Array<{ properties?: { stationId?: string } }>;
        } | null;
        const clickedId =
          payload?.properties?.stationId ?? payload?.features?.[0]?.properties?.stationId;
        if (clickedId) {
          const matched = stationsByIdRef.current.get(clickedId);
          if (matched) {
            onSelectStationRef.current?.(matched);
          }
        }
      });
    }

    bulkMarkerLayerRef.current = layer;
  }, [mapReady, stations]);

  // Highlight selected station and pan smoothly without rebuilding bulk station markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const mappls = window.mappls;
    if (!mapReady || !map || !mappls) return;

    removeMapLayer(mappls, map, selectedMarkerRef.current);
    selectedMarkerRef.current = null;

    if (
      !selectedStation ||
      !Number.isFinite(selectedStation.latitude) ||
      !Number.isFinite(selectedStation.longitude)
    ) {
      return;
    }

    const categoryMeta = getAQIMetaByValue(selectedStation.aqi);
    const size = 20;
    const highlightHtml = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${categoryMeta.colorHex};border:3px solid #0f172a;box-shadow:0 0 0 3px #ffffff,0 4px 10px rgba(15,23,42,0.4);cursor:pointer;"></div>`;

    const highlightMarker = new mappls.Marker({
      map,
      position: { lat: selectedStation.latitude, lng: selectedStation.longitude },
      html: highlightHtml,
      width: size,
      height: size,
      popupHtml: buildPopupHtml(selectedStation),
    });

    if (highlightMarker.addListener) {
      highlightMarker.addListener('click', () => onSelectStationRef.current?.(selectedStation));
    }

    selectedMarkerRef.current = highlightMarker;

    map.setCenter([selectedStation.latitude, selectedStation.longitude]);
    map.setZoom(10);
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
