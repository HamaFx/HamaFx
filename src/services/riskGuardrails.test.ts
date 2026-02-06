import { describe, expect, it } from 'vitest';
import { evaluateOrderRisk } from '@/services/riskGuardrails';
import type { Position, TradeRecord } from '@/types';

const defaultSettings = {
  enableRiskGuardrails: true,
  maxPositionSizePercent: 25,
  maxDailyLossPercent: 5,
  maxOpenPositions: 8,
  warnOnConcentration: true,
};

function createPosition(overrides: Partial<Position>): Position {
  return {
    id: 'pos-1',
    symbol: 'BTC',
    name: 'Bitcoin',
    assetType: 'crypto',
    side: 'long',
    quantity: 1,
    entryPrice: 100,
    currentPrice: 100,
    openedAt: new Date().toISOString(),
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0,
    ...overrides,
  };
}

function createTrade(overrides: Partial<TradeRecord>): TradeRecord {
  return {
    id: 'trade-1',
    userId: 'u1',
    symbol: 'BTC',
    assetType: 'crypto',
    side: 'sell',
    type: 'market',
    quantity: 1,
    price: 100,
    total: 100,
    fee: 0.1,
    executedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('riskGuardrails', () => {
  it('hard blocks when projected position size exceeds limit', () => {
    const result = evaluateOrderRisk({
      symbol: 'BTC',
      side: 'buy',
      quantity: 300,
      price: 100,
      virtualBalance: 100000,
      totalDeposited: 100000,
      positions: [],
      tradeHistory: [],
      settings: defaultSettings,
    });

    expect(result.hardBlock).toBe(true);
    expect(result.reasonCodes).toContain('MAX_POSITION_SIZE_EXCEEDED');
  });

  it('hard blocks when daily loss limit is reached', () => {
    const result = evaluateOrderRisk({
      symbol: 'ETH',
      side: 'buy',
      quantity: 1,
      price: 1000,
      virtualBalance: 100000,
      totalDeposited: 100000,
      positions: [],
      tradeHistory: [createTrade({ pnl: -6000 })],
      settings: defaultSettings,
    });

    expect(result.hardBlock).toBe(true);
    expect(result.reasonCodes).toContain('MAX_DAILY_LOSS_EXCEEDED');
  });

  it('ignores previous-day losses for the current daily loss guardrail check', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = evaluateOrderRisk({
      symbol: 'ETH',
      side: 'buy',
      quantity: 1,
      price: 1000,
      virtualBalance: 100000,
      totalDeposited: 100000,
      positions: [],
      tradeHistory: [
        createTrade({ id: 'trade-yesterday', pnl: -8000, executedAt: yesterday.toISOString() }),
        createTrade({ id: 'trade-today', pnl: -4000, executedAt: now.toISOString() }),
      ],
      settings: defaultSettings,
    });

    expect(result.hardBlock).toBe(false);
    expect(result.reasonCodes).not.toContain('MAX_DAILY_LOSS_EXCEEDED');
  });

  it('hard blocks when max open positions is exceeded', () => {
    const positions = Array.from({ length: 8 }).map((_, index) =>
      createPosition({ id: `pos-${index}`, symbol: `A${index}` })
    );

    const result = evaluateOrderRisk({
      symbol: 'NEW',
      side: 'buy',
      quantity: 1,
      price: 100,
      virtualBalance: 100000,
      totalDeposited: 100000,
      positions,
      tradeHistory: [],
      settings: defaultSettings,
    });

    expect(result.hardBlock).toBe(true);
    expect(result.reasonCodes).toContain('MAX_OPEN_POSITIONS_EXCEEDED');
  });

  it('emits warnings without hard block when concentration rises but stays within limits', () => {
    const result = evaluateOrderRisk({
      symbol: 'BTC',
      side: 'buy',
      quantity: 33,
      price: 100,
      virtualBalance: 10000,
      totalDeposited: 10000,
      positions: [],
      tradeHistory: [],
      settings: { ...defaultSettings, maxPositionSizePercent: 40 },
    });

    expect(result.hardBlock).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain('HIGH_POSITION_CONCENTRATION_WARNING');
  });

  it('returns no guardrail action when disabled', () => {
    const result = evaluateOrderRisk({
      symbol: 'BTC',
      side: 'buy',
      quantity: 500,
      price: 100,
      virtualBalance: 100000,
      totalDeposited: 100000,
      positions: [],
      tradeHistory: [],
      settings: { ...defaultSettings, enableRiskGuardrails: false },
    });

    expect(result.hardBlock).toBe(false);
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
