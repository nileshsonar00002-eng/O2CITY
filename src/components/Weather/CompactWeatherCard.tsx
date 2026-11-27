import { ArrowUpRight, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompactWeatherData } from '../../types/weather';

interface CompactWeatherCardProps {
  weather: CompactWeatherData | null;
  isLoading: boolean;
  error: string | null;
  hasStation: boolean;
}

export function CompactWeatherCard({
  weather,
  isLoading,
  error,
  hasStation,
}: CompactWeatherCardProps) {
  if (!hasStation) {
    return (
      <div className="mt-2.5 max-w-md rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-xs text-slate-500">
        Select a city or station to view live weather.
      </div>
    );
  }

  if (isLoading && !weather) {
    return (
      <div className="mt-2.5 max-w-md animate-pulse rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-5 w-16 rounded bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-7 w-7 rounded-full bg-slate-200" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-2.5">
          <div className="h-7 rounded bg-slate-100" />
          <div className="h-7 rounded bg-slate-100" />
          <div className="h-7 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="mt-2.5 max-w-md rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-xs text-slate-600">
        {error ?? 'Weather data is currently unavailable.'}
      </div>
    );
  }

  return (
    <div className="mt-2.5 max-w-md rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xs">
      {/* Top Row: Icon + Temp + Short Condition + Circular Details Arrow */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {weather.conditionIcon ? (
            <img
              src={weather.conditionIcon}
              alt={weather.conditionText}
              className="h-10 w-10 shrink-0 object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <Sun className="h-5 w-5" aria-hidden="true" />
            </div>
          )}

          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-2xl leading-none font-bold tracking-tight text-slate-900 tabular-nums">
              {weather.tempC}°C
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {weather.conditionText}
            </span>
          </div>
        </div>

        <Link
          to="/map"
          title="Open station map"
          aria-label="Open station map"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-colors hover:bg-slate-700"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Bottom Row: Subtle Divider + Humidity, Wind Speed, UV Index */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-2.5">
        <div>
          <p className="text-[10px] font-medium text-slate-500">Humidity</p>
          <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
            {weather.humidity}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500">Wind Speed</p>
          <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
            {weather.windKph} km/h
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500">UV Index</p>
          <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
            {weather.uv}
          </p>
        </div>
      </div>
    </div>
  );
}
