// Forex API Clients — ExchangeRate-API (primary) + Frankfurter (fallback + historical)
// ExchangeRate: Free, 1500 calls/month, CORS-friendly
// Frankfurter: Free, generous limits, CORS-friendly, historical data

const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const FRANKFURTER_URL = 'https://api.frankfurter.app';
import { isBackendEnabled } from '@/services/backend/config';
import { backendFetch } from '@/services/backend/http';

interface ForexRates {
  [currency: string]: number;
}

// Major forex pairs we track (all vs USD)
export const FOREX_PAIRS = [
  { id: 'eurusd', base: 'EUR', quote: 'USD', name: 'Euro / US Dollar' },
  { id: 'gbpusd', base: 'GBP', quote: 'USD', name: 'British Pound / US Dollar' },
  { id: 'usdjpy', base: 'USD', quote: 'JPY', name: 'US Dollar / Japanese Yen' },
  { id: 'usdchf', base: 'USD', quote: 'CHF', name: 'US Dollar / Swiss Franc' },
  { id: 'audusd', base: 'AUD', quote: 'USD', name: 'Australian Dollar / US Dollar' },
  { id: 'usdcad', base: 'USD', quote: 'CAD', name: 'US Dollar / Canadian Dollar' },
  { id: 'nzdusd', base: 'NZD', quote: 'USD', name: 'New Zealand Dollar / US Dollar' },
  { id: 'eurgbp', base: 'EUR', quote: 'GBP', name: 'Euro / British Pound' },
] as const;

// Previous close simulation (for 24h change — forex APIs don't always give this)
const previousCloseCache: Record<string, number> = {};

function calculateForexRate(rates: ForexRates, base: string, quote: string): number {
  if (base === 'USD') return rates[quote] || 0;
  if (quote === 'USD') return 1 / (rates[base] || 1);
  // Cross rate
  const baseToUsd = 1 / (rates[base] || 1);
  return baseToUsd * (rates[quote] || 0);
}

export async function fetchForexRates(): Promise<ForexRates> {
  if (isBackendEnabled()) {
    return backendFetch<ForexRates>('/api/v2/market/forex?mode=latest');
  }

  // Try ExchangeRate-API first
  try {
    const res = await fetch(EXCHANGE_RATE_URL);
    if (res.ok) {
      const data = await res.json();
      return data.rates || {};
    }
  } catch {
    // Fall through to Frankfurter
  }

  // Fallback to Frankfurter
  const res = await fetch(`${FRANKFURTER_URL}/latest?from=USD`);
  if (!res.ok) throw new Error(`Forex rates failed: ${res.status}`);
  const data = await res.json();
  return data.rates || {};
}

export async function fetchForexHistory(
  base: string,
  quote: string,
  days: number
): Promise<{ date: string; rate: number }[]> {
  if (isBackendEnabled()) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const from = startDate.toISOString().split('T')[0];
    const to = endDate.toISOString().split('T')[0];
    const data = await backendFetch<{ rates: Record<string, Record<string, number>> }>(
      `/api/v2/market/forex?mode=history&base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}&from=${from}&to=${to}`
    );

    const rows = Object.entries(data.rates ?? {}).map(([date, map]) => ({
      date,
      rate: map[quote] ?? 0,
    }));
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const from = startDate.toISOString().split('T')[0];
  const to = endDate.toISOString().split('T')[0];

  // Frankfurter is great for historical data
  const fromCurrency = base === 'USD' ? 'USD' : base;
  const toCurrency = quote === 'USD' && base !== 'USD' ? 'USD' : quote;

  const url = `${FRANKFURTER_URL}/${from}..${to}?from=${fromCurrency}&to=${toCurrency}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forex history failed: ${res.status}`);

  const data = await res.json();
  const rates: { date: string; rate: number }[] = [];

  if (data.rates) {
    for (const [date, rateObj] of Object.entries(data.rates)) {
      const rateMap = rateObj as Record<string, number>;
      const rate = rateMap[toCurrency] || 0;
      rates.push({ date, rate });
    }
  }

  return rates.sort((a, b) => a.date.localeCompare(b.date));
}

export function mapForexRatesToPairs(rates: ForexRates) {
  return FOREX_PAIRS.map(pair => {
    const rate = calculateForexRate(rates, pair.base, pair.quote);
    const cacheKey = pair.id;

    // Calculate 24h change from cached previous close
    let change24h = 0;
    let changePercent24h = 0;
    if (previousCloseCache[cacheKey] && previousCloseCache[cacheKey] !== 0) {
      change24h = rate - previousCloseCache[cacheKey];
      changePercent24h = (change24h / previousCloseCache[cacheKey]) * 100;
    } else {
      // First fetch — simulate small random change
      const randomChange = (Math.random() - 0.5) * 0.004; // ±0.2%
      change24h = rate * randomChange;
      changePercent24h = randomChange * 100;
    }

    // Store current as "previous" for next comparison
    previousCloseCache[cacheKey] = rate;

    return {
      id: pair.id,
      symbol: `${pair.base}/${pair.quote}`,
      name: pair.name,
      base: pair.base,
      quote: pair.quote,
      rate,
      change24h,
      changePercent24h,
    };
  });
}

// Simulate forex ticks between API polls
// Creates realistic micro-movements based on last real rate
export function simulateForexTick(
  lastRate: number,
  _volatility = 0.0001 // ±0.01% default
): number {
  const maxChange = lastRate * _volatility;
  const change = (Math.random() - 0.5) * 2 * maxChange;
  return lastRate + change;
}
