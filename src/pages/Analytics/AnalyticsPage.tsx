import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Clock,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import {
  buildRankedCities,
  computeAqiDistribution,
  computeDominantPollutantBreakdown,
  computeStateAverages,
  generateAajKaInsight,
  getMaxUpdateTimestamp,
  getMetroCitiesSummary,
  getTopAndBottomStates,
  type RankedCityItem,
} from '../../utils/analytics';
import { formatRelativeTime, getAQIMetaByValue, isDataDelayed } from '../../utils/aqi';

const DistributionDonutChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.DistributionDonutChart }))
);
const PollutantDonutChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.PollutantDonutChart }))
);
const StateHorizontalBarChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.StateHorizontalBarChart }))
);
const MetroMiniGauge = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.MetroMiniGauge }))
);

interface AnalyticsPageProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
}

type SortField = 'city' | 'state' | 'averageAqi' | 'stationCount' | 'dominantPollutant';

function useCountUp(target: number | null, durationMs = 550): number {
  const safeTarget = target ?? 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (safeTarget <= 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const id = window.requestAnimationFrame(() => setValue(safeTarget));
      return () => window.cancelAnimationFrame(id);
    }

    let rafId = 0;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * safeTarget));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [safeTarget, durationMs]);

  return target === null ? 0 : value;
}

function SectionFooter({
  stationCount,
  relativeUpdate,
}: {
  stationCount: number;
  relativeUpdate: string;
}) {
  return (
    <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
      Data: CPCB · {stationCount} stations · {relativeUpdate}
    </p>
  );
}

