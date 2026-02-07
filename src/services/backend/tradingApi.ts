import type { Order, TradeRecord } from '@/types';
import { backendFetch } from './http';

export async function apiPlaceOrder(payload: {
  symbol: string;
  name: string;
  assetType: 'crypto' | 'forex';
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
}): Promise<{ order: Order; warnings?: string[] }> {
  return backendFetch<{ order: Order; warnings?: string[] }>('/api/v2/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiClosePosition(positionId: string, currentPrice: number): Promise<{ trade: TradeRecord }> {
  return backendFetch<{ trade: TradeRecord }>(`/api/v2/positions/${encodeURIComponent(positionId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ currentPrice }),
  });
}

export async function apiCancelOrder(orderId: string): Promise<void> {
  await backendFetch(`/api/v2/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });
}

export async function apiFetchPortfolio() {
  return backendFetch<{
    virtualBalance: number;
    totalDeposited: number;
    positions: Record<string, unknown>[];
    orders: Record<string, unknown>[];
    tradeHistory: Record<string, unknown>[];
    balanceHistory: Record<string, unknown>[];
  }>('/api/v2/portfolio', {
    method: 'GET',
  });
}
