export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Unavailable';

export interface CPCBRecordRaw {
  country?: string;
  state?: string;
  city?: string;
  station?: string;
  last_update?: string;
  latitude?: string | number;
  longitude?: string | number;
  pollutant_id?: string;
  pollutant_min?: string | number;
  pollutant_max?: string | number;
  pollutant_avg?: string | number;
}

export interface NormalizedStation {
  stationId: string;
  stationName: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  active: boolean;
  source: string;
}

export interface NormalizedAQI {
  stationId: string;
  aqi: number | null;
  aqiCategory: AQICategory;
  pollutants: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    o3: number | null;
    nh3: number | null;
  };
  sourceTimestamp: string | null;
  fetchedAt: string;
  dataStatus: 'live' | 'delayed' | 'unavailable';
}

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// Official Indian National AQI (CPCB) breakpoints
const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 },
];

const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
];

const NO2_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 81, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 181, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 281, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 401, cHigh: 800, iLow: 401, iHigh: 500 },
];

const SO2_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 81, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 381, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 801, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1601, cHigh: 2620, iLow: 401, iHigh: 500 },
];

const O3_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 168, iLow: 101, iHigh: 200 },
  { cLow: 169, cHigh: 208, iLow: 201, iHigh: 300 },
  { cLow: 209, cHigh: 748, iLow: 301, iHigh: 400 },
  { cLow: 749, cHigh: 1000, iLow: 401, iHigh: 500 },
];

const NH3_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 200, iLow: 0, iHigh: 50 },
  { cLow: 201, cHigh: 400, iLow: 51, iHigh: 100 },
  { cLow: 401, cHigh: 800, iLow: 101, iHigh: 200 },
  { cLow: 801, cHigh: 1200, iLow: 201, iHigh: 300 },
  { cLow: 1201, cHigh: 1800, iLow: 301, iHigh: 400 },
  { cLow: 1801, cHigh: 2400, iLow: 401, iHigh: 500 },
];

function computeSubIndex(value: number | null, table: readonly Breakpoint[]): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  for (const bp of table) {
    if (value <= bp.cHigh) {
      const ratio = (value - bp.cLow) / Math.max(1, bp.cHigh - bp.cLow);
      return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
    }
  }
  return 500;
}

export function classifyAQI(aqi: number | null): AQICategory {
  if (aqi === null || !Number.isFinite(aqi) || aqi < 0) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function toStationId(state: string, city: string, station: string): string {
  const raw = `${state}_${city}_${station}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function parseNumeric(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === '' || val === 'NA') return null;
  const num = typeof val === 'number' ? val : Number.parseFloat(String(val));
  return Number.isFinite(num) ? num : null;
}

function parsePollutantValue(val: string | number | undefined): number | null {
  const num = parseNumeric(val);
  if (num === null || num < 0 || num > 5000) return null;
  return Math.round(num * 100) / 100;
}

function isValidIndianCoordinate(lat: number | null, lon: number | null): lat is number {
  return (
    lat !== null &&
    lon !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 5 &&
    lat <= 38 &&
    lon >= 67 &&
    lon <= 98
  );
}

function parseCpcbTimestamp(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy, hh, min, ss = '00'] = ddmmyyyy;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:30`;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export interface ParsedCPCBResult {
  stations: NormalizedStation[];
  readings: NormalizedAQI[];
  totalRawRecords: number;
  skippedCount: number;
}

export class CPCBError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 502) {
    super(message);
    this.name = 'CPCBError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function sanitizeErrorText(input: string): string {
  return input
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/api-key=[^&\s]+/gi, 'api-key=[redacted]')
    .slice(0, 200);
}

function classifyNetworkFailure(
  errorName: string,
  causeCode: string | null
): 'DNS' | 'TLS' | 'CONNECTION_RESET' | 'CONNECTION_TIMEOUT' | 'OTHER' {
  if (
    errorName === 'TimeoutError' ||
    causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    causeCode === 'ETIMEDOUT'
  ) {
    return 'CONNECTION_TIMEOUT';
  }
  if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN' || causeCode === 'EAI_FAIL') {
    return 'DNS';
  }
  if (
    causeCode &&
    (causeCode.startsWith('CERT_') ||
      causeCode.startsWith('ERR_TLS_') ||
      causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      causeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT')
  ) {
    return 'TLS';
  }
  if (
    causeCode === 'ECONNRESET' ||
    causeCode === 'EPIPE' ||
    causeCode === 'UND_ERR_SOCKET' ||
    causeCode === 'ECONNREFUSED'
  ) {
    return 'CONNECTION_RESET';
  }
  return 'OTHER';
}

