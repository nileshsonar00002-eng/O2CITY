import { useState } from 'react';
import type {
  DistributionBucket,
  PollutantBreakdownItem,
  StateAverageItem,
} from '../../utils/analytics';

interface DonutSegment {
  label: string;
  subLabel?: string;
  colorHex: string;
  count: number;
  percentage: number;
}

function SvgDonutChart({
  title,
  segments,
  totalLabel,
  totalValue,
  size = 180,
}: {
  title: string;
  segments: readonly DonutSegment[];
  totalLabel: string;
  totalValue: number;
  size?: number;
}) {
  const [hovered, setHovered] = useState<DonutSegment | null>(null);

  const activeSegments = segments.filter((s) => s.count > 0);
  const total = activeSegments.reduce((sum, s) => sum + s.count, 0) || 1;

  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const computedArcs = activeSegments.reduce<{
    offset: number;
    items: Array<DonutSegment & { dash: number; dashOffset: number }>;
  }>(
    (acc, seg) => {
      const fraction = seg.count / total;
      const dash = fraction * circumference;
      const item = {
        ...seg,
        dash,
        dashOffset: -acc.offset,
      };
      return {
        offset: acc.offset + dash,
        items: [...acc.items, item],
      };
    },
    { offset: 0, items: [] }
  ).items;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={title}
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {computedArcs.map((arc) => {
            const isActive = hovered?.label === arc.label;
            return (
              <circle
                key={arc.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.colorHex}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                strokeDashoffset={arc.dashOffset}
                tabIndex={0}
                aria-label={`${arc.label}: ${arc.count} (${arc.percentage}%)`}
                className="cursor-pointer transition-all duration-150 focus:outline-none"
                onMouseEnter={() => setHovered(arc)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(arc)}
                onBlur={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-[11px] font-medium text-slate-500">
            {hovered ? hovered.label : totalLabel}
          </span>
          <span className="font-mono text-xl font-bold text-slate-900">
            {hovered ? hovered.count : totalValue}
          </span>
          {hovered && (
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              {hovered.percentage}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {segments.map((seg) => (
          <li
            key={seg.label}
            onMouseEnter={() => setHovered(seg)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seg.colorHex }}
                aria-hidden="true"
              />
              <span className="font-medium">{seg.label}</span>
            </span>
            <span className="font-mono font-semibold text-slate-900">
              {seg.count}{' '}
              <span className="text-[10px] font-normal text-slate-500">({seg.percentage}%)</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg) => (
            <tr key={seg.label}>
              <td>{seg.label}</td>
              <td>{seg.count}</td>
              <td>{seg.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DistributionDonutChart({
  distribution,
  totalStations,
}: {
  distribution: readonly DistributionBucket[];
  totalStations: number;
}) {
  const segments: DonutSegment[] = distribution.map((d) => ({
    label: d.category,
    subLabel: d.rangeLabel,
    colorHex: d.colorHex,
    count: d.count,
    percentage: d.percentage,
  }));

  return (
    <SvgDonutChart
      title="AQI Distribution Across Monitoring Stations"
      segments={segments}
      totalLabel="Total Stations"
      totalValue={totalStations}
      size={176}
    />
  );
}

export function PollutantDonutChart({
  breakdown,
}: {
  breakdown: readonly PollutantBreakdownItem[];
}) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0);
  const segments: DonutSegment[] = breakdown.map((b) => ({
    label: b.label,
    colorHex: b.colorHex,
    count: b.count,
    percentage: b.percentage,
  }));

  return (
    <SvgDonutChart
      title="Dominant Pollutant Breakdown Across Stations"
      segments={segments}
      totalLabel="Stations"
      totalValue={total}
      size={164}
    />
  );
}

export function StateHorizontalBarChart({
  title,
  items,
  maxScale = 500,
}: {
  title: string;
  items: readonly StateAverageItem[];
  maxScale?: number;
}) {
  const rowHeight = 28;
  const svgHeight = Math.max(items.length * rowHeight, 32);

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No states with 2+ stations available.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <svg
            width="100%"
            height={svgHeight}
            viewBox={`0 0 460 ${svgHeight}`}
            role="img"
            aria-label={title}
            className="overflow-visible"
          >
            {items.map((item, idx) => {
              const y = idx * rowHeight + 4;
              const barWidth = Math.max(
                8,
                Math.min(220, (item.averageAqi / maxScale) * 220)
              );
              return (
                <g key={item.state}>
                  <text
                    x="0"
                    y={y + 14}
                    fontSize="11"
                    fontWeight="600"
                    fill="#334155"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {item.state.length > 18 ? `${item.state.slice(0, 17)}…` : item.state}
                  </text>
                  <rect
                    x="148"
                    y={y + 3}
                    width="220"
                    height="14"
                    rx="7"
                    fill="#f1f5f9"
                  />
                  <rect
                    x="148"
                    y={y + 3}
                    width={barWidth}
                    height="14"
                    rx="7"
                    fill={item.colorHex}
                  >
                    <title>
                      {item.state}: AQI {item.averageAqi} ({item.category}) • {item.stationCount}{' '}
                      stations
                    </title>
                  </rect>
                  <text
                    x="376"
                    y={y + 14}
                    fontSize="11"
                    fontWeight="700"
                    fill="#0f172a"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {item.averageAqi} ({item.stationCount})
                  </text>
                </g>
              );
            })}
          </svg>

          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th>State</th>
                <th>Average AQI</th>
                <th>Category</th>
                <th>Stations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.state}>
                  <td>{item.state}</td>
                  <td>{item.averageAqi}</td>
                  <td>{item.category}</td>
                  <td>{item.stationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MetroMiniGauge({
  aqi,
  colorHex,
}: {
  aqi: number;
  colorHex: string;
}) {
  const clamped = Math.min(500, Math.max(0, aqi));
  const pct = clamped / 500;
  const arcLength = Math.PI * 26;
  const dash = pct * arcLength;

  return (
    <svg
      width="68"
      height="40"
      viewBox="0 0 68 40"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M 8 34 A 26 26 0 0 1 60 34"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 8 34 A 26 26 0 0 1 60 34"
        fill="none"
        stroke={colorHex}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${arcLength}`}
      />
    </svg>
  );
}


function formatHourShort(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getAqiBarColor(aqi: number | null): string {
  if (aqi === null) return '#94a3b8';
  if (aqi <= 50) return '#00b050';
  if (aqi <= 100) return '#92d050';
  if (aqi <= 200) return '#ffc000';
  if (aqi <= 300) return '#ff7c00';
  if (aqi <= 400) return '#e53935';
  return '#7e0023';
}

export function NationalHourlyBarChart({
  points,
}: {
  points: readonly import('../../utils/analytics').HourlyTrendPoint[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const valid = points.filter((p) => p.avgAqi !== null);

  if (valid.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs text-slate-500">
        No hourly historical snapshots available yet. Bars will appear as hourly readings accumulate.
      </div>
    );
  }

  const maxVal = Math.max(...valid.map((p) => p.avgAqi ?? 0), 100);
  const hoveredPoint = hoveredIdx !== null ? valid[hoveredIdx] ?? null : null;

  return (
    <div>
      {hoveredPoint ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          <span className="font-semibold text-slate-800">
            {formatHourShort(hoveredPoint.bucketAt)} ·{' '}
            <span className="font-mono font-bold text-slate-950">
              {hoveredPoint.avgAqi} AQI
            </span>
          </span>
          <span className="text-[11px] text-slate-500">
            {hoveredPoint.stationCount} reporting stations
          </span>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>Showing {valid.length} available hourly interval{valid.length === 1 ? '' : 's'}</span>
          <span>Hover or focus a bar for exact values</span>
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div
          className="flex h-52 min-w-[360px] items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 pt-6 pb-3"
          role="img"
          aria-label="National average AQI hourly bar chart"
        >
          {valid.map((pt, idx) => {
            const val = pt.avgAqi ?? 0;
            const heightPct = Math.max(8, Math.round((val / maxVal) * 100));
            const color = getAqiBarColor(val);
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={pt.bucketAt}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="font-mono text-[10px] font-bold text-slate-700 tabular-nums">
                  {val}
                </span>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  aria-label={`${formatHourShort(pt.bucketAt)}: AQI ${val} across ${pt.stationCount} stations`}
                  className={`w-full max-w-12 rounded-t-md transition-all focus:outline-none ${
                    isHovered ? 'ring-2 ring-slate-900/30 brightness-95' : ''
                  }`}
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: color,
                  }}
                />
                <span className="font-mono text-[10px] text-slate-500">
                  {formatHourShort(pt.bucketAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PollutantTrendChart({
  points,
  label,
  unit,
  colorHex,
}: {
  points: readonly { bucketAt: string; value: number | null }[];
  label: string;
  unit: string;
  colorHex: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const valid = points.filter(
    (p): p is { bucketAt: string; value: number } =>
      p.value !== null && Number.isFinite(p.value)
  );

  if (valid.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-xs text-slate-500">
        {valid.length === 1
          ? `Latest ${label}: ${valid[0]!.value} ${unit} (more hourly points needed for trend line)`
          : `Insufficient historical ${label} readings available.`}
      </div>
    );
  }

  const width = 560;
  const height = 140;
  const padX = 24;
  const padY = 18;
  const values = valid.map((p) => p.value);
  const minVal = Math.max(0, Math.min(...values) * 0.85);
  const maxVal = Math.max(...values, minVal + 1);

  const coords = valid.map((p, idx) => {
    const x = padX + (idx / (valid.length - 1)) * (width - padX * 2);
    const ratio = (p.value - minVal) / (maxVal - minVal);
    const y = height - padY - ratio * (height - padY * 2);
    return { ...p, x, y };
  });

  const linePts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const active = hoveredIdx !== null ? coords[hoveredIdx] ?? null : null;

  return (
    <div>
      {active && (
        <p className="mb-1 text-xs font-medium text-slate-700">
          {formatHourShort(active.bucketAt)} ·{' '}
          <span className="font-mono font-bold text-slate-900">
            {active.value} {unit}
          </span>
        </p>
      )}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-36 w-full min-w-[320px]"
          role="img"
          aria-label={`${label} historical trend chart`}
        >
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
            stroke={colorHex}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePts}
          />
          {coords.map((c, idx) => (
            <g key={c.bucketAt}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIdx === idx ? 5 : 3.5}
                fill={colorHex}
                stroke="#ffffff"
                strokeWidth="1.5"
                tabIndex={0}
                className="cursor-pointer focus:outline-none"
                aria-label={`${formatHourShort(c.bucketAt)}: ${c.value} ${unit}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
              />
              <text
                x={c.x}
                y={height - 3}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                {formatHourShort(c.bucketAt)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function OutlookLineChart({
  observedPoints,
  forecastPoints,
}: {
  observedPoints: readonly import('../../utils/analytics').HourlyTrendPoint[];
  forecastPoints: readonly import('../../utils/analytics').ForecastPoint[];
}) {
  const validObserved = observedPoints
    .filter((p) => p.avgAqi !== null)
    .slice(-6)
    .map((p) => ({
      label: formatHourShort(p.bucketAt),
      aqi: p.avgAqi as number,
      isForecast: false,
      colorHex: getAqiBarColor(p.avgAqi),
    }));

  const combined = [
    ...validObserved,
    ...forecastPoints.map((f) => ({
      label: f.label,
      aqi: f.projectedAqi,
      isForecast: true,
      colorHex: f.colorHex,
    })),
  ];

  if (validObserved.length === 0 || forecastPoints.length === 0) {
    return null;
  }

  const width = 640;
  const height = 170;
  const padX = 28;
  const padY = 22;
  const values = combined.map((c) => c.aqi);
  const minVal = Math.max(0, Math.min(...values) - 25);
  const maxVal = Math.max(...values, minVal + 40);

  const coords = combined.map((pt, idx) => {
    const x = padX + (idx / (combined.length - 1)) * (width - padX * 2);
    const ratio = (pt.aqi - minVal) / (maxVal - minVal);
    const y = height - padY - ratio * (height - padY * 2);
    return { ...pt, x, y };
  });

  const splitIdx = validObserved.length - 1;
  const splitX = coords[splitIdx]!.x;
  const obsLine = coords
    .slice(0, splitIdx + 1)
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const fcLine = coords
    .slice(splitIdx)
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full min-w-[420px]"
        role="img"
        aria-label="Observed and estimated near-term AQI outlook chart"
      >
        {/* Shaded Forecast Region */}
        <rect
          x={splitX}
          y={padY - 8}
          width={width - padX - splitX + 12}
          height={height - padY * 2 + 12}
          rx="6"
          fill="#ecfdf5"
          fillOpacity="0.6"
        />
        <line
          x1={splitX}
          y1={padY - 8}
          x2={splitX}
          y2={height - padY + 4}
          stroke="#94a3b8"
          strokeDasharray="3 3"
          strokeWidth="1"
        />

        <text x={padX} y={12} fontSize="10" fontWeight="600" fill="#475569">
          Observed
        </text>
        <text x={splitX + 8} y={12} fontSize="10" fontWeight="600" fill="#047857">
          Forecast (Estimated)
        </text>

        <polyline
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={obsLine}
        />
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="2.2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={fcLine}
        />

        {coords.map((c) => (
          <g key={`${c.label}-${c.isForecast ? 'fc' : 'obs'}`}>
            <circle
              cx={c.x}
              cy={c.y}
              r={3.5}
              fill={c.isForecast ? '#059669' : '#0f172a'}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={c.x}
              y={c.y - 7}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#1e293b"
            >
              {c.aqi}
            </text>
            <text
              x={c.x}
              y={height - 3}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
