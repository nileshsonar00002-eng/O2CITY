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
