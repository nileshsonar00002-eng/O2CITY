export type AQICategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Unavailable';

export type DataStatus = 'live' | 'delayed' | 'unavailable';

export interface Pollutants {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  nh3: number | null;
}

export interface AQIReading {
  stationId: string;
  aqi: number | null;
  aqiCategory: AQICategory;
  pollutants: Pollutants;
  sourceTimestamp: string | null;
  fetchedAt: string;
  dataStatus: DataStatus;
}

export interface AQIHistoryPoint {
  id: string;
  stationId: string;
  aqi: number | null;
  aqiCategory: AQICategory;
  pm25: number | null;
  pm10: number | null;
  sourceTimestamp: string;
  fetchedAt: string;
}

export interface AQIResponseMeta {
  totalStations: number;
  lastUpdated: string | null;
  dataStatus: DataStatus;
  source: string;
}
