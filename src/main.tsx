import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import AppShell from './components/AppShell';
import { Spinner } from './components/ui';
import { bootstrapTheme } from './store';
import './index.css';

/**
 * Routing uses a hash router on purpose.
 *
 * GitHub Pages serves static files only — it has no rewrite rule, so a deep
 * link like `/labels` would 404 on refresh with a browser router. A hash
 * router keeps every route shareable and refresh-safe on any static host,
 * with no 404.html redirect hack.
 */

// Each studio pulls in its own heavy engine (bwip-js, jsPDF, xlsx). Splitting
// them keeps the first paint on the dashboard fast.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QrStudio = lazy(() => import('./pages/QrStudio'));
const BarcodeStudio = lazy(() => import('./pages/BarcodeStudio'));
const Bulk = lazy(() => import('./pages/Bulk'));
const Labels = lazy(() => import('./pages/Labels'));
const Scanner = lazy(() => import('./pages/Scanner'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="muted flex items-center justify-center gap-2.5 py-24 text-[13px]">
      <Spinner />
      Loading…
    </div>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'qr', element: <QrStudio /> },
      { path: 'barcode', element: <BarcodeStudio /> },
      { path: 'bulk', element: <Bulk /> },
      { path: 'labels', element: <Labels /> },
      { path: 'scan', element: <Scanner /> },
      { path: 'history', element: <HistoryPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

bootstrapTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<PageFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
