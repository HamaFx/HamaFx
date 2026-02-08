import type { UsdRatesSnapshot } from './exchangeRate.js';

interface FrankfurterLatest {
  date?: string;
  rates?: Record<string, number>;
}

interface FrankfurterHistory {
  rates?: Record<string, Record<string, number>>;
}

export async function fetchFrankfurterUsdRates(date?: string): Promise<UsdRatesSnapshot> {
  const endpoint = date
    ? `https://api.frankfurter.app/${encodeURIComponent(date)}?from=USD`
    : 'https://api.frankfurter.app/latest?from=USD';

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`frankfurter_latest_http_${response.status}`);
  }

  const payload = (await response.json()) as FrankfurterLatest;
  if (!payload.rates || Object.keys(payload.rates).length === 0) {
    throw new Error('frankfurter_latest_missing_rates');
  }

  const updatedAt = payload.date ? new Date(`${payload.date}T00:00:00.000Z`) : new Date();

  return {
    rates: payload.rates,
    source: 'frankfurter',
    lastUpdated: updatedAt.toISOString(),
  };
}

export async function fetchFrankfurterHistory(
  base: string,
  quote: string,
  from: string,
  to: string
): Promise<Record<string, Record<string, number>>> {
  const endpoint = `https://api.frankfurter.app/${from}..${to}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`frankfurter_history_http_${response.status}`);
  }

  const payload = (await response.json()) as FrankfurterHistory;
  return payload.rates ?? {};
}