function ChartSkeleton({ heightClass = 'h-44' }: { heightClass?: string }) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl bg-slate-100 ${heightClass}`}
      aria-label="Loading chart"
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-label="Loading analytics">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}

export function AnalyticsPage({
  stations,
  cities,
  meta,
  isLoading,
}: AnalyticsPageProps) {
  const [tableSearch, setTableSearch] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('averageAqi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const analytics = useMemo(() => {
    const validStations = stations.filter(
      (s): s is StationWithAQI & { aqi: number } =>
        s.aqi !== null && Number.isFinite(s.aqi) && s.aqi >= 0
    );

    const avgAqi =
      validStations.length > 0
        ? Math.round(
            validStations.reduce((sum, s) => sum + s.aqi, 0) / validStations.length
          )
        : null;

    const distribution = computeAqiDistribution(stations);
    const stateAverages = computeStateAverages(stations, 2);
    const { top: topStates, bottom: bottomStates } = getTopAndBottomStates(stateAverages, 10);
    const dominantPollutants = computeDominantPollutantBreakdown(stations);
    const rankedCities = buildRankedCities(stations);

    const highConfCities = rankedCities.filter((c) => !c.lowConfidence);
    const rankingPool = highConfCities.length >= 5 ? highConfCities : rankedCities;

    const mostPolluted = [...rankingPool]
      .sort((a, b) => b.averageAqi - a.averageAqi)
      .slice(0, 5);

    const cleanest = [...rankingPool]
      .sort((a, b) => a.averageAqi - b.averageAqi)
      .slice(0, 5);

    const metroCities = getMetroCitiesSummary(cities, stations);
    const insightText = generateAajKaInsight(stations, stateAverages);
    const latestUpdateIso = getMaxUpdateTimestamp(stations, meta.lastUpdated);
    const isStaleOver3h = isDataDelayed(latestUpdateIso, 180);

    const allStates = Array.from(new Set(rankedCities.map((c) => c.state))).sort((a, b) =>
      a.localeCompare(b)
    );

    return {
      avgAqi,
      distribution,
      topStates,
      bottomStates,
      dominantPollutants,
      rankedCities,
      mostPolluted,
      cleanest,
      metroCities,
      insightText,
      latestUpdateIso,
      isStaleOver3h,
      allStates,
    };
  }, [stations, cities, meta.lastUpdated]);

  const relativeUpdate = formatRelativeTime(analytics.latestUpdateIso);
  const animatedStations = useCountUp(stations.length);
  const animatedCities = useCountUp(cities.length);
  const animatedAvgAqi = useCountUp(analytics.avgAqi);

  const filteredSortedCities = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = analytics.rankedCities.filter((item) => {
      const matchesState =
        selectedStateFilter === 'ALL' || item.state === selectedStateFilter;
      const matchesQuery =
        !q ||
        item.city.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q);
      return matchesState && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'averageAqi') cmp = a.averageAqi - b.averageAqi;
      else if (sortField === 'stationCount') cmp = a.stationCount - b.stationCount;
      else if (sortField === 'city') cmp = a.city.localeCompare(b.city);
      else if (sortField === 'state') cmp = a.state.localeCompare(b.state);
      else cmp = a.dominantPollutant.localeCompare(b.dominantPollutant);

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [analytics.rankedCities, tableSearch, selectedStateFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'city' || field === 'state' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Title & Latest Update */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            India AQI Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time overview computed strictly from active monitoring station readings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {relativeUpdate}
          </span>
          {analytics.isStaleOver3h && stations.length > 0 && (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Data &gt;3 hrs old (CPCB delay)
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
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
          {/* 1. Aaj ka Insight Banner */}
          <section
            aria-label="Aaj ka insight"
            className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 p-5 shadow-xs transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold tracking-wide text-emerald-900 uppercase">
                  Aaj ka insight
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {analytics.insightText}
                </p>
              </div>
            </div>
            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <span className="text-xs font-medium text-slate-500">Active Stations</span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {animatedStations}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <span className="text-xs font-medium text-slate-500">Monitored Cities</span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {animatedCities}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <span className="text-xs font-medium text-slate-500">
                National Station Average AQI
              </span>
              <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                {analytics.avgAqi !== null ? animatedAvgAqi : '—'}
              </p>
            </div>
          </div>

          {/* 2. AQI Distribution (Donut Chart + Exact Sum Boxes) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
            <h2 className="font-display text-lg font-bold text-slate-900">
              AQI Distribution Across Stations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hover or focus any slice to inspect station count and percentage share.
            </p>

            <div className="mt-5">
              <Suspense fallback={<ChartSkeleton heightClass="h-44" />}>
                <DistributionDonutChart
                  distribution={analytics.distribution}
                  totalStations={stations.length}
                />
              </Suspense>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {analytics.distribution.map((item) => (
                <div
                  key={item.category}
                  className={`rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${item.bgClass} ${item.borderClass}`}
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
                  <p className="text-[11px] text-slate-500">
                    AQI {item.rangeLabel} · {item.percentage}%
                  </p>
                </div>
              ))}
            </div>

            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>

          {/* 3. State-wise Average AQI (Top 10 & Bottom 10 Horizontal Bar Charts) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
            <h2 className="font-display text-lg font-bold text-slate-900">
              State-wise Average AQI (States with 2+ Stations)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Top 10 highest and bottom 10 lowest average AQI states across India.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Suspense fallback={<ChartSkeleton heightClass="h-72" />}>
                <StateHorizontalBarChart
                  title="Top 10 Most Polluted States"
                  items={analytics.topStates}
                />
              </Suspense>
              <Suspense fallback={<ChartSkeleton heightClass="h-72" />}>
                <StateHorizontalBarChart
                  title="Top 10 Cleanest States"
                  items={analytics.bottomStates}
                />
              </Suspense>
            </div>

            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>

          {/* 4. Dominant Pollutant Breakdown */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Dominant Pollutant Breakdown
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Primary pollutant driving air quality relative to CPCB NAAQS thresholds.
            </p>

            <div className="mt-5">
              <Suspense fallback={<ChartSkeleton heightClass="h-44" />}>
                <PollutantDonutChart breakdown={analytics.dominantPollutants} />
              </Suspense>
            </div>

            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>

          {/* 5. Metro Cities 8 Comparison Cards */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Metro Cities Comparison
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Live average AQI, category, and station coverage across 8 major metros.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analytics.metroCities.map((metro) => {
                const catMeta = getAQIMetaByValue(metro.stationCount > 0 ? metro.averageAqi : null);
                return (
                  <div
                    key={metro.city}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-900">
                          {metro.city}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {metro.stationCount} station{metro.stationCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Suspense fallback={<div className="h-10 w-16 animate-pulse rounded bg-slate-200" />}>
                        <MetroMiniGauge
                          aqi={metro.stationCount > 0 ? metro.averageAqi : 0}
                          colorHex={catMeta.colorHex}
                        />
                      </Suspense>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-2xl font-bold text-slate-900">
                        {metro.stationCount > 0 ? metro.averageAqi : '—'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${catMeta.bgClass} ${catMeta.textClass}`}
                      >
                        {catMeta.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>

          {/* City Rankings (2+ valid stations preferred; 1-station marked Low confidence) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CityRankCard
              title="Most Polluted Cities (Current)"
              cities={analytics.mostPolluted}
              stationCount={stations.length}
              relativeUpdate={relativeUpdate}
            />
            <CityRankCard
              title="Cleanest Available Cities (Current)"
              cities={analytics.cleanest}
              stationCount={stations.length}
              relativeUpdate={relativeUpdate}
            />
          </div>

          {/* 6. Sortable, Searchable City Table */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  All Monitored Cities Directory
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Search, filter by state, and sort all active Indian cities.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-56">
                  <label htmlFor="analytics-city-search" className="visually-hidden">
                    Search city or state
                  </label>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="analytics-city-search"
                    type="search"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search city or state..."
                    className="min-h-9 w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="analytics-state-filter" className="visually-hidden">
                    Filter by state
                  </label>
                  <select
                    id="analytics-state-filter"
                    value={selectedStateFilter}
                    onChange={(e) => setSelectedStateFilter(e.target.value)}
                    className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All States ({analytics.allStates.length})</option>
                    {analytics.allStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <SortableTh
                      label="City"
                      field="city"
                      activeField={sortField}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="State"
                      field="state"
                      activeField={sortField}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="AQI"
                      field="averageAqi"
                      activeField={sortField}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Category
                    </th>
                    <SortableTh
                      label="Stations"
                      field="stationCount"
                      activeField={sortField}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableTh
                      label="Dominant Pollutant"
                      field="dominantPollutant"
                      activeField={sortField}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSortedCities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No cities match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSortedCities.map((row) => {
                      const catMeta = getAQIMetaByValue(row.averageAqi);
                      return (
                        <tr
                          key={`${row.city}-${row.state}`}
                          className="transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{row.city}</span>
                              {row.lowConfidence && (
                                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                                  Low conf.
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.state}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {row.averageAqi}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catMeta.bgClass} ${catMeta.textClass}`}
                            >
                              {catMeta.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {row.stationCount}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-700">
                            {row.dominantPollutant}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <SectionFooter stationCount={stations.length} relativeUpdate={relativeUpdate} />
          </section>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  field,
  activeField,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  dir: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const isActive = activeField === field;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-4 py-3 font-semibold"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 text-left font-semibold text-slate-700 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
      >
        <span>{label}</span>
        <ArrowUpDown
          className={`h-3 w-3 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function CityRankCard({
  title,
  cities,
  stationCount,
  relativeUpdate,
}: {
  title: string;
  cities: readonly RankedCityItem[];
  stationCount: number;
  relativeUpdate: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:shadow-md">
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
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {city.city}
                    </p>
                    {city.lowConfidence && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        Low confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {city.state} • {city.stationCount} station
                    {city.stationCount === 1 ? '' : 's'}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-bold ${catMeta.bgClass} ${catMeta.textClass}`}
                >
                  {city.averageAqi} • {catMeta.category}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <SectionFooter stationCount={stationCount} relativeUpdate={relativeUpdate} />
    </section>
  );
}
