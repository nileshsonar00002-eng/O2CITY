import type { AQICategory, Pollutants } from '../types/aqi';

export interface AQICategoryMeta {
  category: AQICategory;
  rangeLabel: string;
  colorHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  advisory: string;
}

export const AQI_CATEGORIES: readonly AQICategoryMeta[] = [
  {
    category: 'Good',
    rangeLabel: '0–50',
    colorHex: '#10B981',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    dotClass: 'bg-emerald-500',
    advisory: 'Minimal impact. Ideal conditions for outdoor exercise and activities.',
  },
  {
    category: 'Satisfactory',
    rangeLabel: '51–100',
    colorHex: '#84CC16',
    bgClass: 'bg-lime-50',
    textClass: 'text-lime-800',
    borderClass: 'border-lime-200',
    dotClass: 'bg-lime-500',
    advisory: 'Minor breathing discomfort possible for unusually sensitive people.',
  },
  {
    category: 'Moderate',
    rangeLabel: '101–200',
    colorHex: '#F59E0B',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-500',
    advisory: 'Sensitive groups (asthma, children, elderly) should limit prolonged exertion.',
  },
  {
    category: 'Poor',
    rangeLabel: '201–300',
    colorHex: '#F97316',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-800',
    borderClass: 'border-orange-200',
    dotClass: 'bg-orange-500',
    advisory: 'Breathing discomfort on prolonged exposure. Prefer indoor activities.',
  },
  {
    category: 'Very Poor',
    rangeLabel: '301–400',
    colorHex: '#EF4444',
    bgClass: 'bg-red-50',
    textClass: 'text-red-800',
    borderClass: 'border-red-200',
    dotClass: 'bg-red-500',
    advisory: 'Respiratory illness risk on prolonged exposure. Avoid outdoor exertion.',
  },
  {
    category: 'Severe',
    rangeLabel: '401–500',
    colorHex: '#991B1B',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-900',
    borderClass: 'border-rose-300',
    dotClass: 'bg-rose-800',
    advisory: 'Health emergency risk for everyone. Stay indoors and keep windows closed.',
  },
] as const;

const UNAVAILABLE_META: AQICategoryMeta = {
  category: 'Unavailable',
  rangeLabel: '—',
  colorHex: '#94A3B8',
  bgClass: 'bg-slate-100',
  textClass: 'text-slate-700',
  borderClass: 'border-slate-200',
  dotClass: 'bg-slate-400',
  advisory: 'Current reading is unavailable from the monitoring station.',
};

/**
 * Classifies an Indian National AQI (CPCB) numeric value into its standard category.
 */
export function getAQICategory(aqi: number | null): AQICategory {
  if (aqi === null || Number.isNaN(aqi) || aqi < 0) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function getAQICategoryMeta(category: AQICategory): AQICategoryMeta {
  return AQI_CATEGORIES.find((item) => item.category === category) ?? UNAVAILABLE_META;
}

export function getAQIMetaByValue(aqi: number | null): AQICategoryMeta {
  return getAQICategoryMeta(getAQICategory(aqi));
}

/**
 * Formats an ISO timestamp into a concise relative string ("Updated 6 minutes ago").
 */
export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Update time unavailable';
  const time = Date.parse(isoString);
  if (Number.isNaN(time)) return 'Update time unavailable';

  const diffMs = Math.max(0, Date.now() - time);
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Updated just now';
  if (diffMins === 1) return 'Updated 1 minute ago';
  if (diffMins < 60) return `Updated ${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'Updated 1 hour ago';
  if (diffHours < 24) return `Updated ${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? 'Updated 1 day ago' : `Updated ${diffDays} days ago`;
}

export function isDataDelayed(isoString: string | null, thresholdMinutes = 120): boolean {
  if (!isoString) return true;
  const time = Date.parse(isoString);
  if (Number.isNaN(time)) return true;
  return Date.now() - time > thresholdMinutes * 60_000;
}

export function formatPollutantValue(value: number | null, unit = 'µg/m³'): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10} ${unit}`;
}

export function hasAnyPollutant(pollutants: Pollutants): boolean {
  return Object.values(pollutants).some((v) => v !== null && !Number.isNaN(v));
}
