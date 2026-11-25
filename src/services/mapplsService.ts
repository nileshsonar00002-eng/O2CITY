import { isMapplsConfigured, publicConfig } from '../config/env';

export interface MapplsLatLng {
  lat: number;
  lng: number;
}

export interface MapplsMapInstance {
  setCenter: (center: [number, number] | MapplsLatLng) => void;
  setZoom: (zoom: number) => void;
  remove?: () => void;
  on?: (event: string, cb: () => void) => void;
}

export interface MapplsMarkerInstance {
  remove?: () => void;
  setMap?: (map: MapplsMapInstance | null) => void;
  addListener?: (event: string, cb: () => void) => void;
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
    position: MapplsLatLng;
    html?: string;
    width?: number;
    height?: number;
    popupHtml?: string;
    fitbounds?: boolean;
  }) => MapplsMarkerInstance;
  markerCluster?: (options: {
    map: MapplsMapInstance;
    markers: MapplsMarkerInstance[];
  }) => unknown;
}

declare global {
  interface Window {
    mappls?: MapplsGlobal;
  }
}

let sdkLoadPromise: Promise<MapplsGlobal> | null = null;

/**
 * Loads the Mappls Maps Web SDK once per session.
 * Never exposes or logs the Mappls key.
 */
export function loadMapplsSDK(): Promise<MapplsGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mappls SDK requires a browser environment'));
  }

  if (window.mappls) {
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
      existing.addEventListener('load', () => {
        if (window.mappls) resolve(window.mappls);
        else reject(new Error('Mappls SDK failed to initialize'));
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load Mappls SDK')));
      return;
    }

    const script = document.createElement('script');
    script.dataset.o2cityMappls = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(
      publicConfig.mappls.mapKey
    )}/map_sdk?layer=vector&v=3.0`;

    script.onload = () => {
      if (window.mappls) {
        resolve(window.mappls);
      } else {
        sdkLoadPromise = null;
        reject(new Error('Mappls SDK loaded without window.mappls'));
      }
    };

    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Unable to load Mappls Maps SDK'));
    };

    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}
