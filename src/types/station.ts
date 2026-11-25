import type { AQICategory, DataStatus, Pollutants } from './aqi';

export interface MonitoringStation {
  stationId: string;
  stationName: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  active: boolean;
  source: string;
}

export interface StationWithAQI extends MonitoringStation {
  aqi: number | null;
  aqiCategory: AQICategory;
  pollutants: Pollutants;
  sourceTimestamp: string | null;
  fetchedAt: string | null;
  dataStatus: DataStatus;
}

export interface NearestStationResult {
  station: StationWithAQI;
  distanceKm: number;
}

export interface CitySummary {
  city: string;
  state: string;
  stationCount: number;
  averageAqi: number | null;
  aqiCategory: AQICategory;
  primaryStation: StationWithAQI;
  lastUpdated: string | null;
}