async function fetchCPCBPage(
  baseUrl: string,
  apiKey: string,
  offset: number,
  limit: number
): Promise<{ records: CPCBRecordRaw[]; total: number }> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new CPCBError('CPCB_INVALID_BASE_URL', 'CPCB_API_BASE_URL is not a valid URL', 503);
  }

  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7_000),
    });
  } catch (err) {
    const errorName = err instanceof Error ? err.name : 'UnknownError';
    const errorMessage = err instanceof Error ? sanitizeErrorText(err.message) : 'Unknown error';
    const causeObj =
      err instanceof Error && err.cause && typeof err.cause === 'object'
        ? (err.cause as { code?: unknown; message?: unknown })
        : null;
    const causeCode = causeObj && typeof causeObj.code === 'string' ? causeObj.code : null;
    const causeMessage =
      causeObj && typeof causeObj.message === 'string'
        ? sanitizeErrorText(causeObj.message)
        : null;
    const category = classifyNetworkFailure(errorName, causeCode);

    console.error(
      JSON.stringify({
        event: 'cpcb_fetch_network_detail',
        category,
        errorName,
        errorMessage,
        causeCode,
        causeMessage,
      })
    );

    const isTimeout = errorName === 'TimeoutError';
    throw new CPCBError(
      isTimeout ? 'CPCB_TIMEOUT' : 'CPCB_NETWORK_ERROR',
      isTimeout
        ? 'CPCB upstream request timed out'
        : `Network error reaching CPCB upstream (${category}${causeCode ? `: ${causeCode}` : ''})`,
      isTimeout ? 504 : 502
    );
  }

  if (response.status === 429) {
    throw new CPCBError('CPCB_RATE_LIMITED', 'CPCB upstream rate limit reached', 429);
  }

  if (response.status === 401 || response.status === 403) {
    throw new CPCBError('CPCB_AUTH_REJECTED', 'CPCB upstream rejected credentials', 502);
  }

  if (!response.ok) {
    throw new CPCBError(
      'CPCB_HTTP_ERROR',
      `CPCB upstream responded with status ${response.status}`,
      502
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CPCBError('CPCB_MALFORMED_JSON', 'Malformed JSON from CPCB upstream', 502);
  }

  if (!payload || typeof payload !== 'object') {
    throw new CPCBError('CPCB_INVALID_PAYLOAD', 'Unexpected payload structure from CPCB upstream', 502);
  }

  const typed = payload as { records?: unknown; total?: unknown };
  const records = Array.isArray(typed.records) ? (typed.records as CPCBRecordRaw[]) : [];
  const total =
    typeof typed.total === 'number'
      ? typed.total
      : typeof typed.total === 'string'
        ? Number.parseInt(typed.total, 10) || records.length
        : records.length;

  return { records, total };
}

function logSafeBaseUrlDiagnostic(baseUrl: string): void {
  const isEnvConfigured = Boolean(process.env.CPCB_API_BASE_URL?.trim());
  let isExpectedHost = false;
  try {
    const parsed = new URL(baseUrl);
    isExpectedHost = parsed.hostname === 'api.data.gov.in';
  } catch {
    isExpectedHost = false;
  }

  console.info(
    JSON.stringify({
      event: 'cpcb_base_url_check',
      cpcbBaseUrlConfigured: isEnvConfigured,
      isDataGovHost: isExpectedHost,
    })
  );
}

