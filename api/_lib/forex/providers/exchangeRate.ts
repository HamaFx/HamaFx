export interface UsdRatesSnapshot {
  rates: Record<string, number>;
  source: 'exchange_rate_api' | 'frankfurter';
  lastUpdated: string;
}

interface ExchangeRatePayload {
  result?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

export async function fetchExchangeRateUsdRates(): Promise<UsdRatesSnapshot> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!response.ok) {
    throw new Error(`exchange_rate_api_http_${response.status}`);
  }

  const payload = (await response.json()) as ExchangeRatePayload;
  if (!payload.rates || Object.keys(payload.rates).length === 0) {
    throw new Error('exchange_rate_api_missing_rates');
  }

  const updatedAt = payload.time_last_update_unix
    ? new Date(payload.time_last_update_unix * 1000)
    : new Date();

  return {
    rates: payload.rates,
    source: 'exchange_rate_api',
    lastUpdated: updatedAt.toISOString(),
  };
}
