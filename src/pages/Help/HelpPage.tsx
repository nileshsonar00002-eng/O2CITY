import { HelpCircle } from 'lucide-react';

const FAQS = [
  {
    question: 'What is AQI?',
    answer:
      'AQI stands for Air Quality Index. It is a standardized 0–500 number used in India to communicate how clean or polluted the air currently is and what health effects may be associated with it.',
  },
  {
    question: 'What does PM2.5 mean?',
    answer:
      'PM2.5 refers to fine particulate matter smaller than 2.5 micrometers in diameter — about 30 times thinner than a human hair. Because these particles are so small, they can travel deep into the lungs and bloodstream.',
  },
  {
    question: 'How does location detection work?',
    answer:
      'When you click "Use My Location", your browser asks for permission to share your approximate coordinates. O2CITY compares those coordinates against active monitoring stations to find the closest one to you.',
  },
  {
    question: 'How often is data updated?',
    answer:
      'Monitoring stations typically report hourly averages. O2CITY refreshes its server-side cache regularly so you see the latest available official reading along with the exact time it was updated.',
  },
  {
    question: 'Why can AQI differ between stations?',
    answer:
      'Air quality is strongly influenced by local traffic, construction dust, industrial activity, wind direction, and greenery. Two stations in the same city can report different AQI values depending on their immediate surroundings.',
  },
  {
    question: 'How is my location handled?',
    answer:
      'Your privacy comes first. Your coordinates are used only in-memory on your device to match the nearest monitoring station. O2CITY does not continuously track you or permanently store your GPS location.',
  },
] as const;

export function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
          Help &amp; FAQ
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Understanding Your Air Quality
        </h1>
        <p className="text-base text-slate-600">
          Clear answers to common questions about AQI, pollutants, and how O2CITY works.
        </p>
      </header>

      <div className="mt-10 space-y-4">
        {FAQS.map((item) => (
          <article
            key={item.question}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
          >
            <h2 className="flex items-start gap-2.5 font-display text-lg font-bold text-slate-900">
              <HelpCircle
                className="mt-1 h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>{item.question}</span>
            </h2>
            <p className="mt-2.5 pl-7.5 text-sm leading-relaxed text-slate-600">
              {item.answer}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
