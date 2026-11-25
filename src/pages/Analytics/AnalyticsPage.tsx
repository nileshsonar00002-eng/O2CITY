import { BarChart3, Clock, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import { AQI_CATEGORIES, formatRelativeTime, getAQIMetaByValue } from '../../utils/aqi';

interface AnalyticsPageProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
}

export function AnalyticsPage({
  stations,
  cities,
  meta,
  isLoading,
}: AnalyticsPageProps) {
  const stats = useMemo(() => {
    const validStations = stations.filter(
      (s): s is StationWithAQI & { aqi: number } =>
        s.aqi !== null && Number.isFinite(s.aqi)
    );

    const avgAqi =
      validStations.length > 0
        ? Math.round(
            validStations.reduce((sum, s) => sum + s.aqi, 0) / validStations.length
          )
        : null;

    const distribution = AQI_CATEGORIES.map((cat) => ({
      ...cat,
      count: validStations.filter((s) => s.aqiCategory === cat.category).length,
    }));

    const validCities = cities.filter(
      (c): c is CitySummary & { averageAqi: number } => c.averageAqi !== null
    );

    const mostPolluted = [...validCities]
      .sort((a, b) => b.averageAqi - a.averageAqi)
      .slice(0, 5);

    const cleanest = [...validCities]
      .sort((a, b) => a.averageAqi - b.averageAqi)
      .slice(0, 5);

    return {
      validStationCount: validStations.length,
      avgAqi,
      distribution,
      mostPolluted,
      cleanest,
    };
  }, [stations, cities]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            India AQI Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time overview computed strictly from active monitoring station readings.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRelativeTime(meta.lastUpdated)}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Loading latest air-quality data...
        </div>
      ) : stations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
            No live station data available yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Analytics are generated exclusively from live CPCB / Firestore readings. Once
            ingestion runs, India-wide summaries and city rankings will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-medium text-slate-500">Active Stations</span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {meta.totalStations}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-medium text-slate-500">Monitored Cities</span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {cities.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-medium text-slate-500">
                National Station Average AQI
              </span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {stats.avgAqi ?? '—'}
              </p>
            </div>
          </div>

          {/* AQI Distribution */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">
              AQI Distribution Across Stations
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {stats.distribution.map((item) => (
                <div
                  key={item.category}
                  className={`rounded-xl border p-3.5 ${item.bgClass} ${item.borderClass}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${item.dotClass}`} />
                    <span className={`text-xs font-semibold ${item.textClass}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
                    {item.count}
                  </p>
                  <p className="text-[11px] text-slate-500">AQI {item.rangeLabel}</p>
                </div>
              ))}
            </div>
          </section>

          {/* City Rankings */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CityRankCard
              title="Most Polluted Cities (Current)"
              cities={stats.mostPolluted}
            />
            <CityRankCard
              title="Cleanest Available Cities (Current)"
              cities={stats.cleanest}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CityRankCard({
  title,
  cities,
}: {
  title: string;
  cities: readonly (CitySummary & { averageAqi: number })[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
      {cities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Insufficient city readings available.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {cities.map((city) => {
            const catMeta = getAQIMetaByValue(city.averageAqi);
            return (
              <li
                key={`${city.city}-${city.state}`}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {city.city}
                  </p>
                  <p className="text-xs text-slate-500">
                    {city.state} • {city.stationCount} station
                    {city.stationCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${catMeta.bgClass} ${catMeta.textClass}`}
                >
                  {city.averageAqi} • {catMeta.category}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
