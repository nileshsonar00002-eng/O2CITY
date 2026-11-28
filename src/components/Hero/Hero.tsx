import type { LocationStatus } from '../../hooks/useLocation';
import type { AQIResponseMeta } from '../../types/aqi';
import type { StationWithAQI } from '../../types/station';
import { AQIMap } from '../AQIMap/AQIMap';
import { FloatingAQICard } from '../AQIStatus/FloatingAQICard';

interface HeroProps {
  stations: readonly StationWithAQI[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  locationStatus: LocationStatus;
  selectedStation: StationWithAQI | null;
  distanceKm: number | null;
  onUseMyLocation: () => void;
  onSelectStation: (station: StationWithAQI) => void;
}

export function Hero({
  stations,
  meta,
  isLoading,
  locationStatus,
  selectedStation,
  distanceKm,
  onUseMyLocation,
  onSelectStation,
}: HeroProps) {
  return (
    <section className="relative bg-transparent pb-12">
      {/* Top Hero Headline near Navbar */}
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-3.5 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.025em] text-slate-900 sm:text-[2rem] sm:leading-tight">
          How&apos;s the air{' '}
          <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 bg-clip-text text-transparent">
            around you?
          </span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          Search any Indian city or tap a monitoring station on the map to check live CPCB air quality.
        </p>
      </div>

      {/* Full-width Map */}
      <div className="mx-auto max-w-7xl px-0 sm:px-6 lg:px-8">
        <AQIMap
          stations={stations}
          meta={meta}
          isLoading={isLoading}
          selectedStation={selectedStation}
          onSelectStation={onSelectStation}
          heightClass="h-[340px] sm:h-[420px]"
          showLegend={false}
          popupPosition="none"
        />
      </div>

      {/* Overlapping AQI Card (Half on map, half below map) */}
      <FloatingAQICard
        station={selectedStation}
        distanceKm={distanceKm}
        isLoading={isLoading}
        isLocating={locationStatus === 'locating'}
        onUseMyLocation={onUseMyLocation}
      />
    </section>
  );
}