export async function fetchCPCBData(): Promise<ParsedCPCBResult> {
  const apiKey = process.env.CPCB_API_KEY?.trim();
  const baseUrl =
    process.env.CPCB_API_BASE_URL?.trim() ||
    'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';

  if (!apiKey) {
    throw new CPCBError('CPCB_API_KEY_MISSING', 'CPCB_API_KEY is not configured', 503);
  }

  logSafeBaseUrlDiagnostic(baseUrl);

  const PAGE_LIMIT = 2000;
  const MAX_PAGES = 3;

  const firstPage = await fetchCPCBPage(baseUrl, apiKey, 0, PAGE_LIMIT);
  const allRecords: CPCBRecordRaw[] = [...firstPage.records];

  if (firstPage.records.length === PAGE_LIMIT && firstPage.total > PAGE_LIMIT) {
    const remainingPages = Math.min(
      MAX_PAGES - 1,
      Math.ceil((firstPage.total - PAGE_LIMIT) / PAGE_LIMIT)
    );
    const pagePromises: Promise<{ records: CPCBRecordRaw[]; total: number }>[] = [];
    for (let p = 1; p <= remainingPages; p++) {
      pagePromises.push(fetchCPCBPage(baseUrl, apiKey, p * PAGE_LIMIT, PAGE_LIMIT));
    }
    const extraPages = await Promise.all(pagePromises);
    for (const page of extraPages) {
      allRecords.push(...page.records);
    }
  }

  if (allRecords.length === 0) {
    throw new CPCBError('CPCB_EMPTY_DATASET', 'CPCB upstream returned an empty dataset', 502);
  }

  const stationMap = new Map<
    string,
    {
      station: NormalizedStation;
      pollutants: NormalizedAQI['pollutants'];
      sourceTimestamp: string | null;
    }
  >();

  const fetchedAt = new Date().toISOString();
  let skippedCount = 0;

  for (const row of allRecords) {
    const stationName = row.station?.trim();
    const city = row.city?.trim();
    const state = row.state?.trim() || 'India';
    const lat = parseNumeric(row.latitude);
    const lon = parseNumeric(row.longitude);

    if (!stationName || !city || !isValidIndianCoordinate(lat, lon)) {
      skippedCount += 1;
      continue;
    }

    const stationId = toStationId(state, city, stationName);
    if (stationId.length < 2) {
      skippedCount += 1;
      continue;
    }

    let entry = stationMap.get(stationId);
    if (!entry) {
      entry = {
        station: {
          stationId,
          stationName,
          city,
          state,
          latitude: lat,
          longitude: lon as number,
          active: true,
          source: 'CPCB / data.gov.in',
        },
        pollutants: {
          pm25: null,
          pm10: null,
          no2: null,
          so2: null,
          co: null,
          o3: null,
          nh3: null,
        },
        sourceTimestamp: parseCpcbTimestamp(row.last_update),
      };
      stationMap.set(stationId, entry);
    }

    const avgVal = parsePollutantValue(row.pollutant_avg);
    const pid = (row.pollutant_id ?? '').trim().toUpperCase();

    if (pid === 'PM2.5') entry.pollutants.pm25 = avgVal;
    else if (pid === 'PM10') entry.pollutants.pm10 = avgVal;
    else if (pid === 'NO2') entry.pollutants.no2 = avgVal;
    else if (pid === 'SO2') entry.pollutants.so2 = avgVal;
    else if (pid === 'CO') entry.pollutants.co = avgVal;
    else if (pid === 'OZONE' || pid === 'O3') entry.pollutants.o3 = avgVal;
    else if (pid === 'NH3') entry.pollutants.nh3 = avgVal;
  }

  const stations: NormalizedStation[] = [];
  const readings: NormalizedAQI[] = [];

  for (const { station, pollutants, sourceTimestamp } of stationMap.values()) {
    const subIndices = [
      computeSubIndex(pollutants.pm25, PM25_BREAKPOINTS),
      computeSubIndex(pollutants.pm10, PM10_BREAKPOINTS),
      computeSubIndex(pollutants.no2, NO2_BREAKPOINTS),
      computeSubIndex(pollutants.so2, SO2_BREAKPOINTS),
      computeSubIndex(pollutants.o3, O3_BREAKPOINTS),
      computeSubIndex(pollutants.nh3, NH3_BREAKPOINTS),
    ].filter((v): v is number => v !== null);

    const aqi = subIndices.length > 0 ? Math.max(...subIndices) : null;
    const aqiCategory = classifyAQI(aqi);

    stations.push(station);
    readings.push({
      stationId: station.stationId,
      aqi,
      aqiCategory,
      pollutants,
      sourceTimestamp,
      fetchedAt,
      dataStatus: aqi !== null ? 'live' : 'unavailable',
    });
  }

  return {
    stations,
    readings,
    totalRawRecords: allRecords.length,
    skippedCount,
  };
}
