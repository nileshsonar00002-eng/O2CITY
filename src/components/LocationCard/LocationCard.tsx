import { ArrowRight, LocateFixed, Lock, MapPin, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { LocationStatus } from '../../hooks/useLocation';
import type { CitySummary } from '../../types/station';
import { getAQIMetaByValue } from '../../utils/aqi';

interface LocationCardProps {
  cities: readonly CitySummary[];
  locationStatus: LocationStatus;
  locationMessage: string | null;
  isDataLoading: boolean;
  onUseMyLocation: () => void;
  onSelectCity: (city: CitySummary) => void;
}

export function LocationCard({
  cities,
  locationStatus,
  locationMessage,
  isDataLoading,
  onUseMyLocation,
  onSelectCity,
}: LocationCardProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 6);
    return cities
      .filter(
        (c) =>
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q)
      )
      .slice(0, 7);
  }, [cities, query]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      const match = suggestions[0]!;
      onSelectCity(match);
      setQuery(match.city);
      setIsOpen(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md shadow-slate-900/5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span>Find Your Location</span>
      </div>

      <button
        type="button"
        onClick={onUseMyLocation}
        disabled={locationStatus === 'locating' || isDataLoading}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        <span>
          {locationStatus === 'locating'
            ? 'Finding your nearest station...'
            : 'Use My Location'}
        </span>
      </button>

      {locationMessage && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2.5 rounded-lg px-3 py-2 text-xs font-medium ${
            locationStatus === 'denied' || locationStatus === 'error'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-slate-50 text-slate-600'
          }`}
        >
          {locationMessage}
        </p>
      )}

      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 uppercase">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <label htmlFor="hero-city-search" className="visually-hidden">
          Search your city
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="hero-city-search"
              type="search"
              value={query}
              onFocus={() => setIsOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsOpen(false), 160);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="Search your city..."
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            aria-label="Search city"
            disabled={suggestions.length === 0}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-emerald-600 px-3.5 text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {isOpen && cities.length > 0 && (
          <ul
            role="listbox"
            aria-label="Matching Indian cities"
            className="absolute right-0 left-0 z-20 mt-1.5 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">
                No matching monitored cities found.
              </li>
            ) : (
              suggestions.map((city) => {
                const meta = getAQIMetaByValue(city.averageAqi);
                return (
                  <li key={`${city.city}-${city.state}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectCity(city);
                        setQuery(city.city);
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                    >
                      <span>
                        <span className="font-medium text-slate-900">{city.city}</span>
                        <span className="ml-1.5 text-xs text-slate-500">{city.state}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.bgClass} ${meta.textClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                        {city.averageAqi !== null ? city.averageAqi : '—'}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </form>

      <p className="mt-3.5 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        <span>Your location privacy matters</span>
      </p>
    </div>
  );
}
