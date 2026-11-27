import { BarChart3, Leaf, MapPin } from 'lucide-react';

const PERSONAL_CARDS = [
  {
    icon: MapPin,
    title: 'Your Location',
    description: 'Find the nearest monitoring station.',
  },
  {
    icon: BarChart3,
    title: 'Understand Your AQI',
    description: 'See pollutants and trends clearly.',
  },
  {
    icon: Leaf,
    title: 'Make Better Decisions',
    description: 'Know when outdoor activity may be better.',
  },
] as const;

export function PersonalSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Air Quality, Made Personal.
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            Your location. Your air. Your decision.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PERSONAL_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-xs backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 text-emerald-700 ring-1 ring-emerald-200/50">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-slate-900">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
