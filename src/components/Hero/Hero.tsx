import type { LocationStatus } from '../../hooks/useLocation';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';
import { AQIMap } from '../AQIMap/AQIMap';
import { AQIStatusCard, AQIStatusSkeleton } from '../AQIStatus/AQIStatusCard';
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
  selectionSubtitle: string | null;
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
  selectionSubtitle,
  onUseMyLocation,
  onSelectCity,
  onSelectStation,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-slate-50 pt-8 pb-14 sm:pt-12 sm:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Headline, Subtitle, Location Card */}
          <div className="o2-fade-up space-y-6 lg:col-span-5">
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                How&apos;s the air
                <br />
                around{' '}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  you?
                </span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                Get real-time AQI, understand your air, and make smarter outdoor
                decisions.
              </p>
            </div>

            <LocationCard
              cities={cities}
              locationStatus={locationStatus}
              locationMessage={locationMessage}
              isDataLoading={isLoading}
              onUseMyLocation={onUseMyLocation}
              onSelectCity={onSelectCity}
            />
          </div>

          {/* Right Column: India AQI Map */}
          <div className="o2-fade-up lg:col-span-7">
            <AQIMap
              stations={stations}
              meta={meta}
              isLoading={isLoading}
              selectedStation={selectedStation}
              onSelectStation={onSelectStation}
            />
          </div>
        </div>

        {/* Selected / Detected Station Result */}
        {locationStatus === 'locating' && (
          <div className="mt-8">
            <AQIStatusSkeleton label="Finding your nearest monitoring station..." />
          </div>
        )}

        {locationStatus !== 'locating' && selectedStation && (
          <div className="mt-8">
            <AQIStatusCard
              station={selectedStation}
              distanceKm={distanceKm}
              subtitle={selectionSubtitle ?? undefined}
            />
          </div>
        )}
      </div>
    </section>
  );
}
