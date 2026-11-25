import { AlertTriangle, Clock, MapPin, Wind } from 'lucide-react';
import type { StationWithAQI } from '../../types/station';
import {
  formatPollutantValue,
  formatRelativeTime,
  getAQIMetaByValue,
  isDataDelayed,
} from '../../utils/aqi';

interface AQIStatusCardProps {
  station: StationWithAQI;
  distanceKm?: number | null;
  subtitle?: string;
}

export function AQIStatusCard({ station, distanceKm, subtitle }: AQIStatusCardProps) {
  const meta = getAQIMetaByValue(station.aqi);
  const timestamp = station.sourceTimestamp ?? station.fetchedAt;
  const delayed =
    station.dataStatus === 'delayed' || (timestamp ? isDataDelayed(timestamp) : false);

  const pollutantItems = [
    { label: 'PM2.5', value: formatPollutantValue(station.pollutants.pm25) },
    { label: 'PM10', value: formatPollutantValue(station.pollutants.pm10) },
    { label: 'NO₂', value: formatPollutantValue(station.pollutants.no2) },
    { label: 'SO₂', value: formatPollutantValue(station.pollutants.so2) },
    { label: 'O₃', value: formatPollutantValue(station.pollutants.o3) },
    { label: 'CO', value: formatPollutantValue(station.pollutants.co, 'mg/m³') },
  ];

  return (
    <section
      aria-label={`Air quality for ${station.city}`}
      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          {subtitle && (
            <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
              {subtitle}
            </p>
          )}
          <h3 className="font-display text-xl font-bold text-slate-900">
            {station.city}, {station.state}
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{station.stationName}</span>
            {typeof distanceKm === 'number' && (
              <span className="text-slate-400">
                • {distanceKm < 1 ? '< 1 km away' : `${distanceKm.toFixed(1)} km away`}
              </span>
            )}
          </p>
        </div>

        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${meta.bgClass} ${meta.borderClass}`}
        >
          <div>
            <span className="block text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              AQI
            </span>
            <span className={`font-mono text-3xl font-bold leading-none ${meta.textClass}`}>
              {station.aqi !== null ? station.aqi : '—'}
            </span>
          </div>
          <div className="border-l border-slate-900/10 pl-3">
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${meta.textClass}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
              {station.aqi !== null ? meta.category : 'AQI unavailable'}
            </span>
            <span className="block text-xs text-slate-600">NAQI (India)</span>
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
        <Wind className="mr-1.5 inline h-4 w-4 text-emerald-600" aria-hidden="true" />
        {meta.advisory}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {pollutantItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
          >
            <span className="block text-[11px] font-medium text-slate-500">{item.label}</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-slate-900">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRelativeTime(timestamp)}
        </span>
        {delayed && station.aqi !== null && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Data may be delayed
          </span>
        )}
      </div>
    </section>
  );
}

export function AQIStatusSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-16 w-36 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
