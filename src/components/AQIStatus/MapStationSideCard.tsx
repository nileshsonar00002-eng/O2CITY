import { MapPin, Wind, X } from 'lucide-react';
import type { AQIHistoryPoint } from '../../types/aqi';
import type { StationWithAQI } from '../../types/station';
import {
  formatPollutantValue,
  formatRelativeTime,
  getAQIMetaByValue,
} from '../../utils/aqi';

interface MapStationSideCardProps {
  station: StationWithAQI;
  history: readonly AQIHistoryPoint[];
  loadingHistory: boolean;
  onClose: () => void;
}

const SCALE_SEGMENTS = [
  { label: '0', color: '#00b050' },
  { label: '50', color: '#92d050' },
  { label: '100', color: '#ffc000' },
  { label: '200', color: '#ff7c00' },
  { label: '300', color: '#e53935' },
  { label: '401+', color: '#7e0023' },
] as const;

function getPollutantPercent(value: number | null, maxRef: number): number {
  if (value === null || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, Math.max(8, (value / maxRef) * 100));
}

function formatTrendTime(ts: string | null): string {
  if (!ts) return '';
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return ts;
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function TrendSparkline({ history }: { history: readonly AQIHistoryPoint[] }) {
  const validPoints = history.filter((p) => typeof p.aqi === 'number' && Number.isFinite(p.aqi));
  if (validPoints.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg bg-slate-50/80 px-3 text-center text-[11px] text-slate-500">
        {validPoints.length === 1
          ? `Latest snapshot: ${validPoints[0]!.aqi} AQI (more points will appear hourly)`
          : 'Historical trend will appear as hourly snapshots accumulate.'}
      </div>
    );
  }

  const values = validPoints.map((p) => p.aqi as number);
  const minVal = Math.max(0, Math.min(...values) - 20);
  const maxVal = Math.max(...values, minVal + 40);
  const width = 240;
  const height = 68;
  const padX = 6;
  const padY = 8;

  const coords = validPoints.map((p, idx) => {
    const x = padX + (idx / (validPoints.length - 1)) * (width - padX * 2);
    const ratio = ((p.aqi as number) - minVal) / (maxVal - minVal);
    const y = height - padY - ratio * (height - padY * 2);
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const firstLabel = formatTrendTime(validPoints[0]!.sourceTimestamp ?? validPoints[0]!.fetchedAt);
  const lastLabel = formatTrendTime(
    validPoints[validPoints.length - 1]!.sourceTimestamp ??
      validPoints[validPoints.length - 1]!.fetchedAt
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-18 w-full overflow-visible"
        role="img"
        aria-label="AQI trend over recent hours"
      >
        <defs>
          <linearGradient id="map-trend-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e53935" />
            <stop offset="55%" stopColor="#ff7c00" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>

        {/* Subtle vertical & horizontal guide lines */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={padX}
            y1={padY + r * (height - padY * 2)}
            x2={width - padX}
            y2={padY + r * (height - padY * 2)}
            stroke="#e2e8f0"
            strokeWidth="0.75"
          />
        ))}

        <polyline
          fill="none"
          stroke="url(#map-trend-stroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
      </svg>
      <div className="mt-0.5 flex items-center justify-between text-[10px] font-medium text-slate-500">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

export function MapStationSideCard({
  station,
  history,
  loadingHistory,
  onClose,
}: MapStationSideCardProps) {
  const meta = getAQIMetaByValue(station.aqi);

  const pollutantRows = [
    { label: 'PM2.5', value: station.pollutants.pm25, maxRef: 250, unit: 'µg/m³' as const },
    { label: 'PM10', value: station.pollutants.pm10, maxRef: 430, unit: 'µg/m³' as const },
    { label: 'NO₂', value: station.pollutants.no2, maxRef: 200, unit: 'µg/m³' as const },
    { label: 'O₃', value: station.pollutants.o3, maxRef: 180, unit: 'µg/m³' as const },
  ];

  return (
    <aside
      aria-label="Selected station air quality details"
      className="mt-4 flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 lg:absolute lg:top-16 lg:bottom-3 lg:left-3 lg:z-20 lg:mt-0 lg:w-[300px]"
      style={{
        backgroundImage: `linear-gradient(180deg, #ffffff 22%, ${meta.colorHex}73 55%, ${meta.colorHex}cc 100%)`,
      }}
    >
      <div className="flex-1 overflow-y-auto p-3.5">
        {/* Top Brand + Close Button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-extrabold tracking-tight text-sky-600">
              AQI
            </span>
            <span className="font-display text-xs font-bold text-slate-900">
              Air Quality Map
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close station card"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Station Location */}
        <div className="mt-2">
          <p className="flex items-start gap-1 text-xs font-bold text-sky-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="leading-snug">{station.stationName}</span>
          </p>
          <p className="mt-0.5 pl-4.5 text-[11px] text-slate-500">
            {station.city}, {station.state}, India
          </p>
        </div>

        {/* Big AQI Score + Badge */}
        <div className="mt-3">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Wind className="h-3 w-3 text-slate-400" aria-hidden="true" />
            <span>Air Quality Index</span>
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span
              className="font-mono text-4xl leading-none font-extrabold tracking-tight tabular-nums"
              style={{ color: meta.colorHex }}
            >
              {station.aqi ?? '—'}
            </span>
            <span
              className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: meta.colorHex }}
            >
              {meta.category}
            </span>
          </div>
        </div>

        {/* Pollutants Mini Table */}
        <div className="mt-3 divide-y divide-slate-200/70 rounded-xl border border-white/80 bg-white/80 px-3 py-1 backdrop-blur-sm">
          {pollutantRows.map((row) => {
            const pct = getPollutantPercent(row.value, row.maxRef);
            return (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 py-2 text-xs"
              >
                <span className="w-12 font-medium text-slate-600">{row.label}</span>
                <span className="font-mono text-[11px] font-bold text-slate-900 tabular-nums">
                  {formatPollutantValue(row.value, row.unit)}
                </span>
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: meta.colorHex,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* AQI Trend */}
        <div className="mt-3 rounded-xl border border-white/80 bg-white/80 p-2.5 backdrop-blur-sm">
          <p className="mb-1.5 text-[11px] font-semibold text-slate-800">
            AQI Trend Last 24 hour
          </p>
          {loadingHistory ? (
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <TrendSparkline history={history} />
          )}
        </div>

        <p className="mt-2.5 text-center text-[10px] font-semibold text-slate-900">
          {formatRelativeTime(station.sourceTimestamp ?? station.fetchedAt)}
        </p>
      </div>

      {/* Bottom 6-Color AQI Scale Strip */}
      <div className="grid grid-cols-6 text-center text-[9px] font-bold text-white">
        {SCALE_SEGMENTS.map((seg) => (
          <div
            key={seg.label}
            className="py-1"
            style={{ backgroundColor: seg.color }}
          >
            {seg.label}
          </div>
        ))}
      </div>
    </aside>
  );
}
