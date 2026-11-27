import { CloudSun, LocateFixed, Share2, Wind, Activity } from 'lucide-react';
import { useState } from 'react';
import { useWeather } from '../../hooks/useWeather';
import type { StationWithAQI } from '../../types/station';
import {
  formatPollutantValue,
  formatRelativeTime,
  getAQIMetaByValue,
} from '../../utils/aqi';
import { CompactWeatherCard } from '../Weather/CompactWeatherCard';

interface FloatingAQICardProps {
  station: StationWithAQI | null;
  distanceKm?: number | null;
  isLoading: boolean;
  isLocating?: boolean;
  onUseMyLocation: () => void;
}

function getBarPositionPercent(aqi: number | null): number {
  if (aqi === null || Number.isNaN(aqi) || aqi < 0) return 0;
  return Math.min(100, Math.max(0, (aqi / 500) * 100));
}

export function FloatingAQICard({
  station,
  distanceKm,
  isLoading,
  isLocating = false,
  onUseMyLocation,
}: FloatingAQICardProps) {
  const [activeTab, setActiveTab] = useState<'aqi' | 'pollutants' | 'weather'>('aqi');
  const [copied, setCopied] = useState(false);

  const {
    weather,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = useWeather(
    station?.latitude ?? null,
    station?.longitude ?? null,
    activeTab === 'aqi' || activeTab === 'weather'
  );

  const meta = getAQIMetaByValue(station?.aqi ?? null);
  const aqiValue = station?.aqi ?? null;
  const indicatorPercent = getBarPositionPercent(aqiValue);

  const handleShare = async () => {
    const shareText = station
      ? `${station.city} AQI is ${station.aqi ?? 'N/A'} (${meta.category}) at ${station.stationName} — O2CITY`
      : 'Check live AQI across India on O2CITY';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'O2CITY Live AQI', text: shareText, url: window.location.href });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore user-cancelled share
    }
  };

  return (
    <div className="relative z-10 mx-auto -mt-28 max-w-4xl px-4 sm:-mt-32 sm:px-6 lg:px-8">
      {/* Top-left Attached Tabs (matching reference design) */}
      <div className="flex items-end gap-1 pl-2">
        <button
          type="button"
          onClick={() => setActiveTab('aqi')}
          className={`inline-flex items-center gap-1 rounded-t-xl px-3 py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'aqi'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'bg-white/80 text-slate-600 hover:bg-white/95'
          }`}
        >
          <Wind className="h-3 w-3 text-sky-500" aria-hidden="true" />
          <span>AQI</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pollutants')}
          className={`inline-flex items-center gap-1 rounded-t-xl px-3 py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'pollutants'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'bg-white/80 text-slate-600 hover:bg-white/95'
          }`}
        >
          <Activity className="h-3 w-3 text-amber-500" aria-hidden="true" />
          <span>Pollutants</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('weather')}
          className={`inline-flex items-center gap-1 rounded-t-xl px-3 py-1 text-[11px] font-semibold transition-colors ${
            activeTab === 'weather'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'bg-white/80 text-slate-600 hover:bg-white/95'
          }`}
        >
          <CloudSun className="h-3 w-3 text-sky-500" aria-hidden="true" />
          <span>Weather</span>
        </button>
      </div>

      {/* Main Overlapping Card */}
      <div
        className="relative overflow-hidden rounded-2xl rounded-tl-none border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10"
        style={{
          backgroundImage: `linear-gradient(180deg, #ffffff 22%, ${meta.colorHex}73 55%, ${meta.colorHex}cc 100%)`,
        }}
      >
        {/* Subtle City Skyline Silhouette at Bottom */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute right-0 bottom-0 left-0 h-10 w-full opacity-[0.22]"
        >
          <path
            fill={meta.colorHex}
            d="M0,120 L0,85 L35,85 L35,55 L65,55 L65,85 L95,85 L95,40 L135,40 L135,70 L160,70 L160,30 L195,30 L195,80 L235,80 L235,50 L280,50 L280,90 L320,90 L320,35 L355,35 L355,65 L395,65 L395,25 L435,25 L435,75 L475,75 L475,48 L520,48 L520,85 L560,85 L560,20 L595,20 L595,60 L640,60 L640,42 L685,42 L685,82 L725,82 L725,30 L765,30 L765,70 L810,70 L810,45 L855,45 L855,88 L900,88 L900,32 L945,32 L945,68 L990,68 L990,40 L1035,40 L1035,78 L1080,78 L1080,52 L1130,52 L1130,84 L1170,84 L1170,60 L1200,60 L1200,120 Z"
          />
        </svg>

        <div className="relative z-10 px-3.5 py-2.5 sm:px-5 sm:py-3.5">
          {/* Card Header */}
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Real-time Air Quality Index (AQI)
              </h2>
              {isLoading && !station ? (
                <div className="mt-1 h-4 w-40 animate-pulse rounded bg-slate-200" />
              ) : station ? (
                <>
                  <p className="mt-0.5 text-xs font-semibold text-sky-700 underline decoration-sky-300 underline-offset-4">
                    {station.city}, {station.state}, India
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {station.stationName}
                    {typeof distanceKm === 'number' ? ` · ${distanceKm.toFixed(1)} km away` : ''}
                    {' · '}Last Updated:{' '}
                    <span className="font-medium text-slate-700">
                      {formatRelativeTime(station.sourceTimestamp ?? station.fetchedAt)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Select a city or use your location to view live CPCB air quality.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 self-start">
              <button
                type="button"
                onClick={onUseMyLocation}
                disabled={isLocating}
                className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 shadow-xs transition-colors hover:bg-sky-50 disabled:opacity-60"
              >
                <LocateFixed
                  className={`h-3 w-3 ${isLocating ? 'animate-pulse' : ''}`}
                  aria-hidden="true"
                />
                <span>{isLocating ? 'Locating...' : 'Locate me'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShare()}
                title="Share AQI"
                aria-label="Share AQI"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {copied && (
                <span className="text-[10px] font-semibold text-emerald-700">Copied!</span>
              )}
            </div>
          </div>

          {/* Card Body */}
          {activeTab === 'aqi' ? (
            <div className="mt-2.5 grid items-end gap-3 lg:grid-cols-12">
              {/* Left: Big AQI Number, Status Badge, PM2.5/PM10 & Scale Bar */}
              <div className="space-y-1.5 lg:col-span-7">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.colorHex }}
                        aria-hidden="true"
                      />
                      <span>Live AQI</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span
                        className="font-mono text-3xl leading-none font-extrabold tracking-tight sm:text-4xl"
                        style={{ color: meta.colorHex }}
                      >
                        {aqiValue !== null ? aqiValue : '—'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700">AQI (CPCB)</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-medium text-slate-600">Air Quality is</span>
                    <span
                      className="mt-0.5 inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-bold shadow-xs"
                      style={{
                        backgroundColor: `${meta.colorHex}1F`,
                        color: meta.colorHex,
                        border: `1px solid ${meta.colorHex}40`,
                      }}
                    >
                      {meta.category}
                    </span>
                  </div>
                </div>

                {/* PM2.5 & PM10 Row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-800">
                  <div>
                    <span className="font-medium text-slate-800">PM2.5 : </span>
                    <span className="font-mono font-bold text-slate-950">
                      {formatPollutantValue(station?.pollutants.pm25 ?? null)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-800">PM10 : </span>
                    <span className="font-mono font-bold text-slate-950">
                      {formatPollutantValue(station?.pollutants.pm10 ?? null)}
                    </span>
                  </div>
                </div>

                {/* Segmented AQI Scale Bar */}
                <div className="max-w-md pt-0.5">
                  <div className="mb-0.5 flex justify-between text-[9px] font-bold text-slate-900">
                    <span>Good</span>
                    <span>Satisfactory</span>
                    <span>Moderate</span>
                    <span>Poor</span>
                    <span>Very Poor</span>
                    <span>Severe</span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-visible rounded-full">
                    <div className="grid h-full w-full grid-cols-6 overflow-hidden rounded-full">
                      <div className="bg-[#00b050]" />
                      <div className="bg-[#92d050]" />
                      <div className="bg-[#ffc000]" />
                      <div className="bg-[#ff7c00]" />
                      <div className="bg-[#e53935]" />
                      <div className="bg-[#7e0023]" />
                    </div>
                    {aqiValue !== null && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                        style={{
                          left: `${indicatorPercent}%`,
                          backgroundColor: meta.colorHex,
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-0.5 flex justify-between font-mono text-[9px] font-semibold text-slate-900">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                    <span>200</span>
                    <span>300</span>
                    <span>400</span>
                    <span>500</span>
                  </div>
                </div>
              </div>

              {/* Right: Compact Weather Card */}
              <div className="lg:col-span-5">
                <CompactWeatherCard
                  weather={weather}
                  isLoading={isWeatherLoading}
                  error={weatherError}
                  hasStation={station !== null}
                  variant="inline"
                />
              </div>
            </div>
          ) : activeTab === 'pollutants' ? (
            /* Pollutants Tab */
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'PM2.5', value: station?.pollutants.pm25 ?? null },
                { label: 'PM10', value: station?.pollutants.pm10 ?? null },
                { label: 'NO₂', value: station?.pollutants.no2 ?? null },
                { label: 'SO₂', value: station?.pollutants.so2 ?? null },
                { label: 'CO', value: station?.pollutants.co ?? null, unit: 'mg/m³' as const },
                { label: 'O₃', value: station?.pollutants.o3 ?? null },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/80 bg-white/75 p-2 shadow-xs backdrop-blur-sm"
                >
                  <span className="text-[10px] font-semibold text-slate-500">{item.label}</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                    {formatPollutantValue(item.value, item.unit)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* Compact Weather Tab */
            <CompactWeatherCard
              weather={weather}
              isLoading={isWeatherLoading}
              error={weatherError}
              hasStation={station !== null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
