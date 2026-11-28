import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Clock,
  Info,
  MessageSquareText,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  fetchAnalyticsAI,
  fetchAnalyticsSummary,
  type AnalyticsAIContextPayload,
  type AnalyticsSummaryResponse,
} from '../../services/analyticsService';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import {
  buildRankedCities,
  buildStationDirectoryRows,
  computeAqiDistribution,
  computeDeterministicForecast,
  computeDominantPollutantBreakdown,
  computeSeriesDelta,
  computeStateAverages,
  getMaxUpdateTimestamp,
  getMetroCitiesSummary,
  getTopAndBottomStates,
  POLLUTANT_META,
  type RankedCityItem,
} from '../../utils/analytics';
import { formatRelativeTime, getAQIMetaByValue, isDataDelayed } from '../../utils/aqi';

const DistributionDonutChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.DistributionDonutChart }))
);
const PollutantDonutChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.PollutantDonutChart }))
);
const MetroMiniGauge = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.MetroMiniGauge }))
);
const NationalHourlyBarChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.NationalHourlyBarChart }))
);
const PollutantTrendChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.PollutantTrendChart }))
);
const OutlookLineChart = lazy(() =>
  import('./AnalyticsCharts').then((m) => ({ default: m.OutlookLineChart }))
);

interface AnalyticsPageProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
}

type PollutantTabKey = 'pm25' | 'pm10' | 'no2' | 'co' | 'o3' | 'so2';
type StationSortField = 'aqi' | 'stationName' | 'city' | 'state';

const POLLUTANT_TABS: Array<{ key: PollutantTabKey; label: string; unit: string }> = [
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
  { key: 'no2', label: 'NO₂', unit: 'µg/m³' },
  { key: 'co', label: 'CO', unit: 'mg/m³' },
  { key: 'o3', label: 'O₃', unit: 'µg/m³' },
  { key: 'so2', label: 'SO₂', unit: 'µg/m³' },
];

const ASK_SUGGESTIONS = [
  "Why did India's AQI worsen today?",
  'Which states are getting worse?',
  "What is driving today's pollution?",
  'What changed in the last 12 hours?',
] as const;

const STATIONS_PER_PAGE = 25;

