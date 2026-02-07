import type { AppSettings } from '@/types';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { backendMode, isBackendEnabled, isBackendOn, isBackendShadow } from './config';
import { backendFetch } from './http';

type BackendStatePayload = {
  settings: AppSettings;
  portfolio: {
    virtualBalance: number;
    totalDeposited: number;
    positions: Record<string, unknown>[];
    orders: Record<string, unknown>[];
    tradeHistory: Record<string, unknown>[];
    balanceHistory: Record<string, unknown>[];
  };
  watchlists: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  chatMessages: Record<string, unknown>[];
};

function gatherState(): BackendStatePayload {
  const settingsStore = useSettingsStore.getState();
  const portfolioStore = usePortfolioStore.getState();
  const watchlistStore = useWatchlistStore.getState();
  const alertStore = useAlertStore.getState();
  const chatStore = useChatStore.getState();

  return {
    settings: settingsStore.settings,
    portfolio: {
      virtualBalance: portfolioStore.virtualBalance,
      totalDeposited: portfolioStore.totalDeposited,
      positions: portfolioStore.positions as unknown as Record<string, unknown>[],
      orders: portfolioStore.orders as unknown as Record<string, unknown>[],
      tradeHistory: portfolioStore.tradeHistory as unknown as Record<string, unknown>[],
      balanceHistory: portfolioStore.balanceHistory as unknown as Record<string, unknown>[],
    },
    watchlists: watchlistStore.watchlists as unknown as Record<string, unknown>[],
    alerts: alertStore.alerts as unknown as Record<string, unknown>[],
    chatMessages: chatStore.messages as unknown as Record<string, unknown>[],
  };
}

function applyState(remote: {
  settings: AppSettings;
  portfolio: BackendStatePayload['portfolio'];
  watchlists: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  chatMessages: Record<string, unknown>[];
  auditEvents?: Record<string, unknown>[];
}) {
  useSettingsStore.setState({ settings: remote.settings });
  useSettingsStore.getState().initTheme();
  usePortfolioStore.setState({
    virtualBalance: remote.portfolio.virtualBalance,
    totalDeposited: remote.portfolio.totalDeposited,
    positions: remote.portfolio.positions as never,
    orders: remote.portfolio.orders as never,
    tradeHistory: remote.portfolio.tradeHistory as never,
    balanceHistory: remote.portfolio.balanceHistory as never,
  });
  useWatchlistStore.setState({ watchlists: remote.watchlists as never });
  useAlertStore.setState({ alerts: remote.alerts as never });
  useChatStore.setState({ messages: remote.chatMessages as never });

  if (remote.auditEvents) {
    useAuthStore.setState({ auditLog: remote.auditEvents as never });
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

export async function pullBackendState(): Promise<void> {
  if (!isBackendEnabled()) return;
  const data = await backendFetch<{
    settings: AppSettings;
    portfolio: BackendStatePayload['portfolio'];
    watchlists: Record<string, unknown>[];
    alerts: Record<string, unknown>[];
    chatMessages: Record<string, unknown>[];
    auditEvents?: Record<string, unknown>[];
  }>('/api/v2/state', { method: 'GET' });
  applyState(data);
}

export async function pushBackendState(): Promise<void> {
  if (!isBackendEnabled()) return;
  if (syncing) return;

  syncing = true;
  try {
    const payload = gatherState();
    await backendFetch('/api/v2/state', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } finally {
    syncing = false;
  }
}

export function scheduleBackendSync(delayMs = 1200): void {
  if (!isBackendEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void pushBackendState();
  }, delayMs);
}

export function startBackendSyncSubscriptions(): () => void {
  if (!isBackendEnabled()) return () => {};

  const unsubscribers = [
    useSettingsStore.subscribe(() => scheduleBackendSync()),
    usePortfolioStore.subscribe(() => scheduleBackendSync()),
    useWatchlistStore.subscribe(() => scheduleBackendSync()),
    useAlertStore.subscribe(() => scheduleBackendSync()),
    useChatStore.subscribe(() => scheduleBackendSync()),
  ];

  return () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export async function runMigrationImport(dryRun = true) {
  const auth = useAuthStore.getState();
  const payload = {
    dryRun,
    ...gatherState(),
    auditEvents: auth.auditLog as unknown as Record<string, unknown>[],
  };

  return backendFetch<{ dryRun: boolean; imported: Record<string, number> }>('/api/v2/migrate/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function backendModeLabel() {
  return backendMode;
}

export function shouldPullRemoteState() {
  return isBackendOn();
}

export function shouldPushRemoteState() {
  return isBackendOn() || isBackendShadow();
}
