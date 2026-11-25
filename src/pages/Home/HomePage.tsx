import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Hero } from '../../components/Hero/Hero';
import { PersonalSection } from '../../components/Hero/PersonalSection';
import { TrustStrip } from '../../components/Hero/TrustStrip';
import { useLocation } from '../../hooks/useLocation';
import type { AQIResponseMeta } from '../../types/aqi';
import type { CitySummary, StationWithAQI } from '../../types/station';

interface HomePageProps {
  stations: readonly StationWithAQI[];
  cities: readonly CitySummary[];
  meta: AQIResponseMeta;
  isLoading: boolean;
  error: string | null;
}

export function HomePage({
  stations,
  cities,
  meta,
  isLoading,
  error,
}: HomePageProps) {
  const { status: locationStatus, nearest, message, detectLocation, resetLocation } =
    useLocation();
  const [manualStation, setManualStation] = useState<StationWithAQI | null>(null);
  const [selectionSubtitle, setSelectionSubtitle] = useState<string | null>(null);

  const activeStation =
    locationStatus === 'found' && nearest ? nearest.station : manualStation;
  const activeDistance =
    locationStatus === 'found' && nearest ? nearest.distanceKm : null;
  const activeSubtitle =
    locationStatus === 'found' && nearest
      ? 'Nearest Monitoring Station'
      : selectionSubtitle;

  const handleUseMyLocation = () => {
    setManualStation(null);
    setSelectionSubtitle(null);
    detectLocation(stations);
  };

  const handleSelectCity = (city: CitySummary) => {
    resetLocation();
    setManualStation(city.primaryStation);
    setSelectionSubtitle(`Selected City • ${city.stationCount} station${city.stationCount === 1 ? '' : 's'}`);
  };

  const handleSelectStation = (station: StationWithAQI) => {
    resetLocation();
    setManualStation(station);
    setSelectionSubtitle('Selected Monitoring Station');
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-medium text-amber-900"
        >
          <AlertCircle className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          {error}
        </div>
      )}

      <Hero
        stations={stations}
        cities={cities}
        meta={meta}
        isLoading={isLoading}
        locationStatus={locationStatus}
        locationMessage={message}
        selectedStation={activeStation}
        distanceKm={activeDistance}
        selectionSubtitle={activeSubtitle}
        onUseMyLocation={handleUseMyLocation}
        onSelectCity={handleSelectCity}
        onSelectStation={handleSelectStation}
      />

      <TrustStrip />
      <PersonalSection />
    </>
  );
}
