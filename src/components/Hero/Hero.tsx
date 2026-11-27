import type { LocationStatus } from '../../hooks/useLocation';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import { AQIMap } from '../AQIMap/AQIMap';
import { FloatingAQICard } from '../AQIStatus/FloatingAQICard';
import { LocationCard } from '../LocationCard/LocationCard';

interface HeroProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  locationStatus: LocationStatus;
  locationMessage: string | null;
  selectedStation: StationWithAQI | null;
  distanceKm: number | null;
  onUseMyLocation: () => void;
  onSelectCity: (city: CitySummary) => void;
  onSelectStation: (station: StationWithAQI) => void;
}

export function Hero({
  stations,
  cities,
  meta,
  isLoading,
  locationStatus,
  locationMessage,
  selectedStation,
  distanceKm,
  onUseMyLocation,
  onSelectCity,
  onSelectStation,
}: HeroProps) {
  return (
    <section className="relative bg-slate-50 pb-12">
      {/* Top Hero Headline near Navbar */}
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          How&apos;s the air around{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            you?
          </span>
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
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
          popupPosition="top-center"
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

      {/* Find Your Location Card below Floating AQI Card */}
      <div className="mx-auto mt-6 max-w-2xl px-4 sm:px-6 lg:px-8">
        <LocationCard
          cities={cities}
          locationStatus={locationStatus}
          locationMessage={locationMessage}
          isDataLoading={isLoading}
          onUseMyLocation={onUseMyLocation}
          onSelectCity={onSelectCity}
        />
      </div>
    </section>
  );
}
