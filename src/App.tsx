import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ToastContainer from '@/components/ui/ToastContainer';
import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { useChatStore } from '@/stores/chatStore';
import { startBackendSyncSubscriptions, pullBackendState, shouldPullRemoteState, shouldPushRemoteState } from '@/services/backend/stateSync';

// Pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Markets = lazy(() => import('@/pages/Markets'));
const Login = lazy(() => import('@/pages/Login'));
const Settings = lazy(() => import('@/pages/Settings'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const News = lazy(() => import('@/pages/News'));
const CalendarPage = lazy(() => import('@/pages/Calendar'));
const AlertsPage = lazy(() => import('@/pages/Alerts'));
const BacktestPage = lazy(() => import('@/pages/Backtest'));
const AssetDetail = lazy(() => import('@/pages/AssetDetail'));
const WatchlistPage = lazy(() => import('@/pages/Watchlist'));
const HeatmapPage = lazy(() => import('@/pages/HeatmapPage').then((module) => ({ default: module.HeatmapPage })));
const RiskDashboard = lazy(() => import('@/pages/RiskDashboard'));
const MultiChart = lazy(() => import('@/pages/MultiChart'));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="markets" element={<Markets />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="news" element={<News />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="backtest" element={<BacktestPage />} />
        <Route path="heatmap" element={<HeatmapPage />} />
        <Route path="terminal" element={<MultiChart />} />
        <Route path="risk" element={<RiskDashboard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="asset/:id" element={<AssetDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const { loadUserSettings } = useSettingsStore();
  const { loadPortfolio } = usePortfolioStore();
  const { loadWatchlists } = useWatchlistStore();
  const { loadAlerts } = useAlertStore();
  const { loadMessages } = useChatStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    void import('@/pages/Login');
    void import('@/pages/Dashboard');
  }, []);

  useEffect(() => {
    loadUserSettings();
    loadMessages();
    if (!isAuthenticated) return;

    if (shouldPullRemoteState()) {
      void pullBackendState().catch(() => {
        // Fall back to local state if backend sync is unavailable.
        loadPortfolio();
        loadWatchlists();
        loadAlerts();
      });
      return;
    }

    loadPortfolio();
    loadWatchlists();
    loadAlerts();
  }, [isAuthenticated, loadUserSettings, loadMessages, loadPortfolio, loadWatchlists, loadAlerts]);

  useEffect(() => {
    if (!isAuthenticated || !shouldPushRemoteState()) return;
    const stop = startBackendSyncSubscriptions();
    return stop;
  }, [isAuthenticated]);

  return (
    <HashRouter>
      <Suspense fallback={<RouteFallback />}>
        <AppRoutes />
      </Suspense>
      <ToastContainer />
    </HashRouter>
  );
}
