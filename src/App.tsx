import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAQI } from './hooks/useAQI';
import { MainLayout } from './layouts/MainLayout';
import { AboutPage } from './pages/About/AboutPage';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { HelpPage } from './pages/Help/HelpPage';
import { HomePage } from './pages/Home/HomePage';
import { MapPage } from './pages/Map/MapPage';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'O2CITY — Know Your Air. Live Better.',
  '/map': 'India AQI Map | O2CITY',
  '/analytics': 'Analytics | O2CITY',
  '/about': 'About | O2CITY',
  '/help': 'Help | O2CITY',
};

function AppRoutes() {
  const location = useLocation();
  const { stations, cities, meta, isLoading, error, refresh } = useAQI();

  useEffect(() => {
    document.title = ROUTE_TITLES[location.pathname] ?? ROUTE_TITLES['/']!;
  }, [location.pathname]);

  return (
    <MainLayout dataStatus={meta.dataStatus}>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              stations={stations}
              cities={cities}
              meta={meta}
              isLoading={isLoading}
              error={error}
            />
          }
        />
        <Route
          path="/map"
          element={
            <MapPage
              stations={stations}
              cities={cities}
              meta={meta}
              isLoading={isLoading}
              onRefresh={refresh}
            />
          }
        />
        <Route
          path="/analytics"
          element={
            <AnalyticsPage
              stations={stations}
              cities={cities}
              meta={meta}
              isLoading={isLoading}
            />
          }
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
