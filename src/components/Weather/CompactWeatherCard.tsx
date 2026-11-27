import { ArrowUpRight, Droplets, Sun, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CompactWeatherData } from '../../types/weather';

interface CompactWeatherCardProps {
  weather: CompactWeatherData | null;
  isLoading: boolean;
  error: string | null;
  hasStation: boolean;
  variant?: 'inline' | 'tab';
}

export function CompactWeatherCard({
  weather,
  isLoading,
  error,
  hasStation,
  variant = 'tab',
}: CompactWeatherCardProps) {
  const wrapperClass =
    variant === 'inline'
      ? 'relative rounded-xl border border-white/80 bg-white/65 p-3 shadow-sm backdrop-blur-md'
      : 'mt-2.5 max-w-md rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xs';

  if (!hasStation) {
    return (
      <div className={`${wrapperClass} text-xs text-slate-500`}>
        Select a city or station to view live weather.
      </div>
    );
  }

  if (isLoading && !weather) {
    return (
      <div className={`${wrapperClass} animate-pulse`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-200/80" />
            <div className="space-y-1.5">
              <div className="h-5 w-16 rounded bg-slate-200/80" />
              <div className="h-3 w-20 rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-7 w-7 rounded-full bg-slate-200/80" />
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-2">
          <div className="h-7 rounded bg-slate-100" />
          <div className="h-7 rounded bg-slate-100" />
          <div className="h-7 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className={`${wrapperClass} text-xs text-slate-600`}>
        {error ?? 'Weather data is currently unavailable.'}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {/* Top Row: Icon + Temp + Short Condition + Circular Details Arrow */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {weather.conditionIcon ? (
            <img
              src={weather.conditionIcon}
              alt={weather.conditionText}
              className="h-9 w-9 shrink-0 object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
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
      <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200/80 border-t border-slate-200/80 pt-2 text-center">
        <div className="px-1">
          <p className="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
            <Droplets className="h-3 w-3 text-sky-500" aria-hidden="true" />
            <span>Humidity</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 tabular-nums">
            {weather.humidity}%
          </p>
        </div>
        <div className="px-1">
          <p className="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
            <Wind className="h-3 w-3 text-teal-600" aria-hidden="true" />
            <span>Wind Speed</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 tabular-nums">
            {weather.windKph} km/h
          </p>
        </div>
        <div className="px-1">
          <p className="inline-flex items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
            <Sun className="h-3 w-3 text-amber-500" aria-hidden="true" />
            <span>UV Index</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 tabular-nums">
            {weather.uv}
          </p>
        </div>
      </div>
    </div>
  );
}
