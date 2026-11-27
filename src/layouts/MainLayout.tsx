import type { ReactNode } from 'react';
import type { DataStatus } from '../types/aqi';
import { Footer } from '../components/Footer/Footer';
import { Header } from '../components/Header/Header';

interface MainLayoutProps {
  dataStatus: DataStatus;
  children: ReactNode;
}

export function MainLayout({ dataStatus, children }: MainLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-[#fafcfe] text-slate-900">
      {/* Subtle Atmospheric Ambient Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {/* Soft sky-blue & mint-green atmospheric gradients */}
        <div className="absolute -top-32 -left-24 h-[460px] w-[460px] rounded-full bg-sky-200/25 blur-3xl" />
        <div className="absolute top-12 right-[-8%] h-[420px] w-[420px] rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[380px] w-[520px] rounded-full bg-teal-100/20 blur-3xl" />

        {/* Minimal abstract airflow curves & atmospheric particles */}
        <svg
          viewBox="0 0 1440 700"
          fill="none"
          preserveAspectRatio="xMidYMin slice"
          className="h-full w-full opacity-[0.38]"
        >
          <path
            d="M-60 155C220 95 430 225 740 165C1020 110 1230 185 1500 125"
            stroke="url(#o2-air-flow-1)"
            strokeWidth="1.25"
          />
          <path
            d="M-40 245C270 190 520 295 860 225C1130 170 1310 240 1500 195"
            stroke="url(#o2-air-flow-2)"
            strokeWidth="1"
          />
          <path
            d="M120 420C390 360 660 470 980 395C1190 345 1350 405 1500 365"
            stroke="url(#o2-air-flow-1)"
            strokeWidth="0.9"
            strokeDasharray="4 6"
          />
          <circle cx="195" cy="138" r="2.2" fill="#10B981" fillOpacity="0.28" />
          <circle cx="510" cy="186" r="1.8" fill="#0EA5E9" fillOpacity="0.26" />
          <circle cx="940" cy="142" r="2.5" fill="#14B8A6" fillOpacity="0.24" />
          <circle cx="1265" cy="176" r="2" fill="#0EA5E9" fillOpacity="0.25" />
          <circle cx="340" cy="398" r="2" fill="#10B981" fillOpacity="0.2" />
          <circle cx="1115" cy="378" r="2.2" fill="#14B8A6" fillOpacity="0.2" />
          <defs>
            <linearGradient id="o2-air-flow-1" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="0.35" stopColor="#38BDF8" stopOpacity="0.22" />
              <stop offset="0.7" stopColor="#10B981" stopOpacity="0.2" />
              <stop offset="1" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="o2-air-flow-2" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" stopOpacity="0" />
              <stop offset="0.4" stopColor="#14B8A6" stopOpacity="0.18" />
              <stop offset="0.75" stopColor="#0EA5E9" stopOpacity="0.18" />
              <stop offset="1" stopColor="#0EA5E9" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <a
        href="#main-content"
        className="visually-hidden fixed top-3 left-3 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
      >
        Skip to main content
      </a>

      <Header dataStatus={dataStatus} />

      <main id="main-content" tabIndex={-1} className="relative z-10 flex-1 outline-none">
        {children}
      </main>

      <Footer />
    </div>
  );
}
