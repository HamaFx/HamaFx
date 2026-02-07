// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSettingsStore } from '@/stores/settingsStore';

vi.mock('@/components/ui/ToastContainer', () => ({
  showToast: vi.fn(),
  default: () => null,
}));

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function setTestUser(id: string) {
  useAuthStore.setState({
    user: {
      id,
      email: `${id}@test.local`,
      username: id,
      passwordHash: 'hash',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    isAuthenticated: true,
  });
}

describe('portfolioStore integration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());

    setTestUser('integration-user');
    useSettingsStore.getState().loadUserSettings();
    usePortfolioStore.getState().loadPortfolio();
    usePortfolioStore.getState().resetPortfolio();
    usePortfolioStore.getState().loadPortfolio();
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('executes buy then oversized sell with correct partial-fill fee accounting', () => {
    const store = usePortfolioStore.getState();

    const buy = store.placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'buy',
      type: 'market',
      quantity: 5,
      price: 100,
    });
    expect(buy.success).toBe(true);

    const sell = usePortfolioStore.getState().placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'sell',
      type: 'market',
      quantity: 10,
      price: 110,
    });
    expect(sell.success).toBe(true);

    const state = usePortfolioStore.getState();
    expect(state.positions).toHaveLength(0);

    // Expected:
    // buy fill @ 100.01 -> total 500.05, fee 0.50 => balance 99499.45
    // sell fills only 5 @ 109.989 -> total 549.945, fee 0.55 => +549.395
    expect(state.virtualBalance).toBeCloseTo(100048.85, 2);

    const latestTrade = state.tradeHistory[0];
    expect(latestTrade.side).toBe('sell');
    expect(latestTrade.quantity).toBe(5);
    expect(latestTrade.fee).toBeCloseTo(0.55, 2);
  });

  it('handles short position lifecycle with consistent portfolio value', () => {
    const openShort = usePortfolioStore.getState().placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'sell',
      type: 'market',
      quantity: 2,
      price: 100,
    });
    expect(openShort.success).toBe(true);

    const afterOpen = usePortfolioStore.getState();
    expect(afterOpen.positions).toHaveLength(1);
    expect(afterOpen.positions[0].side).toBe('short');

    // Short proceeds credited, but total equity should account for short liability.
    expect(afterOpen.virtualBalance).toBeCloseTo(100199.78, 2);
    expect(afterOpen.getTotalValue()).toBeCloseTo(99999.8, 1);

    usePortfolioStore.getState().updatePositionPrices({ BTC: 90 });
    const afterPriceMove = usePortfolioStore.getState();
    expect(afterPriceMove.getTotalValue()).toBeGreaterThan(100000);

    const close = usePortfolioStore
      .getState()
      .closePosition(afterPriceMove.positions[0].id, 90);
    expect(close.success).toBe(true);

    const finalState = usePortfolioStore.getState();
    expect(finalState.positions).toHaveLength(0);
    expect(finalState.virtualBalance).toBeCloseTo(100019.58, 2);
    expect(finalState.getTotalValue()).toBeCloseTo(finalState.virtualBalance, 2);
  });

  it('fills pending limit orders when price condition is met', () => {
    const pending = usePortfolioStore.getState().placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      price: 90,
    });
    expect(pending.success).toBe(true);

    expect(usePortfolioStore.getState().orders.filter(o => o.status === 'pending')).toHaveLength(1);

    usePortfolioStore.getState().checkPendingOrders({ BTC: 89 });

    const state = usePortfolioStore.getState();
    expect(state.orders.some(o => o.status === 'filled')).toBe(true);
    expect(state.positions.length).toBeGreaterThan(0);
  });

  it('migrates legacy scoped portfolio keys to canonical keys', () => {
    setTestUser('migrate-user');
    localStorage.setItem('nexus_portfolio_migrate-user', JSON.stringify({
      virtualBalance: 123456,
      totalDeposited: 100000,
      positions: [],
      orders: [],
      balanceHistory: [],
    }));
    localStorage.setItem('nexus_trades_migrate-user', JSON.stringify([]));

    usePortfolioStore.getState().loadPortfolio();
    const state = usePortfolioStore.getState();
    expect(state.virtualBalance).toBe(123456);
    expect(state.tradeHistory).toEqual([]);

    expect(localStorage.getItem('hamafx_portfolio_migrate-user')).not.toBeNull();
    expect(localStorage.getItem('hamafx_trades_migrate-user')).toBe('[]');

    const placed = usePortfolioStore.getState().placeOrder({
      symbol: 'EURUSD',
      name: 'Euro / US Dollar',
      assetType: 'forex',
      side: 'buy',
      type: 'market',
      quantity: 100,
      price: 1.1,
    });
    expect(placed.success).toBe(true);
    expect(localStorage.getItem('hamafx_portfolio_migrate-user')).toContain('"orders"');
  });

  it('blocks market orders that exceed max position size guardrail', () => {
    useSettingsStore.getState().updateSettings({
      trading: {
        ...useSettingsStore.getState().settings.trading,
        maxPositionSizePercent: 1,
      },
    });

    const result = usePortfolioStore.getState().placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'buy',
      type: 'market',
      quantity: 2000,
      price: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('max position size exceeded');
    expect(usePortfolioStore.getState().positions).toHaveLength(0);
    expect(useAuthStore.getState().auditLog.some((entry) => entry.action === 'RISK_GUARDRAIL_BLOCKED')).toBe(true);
  });

  it('expires pending fills when guardrails block execution at trigger time', () => {
    const pending = usePortfolioStore.getState().placeOrder({
      symbol: 'BTC',
      name: 'Bitcoin',
      assetType: 'crypto',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      price: 90,
    });
    expect(pending.success).toBe(true);
    expect(pending.order).toBeDefined();

    useSettingsStore.getState().updateSettings({
      trading: {
        ...useSettingsStore.getState().settings.trading,
        maxOpenPositions: 0,
      },
    });

    usePortfolioStore.getState().checkPendingOrders({ BTC: 89 });

    const storedOrder = usePortfolioStore
      .getState()
      .orders.find((order) => order.id === pending.order?.id);
    expect(storedOrder?.status).toBe('expired');
    expect(storedOrder?.statusReason).toContain('Risk guardrail blocked this order');
    expect(usePortfolioStore.getState().positions).toHaveLength(0);
    expect(useAuthStore.getState().auditLog.some((entry) => entry.action === 'RISK_GUARDRAIL_BLOCKED')).toBe(true);
  });
});
