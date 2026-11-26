import { isMapplsConfigured, publicConfig } from '../config/env';

export interface MapplsLatLng {
  lat: number;
  lng: number;
}

export interface MapplsMapInstance {
  setCenter: (center: [number, number] | MapplsLatLng) => void;
  setZoom: (zoom: number) => void;
  remove?: () => void;
  loaded?: () => boolean;
  addListener?: (event: string, cb: (eventData?: unknown) => void) => void;
  on?: (event: string, cb: (eventData?: unknown) => void) => void;
}

export interface MapplsGeoJsonFeature {
  type: 'Feature';
  properties: {
    stationId: string;
    icon?: string;
    htmlPopup?: string;
    colorHex?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface MapplsGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: MapplsGeoJsonFeature[];
}

export interface MapplsClustersOptions {
  background?: Array<[number, string]>;
  radius?: Array<[number, number]>;
  maxZoom?: number;
  [key: string]: unknown;
}

export interface MapplsMarkerInstance {
  remove?: () => void;
  setMap?: (map: MapplsMapInstance | null) => void;
  addListener?: (event: string, cb: (eventData?: unknown) => void) => void;
}

export interface MapplsGlobal {
  Map: new (
    container: string | HTMLElement,
    options: {
      center: [number, number];
      zoom: number;
      zoomControl?: boolean;
      location?: boolean;
      search?: boolean;
    }
  ) => MapplsMapInstance;
  Marker: new (options: {
    map: MapplsMapInstance;
    position: MapplsLatLng | MapplsGeoJsonFeatureCollection;
    html?: string;
    icon?: string;
    width?: number;
    height?: number;
    popupHtml?: string;
    fitbounds?: boolean;
    cType?: 0 | 1;
    clusters?: boolean;
    clustersOptions?: MapplsClustersOptions;
  }) => MapplsMarkerInstance;
  remove?: (options: { map: MapplsMapInstance; layer: unknown }) => void;
}

declare global {
  interface Window {
    mappls?: MapplsGlobal;
  }
}

let sdkLoadPromise: Promise<MapplsGlobal> | null = null;

function isMapplsReady(): boolean {
  return Boolean(window.mappls && typeof window.mappls.Map === 'function');
}

function waitForMapplsGlobal(
  resolve: (sdk: MapplsGlobal) => void,
  reject: (err: Error) => void
): void {
  if (isMapplsReady() && window.mappls) {
    resolve(window.mappls);
    return;
  }

  let attempts = 0;
  const interval = window.setInterval(() => {
    attempts += 1;
    if (isMapplsReady() && window.mappls) {
      window.clearInterval(interval);
      resolve(window.mappls);
    } else if (attempts >= 20) {
      window.clearInterval(interval);
      sdkLoadPromise = null;
      reject(new Error('Mappls SDK loaded without window.mappls.Map'));
    }
  }, 100);
}

/**
 * Loads the Mappls Maps Web SDK v3.0 once per session.
 * Never exposes or logs the Mappls key.
 */
export function loadMapplsSDK(): Promise<MapplsGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mappls SDK requires a browser environment'));
  }

  if (isMapplsReady() && window.mappls) {
    return Promise.resolve(window.mappls);
  }

  if (!isMapplsConfigured()) {
    return Promise.reject(new Error('Mappls map key is not configured'));
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<MapplsGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-o2city-mappls="true"]');
    if (existing) {
      if (isMapplsReady() && window.mappls) {
        resolve(window.mappls);
        return;
      }
      existing.addEventListener('load', () => waitForMapplsGlobal(resolve, reject), { once: true });
      existing.addEventListener(
        'error',
        () => {
          sdkLoadPromise = null;
          reject(new Error('Failed to load Mappls SDK'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.dataset.o2cityMappls = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(
      publicConfig.mappls.mapKey.trim()
    )}`;

    script.onload = () => {
      waitForMapplsGlobal(resolve, reject);
    };

    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Unable to load Mappls Maps SDK'));
    };

    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}
