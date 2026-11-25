import { RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AQIMap } from '../../components/AQIMap/AQIMap';
import { AQIStatusCard } from '../../components/AQIStatus/AQIStatusCard';
import { fetchStationHistory } from '../../services/aqiService';
import type { AQIHistoryPoint, AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import { formatRelativeTime, getAQIMetaByValue } from '../../utils/aqi';

interface MapPageProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export function MapPage({
  stations,
  cities,
  meta,
  isLoading,
  onRefresh,
}: MapPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<StationWithAQI | null>(null);
  const [history, setHistory] = useState<AQIHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const matchingCities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return cities
      .filter(
        (c) => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [cities, searchTerm]);

  useEffect(() => {
    if (!selectedStation) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoadingHistory(true);
      try {
        const points = await fetchStationHistory(selectedStation.stationId, 12);
        if (!cancelled) setHistory(points);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedStation]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            India AQI Map
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Explore real-time air-quality monitoring stations across India.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <label htmlFor="map-city-search" className="visually-hidden">
              Search city on map
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="map-city-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Jump to city..."
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            {matchingCities.length > 0 && (
              <ul className="absolute right-0 left-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {matchingCities.map((c) => (
                  <li key={`${c.city}-${c.state}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStation(c.primaryStation);
                        setSearchTerm(c.city);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {c.city}, {c.state}
                      </span>
                      <span className="font-mono font-semibold text-slate-700">
                        {c.averageAqi ?? '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin motion-reduce:hidden' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        <AQIMap
          stations={stations}
          meta={meta}
          isLoading={isLoading}
          selectedStation={selectedStation}
          onSelectStation={setSelectedStation}
          heightClass="h-[460px] sm:h-[560px]"
        />
      </div>

      {selectedStation && (
        <div className="mt-6 space-y-4">
          <AQIStatusCard
            station={selectedStation}
            subtitle="Station Details"
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900">
              Recent Station Readings
            </h2>
            {loadingHistory ? (
              <p className="mt-2 text-xs text-slate-500">Loading recent history...</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Historical snapshots will appear here as readings accumulate.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                {history.map((point) => {
                  const pointMeta = getAQIMetaByValue(point.aqi);
                  return (
                    <div
                      key={point.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <span className="block font-mono text-lg font-bold text-slate-900">
                        {point.aqi ?? '—'}
                      </span>
                      <span className={`text-[11px] font-semibold ${pointMeta.textClass}`}>
                        {point.aqiCategory}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">
                        {formatRelativeTime(point.sourceTimestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
