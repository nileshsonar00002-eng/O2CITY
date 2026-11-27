import { Globe2, HeartPulse, ShieldCheck, Zap } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Trusted Data',
    description: 'Official air-quality sources',
  },
  {
    icon: Zap,
    title: 'Real-Time Updates',
    description: 'Latest available readings',
  },
  {
    icon: HeartPulse,
    title: 'Health-Focused',
    description: 'Understand what AQI means',
  },
  {
    icon: Globe2,
    title: 'Across India',
    description: 'Explore monitoring stations',
  },
] as const;

export function TrustStrip() {
  return (
    <section aria-label="Platform highlights" className="border-y border-slate-200/60 bg-white/75 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 text-emerald-700 ring-1 ring-emerald-200/50">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    {item.title}
                  </h2>
                  <p className="text-xs text-slate-600">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
