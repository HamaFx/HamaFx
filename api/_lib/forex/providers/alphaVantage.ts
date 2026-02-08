import { getEnv } from '../../env.js';

export interface ProviderCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function getAlphaVantageKey(): string {
  const env = getEnv();
  const key = env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!key) {
    throw new Error('alpha_vantage_key_missing');
  }
  return key;
}

function buildParams(params: Record<string, string>) {
  const url = new URL('https://www.alphavantage.co/query');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function parseTimeSeries(payload: Record<string, unknown>): Record<string, Record<string, string>> | null {
  const key = Object.keys(payload).find((item) => item.includes('Time Series'));
  if (!key) return null;

  const series = payload[key];
  if (!series || typeof series !== 'object') return null;

  return series as Record<string, Record<string, string>>;
}

function parseCandles(series: Record<string, Record<string, string>>, minTimestamp?: number): ProviderCandle[] {
  const rows: ProviderCandle[] = [];

  for (const [time, values] of Object.entries(series)) {
    const ts = Math.floor(new Date(time.replace(' ', 'T') + 'Z').getTime() / 1000);
    if (!Number.isFinite(ts)) continue;
    if (minTimestamp && ts < minTimestamp) continue;

    const open = Number(values['1. open']);
    const high = Number(values['2. high']);
    const low = Number(values['3. low']);
    const close = Number(values['4. close']);

    if ([open, high, low, close].some((value) => !Number.isFinite(value))) continue;
    rows.push({ time: ts, open, high, low, close });
  }

  rows.sort((a, b) => a.time - b.time);
  return rows;
}

export async function fetchAlphaVantageIntradayCandles(
  base: string,
  quote: string,
  interval: '1min' | '5min' | '15min' | '30min' | '60min',
  minTimestamp?: number
): Promise<ProviderCandle[]> {
  const apiKey = getAlphaVantageKey();
  const url = buildParams({
    function: 'FX_INTRADAY',
    from_symbol: base,
    to_symbol: quote,
    interval,
    outputsize: 'full',
    apikey: apiKey,
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`alpha_vantage_intraday_http_${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (typeof payload.Note === 'string') {
    throw new Error('alpha_vantage_rate_limited');
  }

  const series = parseTimeSeries(payload);
  if (!series) {
    throw new Error('alpha_vantage_intraday_missing_series');
  }

  return parseCandles(series, minTimestamp);
}

export async function fetchAlphaVantageDailyCandles(
  base: string,
  quote: string,
  minTimestamp?: number
): Promise<ProviderCandle[]> {
  const apiKey = getAlphaVantageKey();
  const url = buildParams({
    function: 'FX_DAILY',
    from_symbol: base,
    to_symbol: quote,
    outputsize: 'full',
    apikey: apiKey,
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`alpha_vantage_daily_http_${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (typeof payload.Note === 'string') {
    throw new Error('alpha_vantage_rate_limited');
  }

  const series = parseTimeSeries(payload);
  if (!series) {
    throw new Error('alpha_vantage_daily_missing_series');
  }

  return parseCandles(series, minTimestamp);
}
