export interface CompactWeatherPayload {
  tempC: number;
  conditionText: string;
  conditionIcon: string;
  humidity: number;
  windKph: number;
  uv: number;
  locationName: string;
  updatedAt: string;
}

export class WeatherAPIError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 502) {
    super(message);
    this.name = 'WeatherAPIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface WeatherApiCurrentResponse {
  location?: {
    name?: string;
    localtime?: string;
  };
  current?: {
    temp_c?: number;
    humidity?: number;
    wind_kph?: number;
    uv?: number;
    last_updated?: string;
    condition?: {
      text?: string;
      icon?: string;
    };
  };
}

function normalizeIconUrl(rawIcon: string | undefined): string {
  if (!rawIcon) return '';
  return rawIcon.startsWith('//') ? `https:${rawIcon}` : rawIcon;
}

/**
 * Fetches current compact weather from WeatherAPI.com on the server.
 * Never call WeatherAPI.com directly from browser code.
 */
export async function fetchCompactWeather(
  lat: number,
  lon: number
): Promise<CompactWeatherPayload> {
  const apiKey = process.env.WEATHERAPI_KEY?.trim();
  if (!apiKey) {
    throw new WeatherAPIError(
      'WEATHERAPI_ENV_MISSING',
      'WeatherAPI server key is not configured',
      503
    );
  }

  const query = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const url = new URL('https://api.weatherapi.com/v1/current.json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('aqi', 'no');

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new WeatherAPIError('WEATHERAPI_NETWORK_ERROR', 'Unable to reach WeatherAPI', 502);
  }

  if (!response.ok) {
    throw new WeatherAPIError(
      `WEATHERAPI_HTTP_${response.status}`,
      'WeatherAPI returned an error response',
      response.status === 401 || response.status === 403 ? 502 : response.status
    );
  }

  const data = (await response.json()) as WeatherApiCurrentResponse;
  const current = data.current;
  if (!current || typeof current.temp_c !== 'number') {
    throw new WeatherAPIError('WEATHERAPI_INVALID_PAYLOAD', 'Incomplete weather payload', 502);
  }

  return {
    tempC: Math.round(current.temp_c),
    conditionText: current.condition?.text?.trim() || 'Clear',
    conditionIcon: normalizeIconUrl(current.condition?.icon),
    humidity: Math.round(current.humidity ?? 0),
    windKph: Number((current.wind_kph ?? 0).toFixed(1)),
    uv: Number((current.uv ?? 0).toFixed(1)),
    locationName: data.location?.name?.trim() || '',
    updatedAt: current.last_updated || new Date().toISOString(),
  };
}