function ChartSkeleton({ heightClass = 'h-44' }: { heightClass?: string }) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl bg-slate-100 ${heightClass}`}
      aria-label="Loading chart"
    />
  );
}

function DeltaPill({ changePct }: { changePct: number | null | undefined }) {
  if (changePct === null || changePct === undefined) return null;
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
        isUp
          ? 'bg-rose-50 text-rose-700'
          : isDown
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isUp ? (
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      ) : isDown ? (
        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
      ) : null}
      <span>
        {isUp ? `+${changePct}%` : `${changePct}%`}
      </span>
    </span>
  );
}

function formatTimelineHour(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function AnalyticsPage({
  stations,
  cities,
  meta,
  isLoading,
}: AnalyticsPageProps) {
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedPollutant, setSelectedPollutant] = useState<PollutantTabKey>('pm25');

  // Story & Ask AI state
  const [airStory, setAirStory] = useState<string>('');
  const [storySource, setStorySource] = useState<'gemini' | 'deterministic' | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  // Station directory filters & pagination
  const [stationSearch, setStationSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [pollutantFilter, setPollutantFilter] = useState('ALL');
  const [sortField, setSortField] = useState<StationSortField>('aqi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchAnalyticsSummary();
        if (!cancelled) setSummary(data);
      } catch {
        // Summary stays null; UI gracefully shows honest insufficient-history message
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    const nationalMeta = getAQIMetaByValue(avgAqi);
    const distribution = computeAqiDistribution(stations);
    const veryPoorPlusCount = distribution
      .filter((b) => b.category === 'Very Poor' || b.category === 'Severe')
      .reduce((sum, b) => sum + b.count, 0);
    const veryPoorPlusPct =
      stations.length > 0
        ? Math.round((veryPoorPlusCount / stations.length) * 1000) / 10
        : 0;

    const stateAverages = computeStateAverages(stations, 2);
    const { top: topStates, bottom: bottomStates } = getTopAndBottomStates(stateAverages, 8);
    const dominantPollutants = computeDominantPollutantBreakdown(stations);
    const topPollutant = dominantPollutants[0]?.label ?? null;

    const rankedCities = buildRankedCities(stations);
    const highConfCities = rankedCities.filter((c) => !c.lowConfidence);
    const cityPool = highConfCities.length >= 5 ? highConfCities : rankedCities;
    const mostPollutedCities = [...cityPool]
      .sort((a, b) => b.averageAqi - a.averageAqi)
      .slice(0, 6);
    const cleanestCities = [...cityPool]
      .sort((a, b) => a.averageAqi - b.averageAqi)
      .slice(0, 6);

    const metroCities = getMetroCitiesSummary(cities, stations);
    const latestUpdateIso = getMaxUpdateTimestamp(stations, meta.lastUpdated);
    const isStaleOver3h = isDataDelayed(latestUpdateIso, 180);

    const hourlyTrend = summary?.hourlyTrend ?? [];
    const nationalTrendDelta = computeSeriesDelta(hourlyTrend.map((p) => p.avgAqi));
    const outlook = computeDeterministicForecast(hourlyTrend);

    const directoryRows = buildStationDirectoryRows(stations);
    const allStates = Array.from(new Set(stations.map((s) => s.state))).sort((a, b) =>
      a.localeCompare(b)
    );

    // Improving / Worsening cities from real cityDeltas
    const cityDeltaList = rankedCities
      .map((c) => {
        const delta = summary?.cityDeltas[`${c.city.toLowerCase()}__${c.state.toLowerCase()}`];
        return delta ? { ...c, changePct: delta.changePct, previousAvgAqi: delta.previousAvgAqi } : null;
      })
      .filter((x): x is RankedCityItem & { changePct: number; previousAvgAqi: number } => x !== null);

    const changingCities = [...cityDeltaList]
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 6);

    return {
      avgAqi,
      nationalMeta,
      distribution,
      veryPoorPlusCount,
      veryPoorPlusPct,
      topStates,
      bottomStates,
      dominantPollutants,
      topPollutant,
      mostPollutedCities,
      cleanestCities,
      changingCities,
      metroCities,
      latestUpdateIso,
      isStaleOver3h,
      hourlyTrend,
      nationalTrendDelta,
      outlook,
      directoryRows,
      allStates,
    };
  }, [stations, cities, meta.lastUpdated, summary]);

  const aiContext = useMemo<AnalyticsAIContextPayload>(
    () => ({
      nationalAvgAqi: analytics.avgAqi,
      nationalCategory: analytics.nationalMeta.category,
      activeStations: stations.length,
      monitoredCities: cities.length,
      veryPoorPlusCount: analytics.veryPoorPlusCount,
      veryPoorPlusPct: analytics.veryPoorPlusPct,
      changePct12h: analytics.nationalTrendDelta.changePct,
      dominantPollutant: analytics.topPollutant,
      worstStates: analytics.topStates.slice(0, 3).map((s) => ({
        state: s.state,
        averageAqi: s.averageAqi,
        changePct: summary?.stateDeltas[s.state]?.changePct ?? null,
      })),
      cleanestStates: analytics.bottomStates.slice(0, 3).map((s) => ({
        state: s.state,
        averageAqi: s.averageAqi,
        changePct: summary?.stateDeltas[s.state]?.changePct ?? null,
      })),
      forecastDirection: analytics.outlook.direction,
    }),
    [analytics, stations.length, cities.length, summary]
  );

  // Fetch Today's Air Story once stations + summary are ready
  useEffect(() => {
    if (stations.length === 0 || loadingSummary) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchAnalyticsAI({ mode: 'story', context: aiContext });
        if (!cancelled) {
          setAirStory(res.answer);
          setStorySource(res.source);
        }
      } catch {
        if (!cancelled && aiContext.nationalAvgAqi !== null) {
          const worst = aiContext.worstStates[0];
          const clean = aiContext.cleanestStates[0];
          const geo =
            worst && clean
              ? ` ${worst.state} (${worst.averageAqi} AQI) is among the most affected states, while ${clean.state} (${clean.averageAqi} AQI) is comparatively cleaner.`
              : '';
          setAirStory(
            `India's national average AQI is ${aiContext.nationalAvgAqi} (${aiContext.nationalCategory}) across ${aiContext.activeStations} stations in ${aiContext.monitoredCities} cities, with ${aiContext.veryPoorPlusCount} stations (${aiContext.veryPoorPlusPct}%) in Very Poor or Severe levels.${aiContext.dominantPollutant ? ` ${aiContext.dominantPollutant} is the leading pollutant.` : ''}${geo}`
          );
          setStorySource('deterministic');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stations.length, loadingSummary, aiContext]);

  const selectedPollutantMeta = POLLUTANT_TABS.find((t) => t.key === selectedPollutant)!;
  const pollutantSeries = useMemo(() => {
    const pts = analytics.hourlyTrend.map((p) => ({
      bucketAt: p.bucketAt,
      value: p.pollutants[selectedPollutant] ?? null,
    }));
    const delta = computeSeriesDelta(pts.map((p) => p.value));
    return { pts, delta };
  }, [analytics.hourlyTrend, selectedPollutant]);

  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    const list = analytics.directoryRows.filter((row) => {
      if (stateFilter !== 'ALL' && row.state !== stateFilter) return false;
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false;
      if (pollutantFilter !== 'ALL' && row.dominantPollutant !== pollutantFilter) return false;
      if (
        q &&
        !row.stationName.toLowerCase().includes(q) &&
        !row.city.toLowerCase().includes(q) &&
        !row.state.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'aqi') cmp = (a.aqi ?? -1) - (b.aqi ?? -1);
      else if (sortField === 'stationName') cmp = a.stationName.localeCompare(b.stationName);
      else if (sortField === 'city') cmp = a.city.localeCompare(b.city);
      else cmp = a.state.localeCompare(b.state);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    analytics.directoryRows,
    stationSearch,
    stateFilter,
    categoryFilter,
    pollutantFilter,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredStations.length / STATIONS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedStations = filteredStations.slice(
    (safePage - 1) * STATIONS_PER_PAGE,
    safePage * STATIONS_PER_PAGE
  );

  const handleSort = (field: StationSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'aqi' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleAskSubmit = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    setAskInput(trimmed);
    setAskLoading(true);
    try {
      const res = await fetchAnalyticsAI({
        mode: 'ask',
        question: trimmed,
        context: aiContext,
      });
      setAskAnswer(res.answer);
    } catch {
      setAskAnswer('Unable to answer right now. Please try again.');
    } finally {
      setAskLoading(false);
    }
  };

  const relativeUpdate = formatRelativeTime(analytics.latestUpdateIso);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. NATIONAL AIR QUALITY OVERVIEW */}
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">
            National Environmental Intelligence
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            India Air Quality Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time air-quality conditions across monitored Indian cities and stations.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
              <Clock className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              CPCB data {relativeUpdate.toLowerCase()}
            </span>
            {analytics.isStaleOver3h && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Data delayed
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAskOpen((prev) => !prev)}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2 text-xs font-bold text-emerald-800 shadow-xs transition-colors hover:bg-emerald-100 sm:self-auto"
        >
          <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>Ask O2CITY</span>
        </button>
      </header>

      {/* 11. ASK O2CITY AI DRAWER / PANEL */}
      {askOpen && (
        <section
          aria-label="Ask O2CITY AI"
          className="mt-5 rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-slate-900">
                Ask O2CITY — Grounded Air Quality Assistant
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAskOpen(false)}
              aria-label="Close Ask O2CITY"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {ASK_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleAskSubmit(q)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleAskSubmit(askInput);
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="Ask about India's current AQI, states, or 12-hour trend..."
              className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={askLoading || !askInput.trim()}
              className="min-h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {askLoading ? 'Analyzing...' : 'Ask'}
            </button>
          </form>

          {askAnswer && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-800">
              {askAnswer}
            </div>
          )}
        </section>
      )}

      {isLoading && stations.length === 0 ? (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
          <ChartSkeleton heightClass="h-64" />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Compact KPI Row */}
          <section aria-label="National KPI summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">National Average AQI</span>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="font-mono text-3xl font-extrabold tabular-nums"
                  style={{ color: analytics.nationalMeta.colorHex }}
                >
                  {analytics.avgAqi ?? '—'}
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {analytics.nationalMeta.category}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Active Monitoring Stations</span>
              <p className="mt-1.5 font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
                {stations.length}
              </p>
              <span className="text-[11px] text-slate-500">CPCB network</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Monitored Cities</span>
              <p className="mt-1.5 font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
                {cities.length}
              </p>
              <span className="text-[11px] text-slate-500">Across {analytics.allStates.length} states/UTs</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Very Poor + Severe Stations</span>
              <p className="mt-1.5 font-mono text-3xl font-extrabold text-rose-600 tabular-nums">
                {analytics.veryPoorPlusCount}
              </p>
              <span className="text-[11px] font-medium text-slate-600">
                {analytics.veryPoorPlusPct}% of active stations
              </span>
            </div>
          </section>

          {/* 2. PRIMARY 12-HOUR AQI TREND */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  India AQI — Last 12 Hours
                </h2>
                <p className="text-xs text-slate-500">
                  National average AQI across available monitoring stations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {analytics.nationalTrendDelta.current !== null && (
                  <span className="font-mono text-sm font-bold text-slate-900">
                    Current: {analytics.nationalTrendDelta.current} AQI
                  </span>
                )}
                {analytics.nationalTrendDelta.changePct !== null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    <DeltaPill changePct={analytics.nationalTrendDelta.changePct} />
                    <span>vs earliest available</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    Insufficient historical data for 12-hour comparison.
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              {loadingSummary ? (
                <ChartSkeleton heightClass="h-52" />
              ) : (
                <Suspense fallback={<ChartSkeleton heightClass="h-52" />}>
                  <NationalHourlyBarChart points={analytics.hourlyTrend} />
                </Suspense>
              )}
            </div>
          </section>

          {/* 3. POLLUTANT TREND & DISTRIBUTION */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    What Is Driving India&apos;s Air?
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hourly pollutant trend across reporting CPCB stations.
                  </p>
                </div>
                {analytics.topPollutant && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                    Dominant: {analytics.topPollutant}
                  </span>
                )}
              </div>

              {/* Pollutant Tabs */}
              <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Pollutant selector">
                {POLLUTANT_TABS.map((tab) => {
                  const active = selectedPollutant === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedPollutant(tab.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500">
                    {selectedPollutantMeta.label} Current
                  </span>
                  <p className="font-mono text-2xl font-extrabold text-slate-900">
                    {pollutantSeries.delta.current !== null
                      ? `${pollutantSeries.delta.current} ${selectedPollutantMeta.unit}`
                      : '—'}
                  </p>
                </div>
                {pollutantSeries.delta.previous !== null && (
                  <div className="text-xs text-slate-600">
                    Prev:{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {pollutantSeries.delta.previous} {selectedPollutantMeta.unit}
                    </span>
                  </div>
                )}
                {pollutantSeries.delta.changePct !== null && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <DeltaPill changePct={pollutantSeries.delta.changePct} />
                    <span>over available period</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                {loadingSummary ? (
                  <ChartSkeleton heightClass="h-36" />
                ) : (
                  <Suspense fallback={<ChartSkeleton heightClass="h-36" />}>
                    <PollutantTrendChart
                      points={pollutantSeries.pts}
                      label={selectedPollutantMeta.label}
                      unit={selectedPollutantMeta.unit}
                      colorHex={POLLUTANT_META[selectedPollutant].colorHex}
                    />
                  </Suspense>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Station AQI Distribution
                </h3>
                <div className="mt-3">
                  <Suspense fallback={<ChartSkeleton heightClass="h-40" />}>
                    <DistributionDonutChart
                      distribution={analytics.distribution}
                      totalStations={stations.length}
                    />
                  </Suspense>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Dominant Pollutant Share
                </h3>
                <div className="mt-3">
                  <Suspense fallback={<ChartSkeleton heightClass="h-36" />}>
                    <PollutantDonutChart breakdown={analytics.dominantPollutants} />
                  </Suspense>
                </div>
              </div>
            </div>
          </section>

          {/* 4. AIR QUALITY OUTLOOK & 5. TODAY'S AIR STORY */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    O2CITY Air Quality Outlook
                  </h2>
                  <p className="text-xs text-slate-500">
                    Estimated near-term direction based on available historical trends.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  Estimated · Not an official CPCB forecast
                </span>
              </div>

              <div className="mt-4">
                {loadingSummary ? (
                  <ChartSkeleton heightClass="h-44" />
                ) : analytics.outlook.available ? (
                  <Suspense fallback={<ChartSkeleton heightClass="h-44" />}>
                    <OutlookLineChart
                      observedPoints={analytics.hourlyTrend}
                      forecastPoints={analytics.outlook.points}
                    />
                  </Suspense>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs text-slate-500">
                    {analytics.outlook.reason}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/60 p-6 shadow-xs lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Today&apos;s Air Story
                    </h2>
                  </div>
                  {storySource && (
                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {storySource === 'gemini' ? 'Gemini AI' : 'Data Summary'}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {airStory ||
                    'Analyzing current national AQI, dominant pollutants, and regional shifts...'}
                </p>
              </div>

              <p className="mt-4 border-t border-emerald-100 pt-3 text-[11px] text-slate-500">
                Grounded strictly in verified CPCB station data ({stations.length} stations).
              </p>
            </div>
          </section>

          {/* 9. AIR QUALITY TIMELINE */}
          {analytics.hourlyTrend.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <h2 className="font-display text-sm font-bold text-slate-900">
                Today&apos;s Air Quality Timeline
              </h2>
              <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
                {analytics.hourlyTrend.map((pt) => {
                  const ptMeta = getAQIMetaByValue(pt.avgAqi);
                  return (
                    <div
                      key={pt.bucketAt}
                      className="flex min-w-28 shrink-0 flex-col rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        {formatTimelineHour(pt.bucketAt)}
                      </span>
                      <span
                        className="mt-0.5 font-mono text-base font-extrabold"
                        style={{ color: ptMeta.colorHex }}
                      >
                        {pt.avgAqi ?? '—'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700">
                        {ptMeta.category}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 6. STATE INTELLIGENCE */}
          <section>
            <div className="mb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                State Air Quality
              </h2>
              <p className="text-xs text-slate-500">
                States with 2+ valid CPCB stations, including historical change where available.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {[
                { title: 'Most Polluted States', items: analytics.topStates },
                { title: 'Cleanest States', items: analytics.bottomStates },
              ].map((panel) => {
                const maxVal = Math.max(...panel.items.map((s) => s.averageAqi), 100);
                return (
                  <div
                    key={panel.title}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                  >
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      {panel.title}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {panel.items.map((st) => {
                        const delta = summary?.stateDeltas[st.state]?.changePct ?? null;
                        const widthPct = Math.max(8, Math.round((st.averageAqi / maxVal) * 100));
                        return (
                          <div key={st.state} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-800">{st.state}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500">
                                  {st.stationCount} stations · {st.category}
                                </span>
                                <DeltaPill changePct={delta} />
                                <span className="w-9 text-right font-mono font-bold text-slate-900">
                                  {st.averageAqi}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${widthPct}%`, backgroundColor: st.colorHex }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7. CITY INTELLIGENCE */}
          <section>
            <div className="mb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                City Air Quality — Current
              </h2>
              <p className="text-xs text-slate-500">
                Most polluted, cleanest, and fastest-changing cities.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {[
                { title: 'Most Polluted Cities', items: analytics.mostPollutedCities },
                { title: 'Improving / Worsening Cities', items: analytics.changingCities },
                { title: 'Cleanest Cities', items: analytics.cleanestCities },
              ].map((panel) => (
                <div
                  key={panel.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                >
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    {panel.title}
                  </h3>
                  {panel.items.length === 0 ? (
                    <p className="mt-4 text-xs text-slate-500">
                      Insufficient historical city data for comparison yet.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {panel.items.map((city) => {
                        const delta =
                          'changePct' in city
                            ? (city as RankedCityItem & { changePct: number }).changePct
                            : (summary?.cityDeltas[
                                `${city.city.toLowerCase()}__${city.state.toLowerCase()}`
                              ]?.changePct ?? null);
                        return (
                          <li
                            key={`${city.city}-${city.state}`}
                            className="flex items-center justify-between gap-2 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{city.city}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span>{city.stationCount} station{city.stationCount === 1 ? '' : 's'}</span>
                                {city.lowConfidence && (
                                  <span
                                    title="City-level AQI is based on limited monitoring coverage."
                                    className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                  >
                                    Low confidence · 1 station
                                    <Info className="h-2.5 w-2.5" aria-hidden="true" />
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <DeltaPill changePct={delta} />
                              <span
                                className="font-mono text-sm font-bold tabular-nums"
                                style={{ color: city.colorHex }}
                              >
                                {city.averageAqi}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 8. METRO COMPARISON */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Metro Air Quality Comparison
                </h2>
                <p className="text-xs text-slate-500">
                  8 major Indian metropolitan hubs with station count and trend.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {analytics.metroCities.map((metro) => {
                const delta =
                  summary?.cityDeltas[
                    `${metro.city.toLowerCase()}__${metro.state.toLowerCase()}`
                  ]?.changePct ?? null;
                return (
                  <div
                    key={metro.city}
                    className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                  >
                    <div>
                      <p className="truncate text-xs font-bold text-slate-900">{metro.city}</p>
                      <p className="text-[10px] text-slate-500">
                        {metro.stationCount} stn{metro.stationCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className="font-mono text-lg font-extrabold"
                        style={{ color: metro.colorHex }}
                      >
                        {metro.stationCount > 0 ? metro.averageAqi : '—'}
                      </span>
                      <Suspense fallback={null}>
                        <MetroMiniGauge
                          aqi={metro.stationCount > 0 ? metro.averageAqi : 0}
                          colorHex={metro.colorHex}
                        />
                      </Suspense>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span className="truncate text-[10px] font-semibold text-slate-700">
                        {metro.stationCount > 0 ? metro.category : 'Unavailable'}
                      </span>
                      <DeltaPill changePct={delta} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 10. ALL MONITORED STATIONS */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  All Monitored Stations
                </h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredStations.length} of {stations.length} stations.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={stationSearch}
                    onChange={(e) => {
                      setStationSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search station or city..."
                    aria-label="Search station or city"
                    className="min-h-9 w-48 rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by state"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="ALL">All States</option>
                  {analytics.allStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by AQI category"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="ALL">All Categories</option>
                  {['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={pollutantFilter}
                  onChange={(e) => {
                    setPollutantFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by dominant pollutant"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="ALL">All Pollutants</option>
                  {POLLUTANT_TABS.map((p) => (
                    <option key={p.key} value={POLLUTANT_META[p.key].label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('stationName')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Station <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('city')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        City <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('state')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        State <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('aqi')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        AQI <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-3">Category</th>
                    <th className="py-2.5">Dominant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStations.map((row) => (
                    <tr key={row.stationId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        <span>{row.stationName}</span>
                        {row.lowConfidence && (
                          <span
                            title="City-level AQI is based on limited monitoring coverage."
                            className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                          >
                            Low confidence
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{row.city}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{row.state}</td>
                      <td
                        className="py-2.5 pr-3 font-mono font-bold tabular-nums"
                        style={{ color: row.colorHex }}
                      >
                        {row.aqi ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{row.category}</td>
                      <td className="py-2.5 font-mono text-slate-700">{row.dominantPollutant}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
