// CoinGecko API Client — Primary crypto data source
// Free tier: 10-30 calls/min, no auth required, CORS-friendly

import { isBackendEnabled } from '@/services/backend/config';
import { backendFetch } from '@/services/backend/http';

const BASE_URL = 'https://api.coingecko.com/api/v3';

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  sparkline_in_7d?: { price: number[] };
  last_updated: string;
}

export async function fetchCryptoMarkets(perPage = 25): Promise<CoinGeckoMarketItem[]> {
  if (isBackendEnabled()) {
    return backendFetch<CoinGeckoMarketItem[]>(`/api/v2/market/crypto?mode=markets&perPage=${perPage}`);
  }

  const url = `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=24h`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko markets failed: ${res.status}`);
  return res.json();
}

// Returns array of [timestamp, open, high, low, close]
export async function fetchCryptoOHLC(coinId: string, days: number): Promise<number[][]> {
  if (isBackendEnabled()) {
    return backendFetch<number[][]>(`/api/v2/market/crypto?mode=ohlc&coinId=${encodeURIComponent(coinId)}&days=${days}`);
  }

  const url = `${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko OHLC failed: ${res.status}`);
  return res.json();
}

export async function fetchCryptoChart(coinId: string, days: number): Promise<{ prices: [number, number][] }> {
  if (isBackendEnabled()) {
    return backendFetch<{ prices: [number, number][] }>(`/api/v2/market/crypto?mode=chart&coinId=${encodeURIComponent(coinId)}&days=${days}`);
  }

  const url = `${BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko chart failed: ${res.status}`);
  return res.json();
}

export async function fetchSimplePrice(ids: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number }>> {
  const url = `${BASE_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko simple price failed: ${res.status}`);
  return res.json();
}

export function mapCoinGeckoToAsset(item: CoinGeckoMarketItem) {
  return {
    id: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    assetType: 'crypto' as const,
    price: item.current_price ?? 0,
    change24h: item.price_change_24h ?? 0,
    changePercent24h: item.price_change_percentage_24h ?? 0,
    high24h: item.high_24h ?? 0,
    low24h: item.low_24h ?? 0,
    volume24h: item.total_volume ?? 0,
    marketCap: item.market_cap ?? 0,
    image: item.image,
    sparkline: item.sparkline_in_7d?.price,
    lastUpdated: item.last_updated || new Date().toISOString(),
  };
}
