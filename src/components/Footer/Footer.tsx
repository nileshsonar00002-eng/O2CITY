import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900">
                <span className="h-3 w-3 rounded-full border-2 border-emerald-400" />
              </span>
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                O2CITY
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Know Your Air. Live Better. Real-time Indian air-quality monitoring.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/" className="text-slate-600 hover:text-slate-900">
              Home
            </Link>
            <Link to="/map" className="text-slate-600 hover:text-slate-900">
              India AQI Map
            </Link>
            <Link to="/analytics" className="text-slate-600 hover:text-slate-900">
              Analytics
            </Link>
            <Link to="/about" className="text-slate-600 hover:text-slate-900">
              About
            </Link>
            <Link to="/help" className="text-slate-600 hover:text-slate-900">
              Help
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>
            Data sourced via official CPCB / data.gov.in monitoring feeds. Values are
            provided for informational awareness.
          </p>
          <p className="inline-flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Privacy-first: your GPS coordinates are never stored.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
