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
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="visually-hidden fixed top-3 left-3 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
      >
        Skip to main content
      </a>

      <Header dataStatus={dataStatus} />

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <Footer />
    </div>
  );
}
