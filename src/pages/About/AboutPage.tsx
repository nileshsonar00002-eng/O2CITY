import { Database, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { AQI_CATEGORIES } from '../../utils/aqi';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
          About O2CITY
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Know Your Air. Live Better.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          O2CITY is an Indian environmental-technology platform designed to make
          official air-quality data clear, fast, and actionable for everyday outdoor
          decisions.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-slate-900">
            What is O2CITY?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Air quality varies significantly across Indian cities and neighborhoods.
            O2CITY brings together official monitoring station readings into a clean,
            accessible interface so you can check your local Air Quality Index (AQI),
            inspect key pollutants like PM2.5 and PM10, and plan outdoor activities
            safely.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-slate-900">
            How Does AQI Work?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            India&apos;s National Air Quality Index (NAQI) translates complex pollutant
            measurements (PM2.5, PM10, NO₂, SO₂, CO, O₃, and NH₃) into a single
            0–500 scale with six clear health categories:
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="visually-hidden">
                Indian National Air Quality Index categories and health impacts
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th scope="col" className="py-2.5 pr-4">Category</th>
                  <th scope="col" className="py-2.5 pr-4">AQI Range</th>
                  <th scope="col" className="py-2.5">Health Guidance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AQI_CATEGORIES.map((item) => (
                  <tr key={item.category}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.colorHex }}
                          aria-hidden="true"
                        />
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">
                      {item.rangeLabel}
                    </td>
                    <td className="py-3 text-xs text-slate-600">{item.advisory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <Database className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              Where Does Data Come From?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Readings are sourced from official Central Pollution Control Board (CPCB)
              and data.gov.in continuous ambient air-quality monitoring stations across
              India. We never fabricate or smooth over missing readings.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <RefreshCw className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              How Is Station Data Updated?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              A server-side ingestion pipeline fetches upstream CPCB feeds, normalizes
              pollutant concentrations, stores snapshots in Cloud Firestore, and serves
              an optimized cached response to your browser.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-slate-900">
              Privacy &amp; Security Architecture
            </h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                <strong>Location Privacy:</strong> Browser geolocation runs locally in
                your browser only when you click &ldquo;Use My Location&rdquo; to find
                the nearest station. Precise GPS coordinates are not permanently stored.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>
                <strong>Server-Side Credentials:</strong> Upstream data API keys and
                administrative database credentials remain strictly on the server and are
                never shipped in frontend bundles.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>
                <strong>Read-Only Public Data:</strong> Firestore Security Rules block
                all untrusted client writes to monitoring station and AQI collections.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
