import { withRedisCache } from '../redis.js';
import {
  FOREX_CATALOG,
  formatForexSymbol,
  getForexCatalogPair,
  normalizeForexSymbolInput,
  resolveForexCatalogPairs,
  type ForexCatalogPair,
} from './catalog.js';
import { pipsToPrice, priceToPips, roundForexPrice } from './math.js';
import { getForexSessionSnapshot, type ForexSessionState } from './sessions.js';
import { fetchExchangeRateUsdRates, type UsdRatesSnapshot } from './providers/exchangeRate.js';
import { fetchFrankfurterHistory, fetchFrankfurterUsdRates } from './providers/frankfurter.js';
import {
  fetchAlphaVantageDailyCandles,
  fetchAlphaVantageIntradayCandles,
  type ProviderCandle,
} from './providers/alphaVantage.js';

export type ForexQuoteSource = 'exchange_rate_api' | 'frankfurter' | 'alpha_vantage' | 'derived';
export type ForexCandleQuality = 'provider_ohlc' | 'derived_close_only';

export interface ForexPairDescriptor {
  id: string;
  symbol: string;
  displaySymbol: string;
  base: string;
  quote: string;
  name: string;
  pipSize: number;
  pipetteSize: number;
  displayPrecision: number;
  priceStep: number;
  sessionGroup: string;
  rank: number;
  isMajor: boolean;
  typicalSpreadPips: number;
  aliases: string[];
  marketStatus: ForexSessionState;
  sessionLabel: string;
  sessionNextTransitionAt: string;
}

export interface ForexQuote {
  id: string;
  symbol: string;
  displaySymbol: string;
  name: string;
  base: string;
  quote: string;
  mid: number;
  bid?: number;
  ask?: number;
  spreadPips: number;
  pipMove24h: number;
  change24h: number;
  changePercent24h: number;
  pipSize: number;
  pipetteSize: number;
  displayPrecision: number;
  priceStep: number;
  sessionGroup: string;
  rank: number;
  isMajor: boolean;
  source: ForexQuoteSource;
  stale: boolean;
  marketStatus: ForexSessionState;
  sessionLabel: string;
  sessionNextTransitionAt: string;
  lastUpdated: string;
}

export interface ForexCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ForexCandleSeries {
  symbol: string;
  displaySymbol: string;
  intervalRequested: string;
  intervalUsed: string;
  range: string;
  quality: ForexCandleQuality;
  source: ForexQuoteSource;
  lastUpdated: string;
  candles: ForexCandle[];
}

function getPreviousBusinessDate(date = new Date()): string {
  const out = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  out.setUTCDate(out.getUTCDate() - 1);

  while (out.getUTCDay() === 0 || out.getUTCDay() === 6) {
    out.setUTCDate(out.getUTCDate() - 1);
  }

  return out.toISOString().slice(0, 10);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseRangeToDays(range: string): number {
  const normalized = range.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(d|w|m|y)$/);
  if (!match) return 30;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 30;

  const unit = match[2];
  if (unit === 'd') return value;
  if (unit === 'w') return value * 7;
  if (unit === 'm') return value * 30;
  return value * 365;
}

function computeCrossRate(rates: Record<string, number>, base: string, quote: string): number | null {
  if (base === quote) return 1;

  if (base === 'USD') {
    const usdToQuote = rates[quote];
    return Number.isFinite(usdToQuote) && usdToQuote > 0 ? usdToQuote : null;
  }

  if (quote === 'USD') {
    const usdToBase = rates[base];
    return Number.isFinite(usdToBase) && usdToBase > 0 ? 1 / usdToBase : null;
  }

  const usdToBase = rates[base];
  const usdToQuote = rates[quote];
  if (!Number.isFinite(usdToBase) || !Number.isFinite(usdToQuote) || usdToBase <= 0 || usdToQuote <= 0) {
    return null;
  }

  return usdToQuote / usdToBase;
}

async function getLatestUsdRates(): Promise<UsdRatesSnapshot> {
  const failures: string[] = [];

  try {
    return await fetchExchangeRateUsdRates();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'exchange_rate_api_failed');
  }

  try {
    return await fetchFrankfurterUsdRates();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'frankfurter_failed');
  }

  throw new Error(`forex_provider_unavailable:${failures.join('|')}`);
}

async function getPreviousCloseUsdRates(): Promise<UsdRatesSnapshot> {
  const previousBusinessDay = getPreviousBusinessDate();
  return withRedisCache(`forex:usd-prev-close:${previousBusinessDay}`, 3600, async () => {
    return fetchFrankfurterUsdRates(previousBusinessDay);
  });
}

function deriveStaleFlag(lastUpdated: string, marketStatus: ForexSessionState): boolean {
  const ts = Date.parse(lastUpdated);
  if (!Number.isFinite(ts)) return false;

  const maxAgeMs = marketStatus === 'weekend_closed'
    ? 1000 * 60 * 60 * 48
    : 1000 * 60 * 20;

  return Date.now() - ts > maxAgeMs;
}

function mapQuote(pair: ForexCatalogPair, latest: UsdRatesSnapshot, previous: UsdRatesSnapshot, marketStatus: ReturnType<typeof getForexSessionSnapshot>): ForexQuote | null {
  const midRaw = computeCrossRate(latest.rates, pair.base, pair.quote);
  if (!midRaw || !Number.isFinite(midRaw)) return null;

  const mid = roundForexPrice(midRaw, pair);
  const spreadPrice = pipsToPrice(pair.typicalSpreadPips, pair);
  const bid = roundForexPrice(mid - spreadPrice / 2, pair);
  const ask = roundForexPrice(mid + spreadPrice / 2, pair);

  const previousMid = computeCrossRate(previous.rates, pair.base, pair.quote);
  const change24h = previousMid && Number.isFinite(previousMid)
    ? roundForexPrice(mid - previousMid, pair)
    : 0;
  const changePercent24h = previousMid && previousMid !== 0
    ? Number((((mid - previousMid) / previousMid) * 100).toFixed(4))
    : 0;

  return {
    id: pair.id,
    symbol: pair.symbol,
    displaySymbol: formatForexSymbol(pair.symbol),
    name: pair.name,
    base: pair.base,
    quote: pair.quote,
    mid,
    bid,
    ask,
    spreadPips: pair.typicalSpreadPips,
    pipMove24h: Number(priceToPips(change24h, pair).toFixed(1)),
    change24h,
    changePercent24h,
    pipSize: pair.pipSize,
    pipetteSize: pair.pipetteSize,
    displayPrecision: pair.displayPrecision,
    priceStep: pair.priceStep,
    sessionGroup: pair.sessionGroup,
    rank: pair.rank,
    isMajor: pair.isMajor,
    source: latest.source,
    stale: deriveStaleFlag(latest.lastUpdated, marketStatus.state),
    marketStatus: marketStatus.state,
    sessionLabel: marketStatus.label,
    sessionNextTransitionAt: marketStatus.nextTransitionAt,
    lastUpdated: latest.lastUpdated,
  };
}

function mapProviderCandle(candle: ProviderCandle): ForexCandle {
  return {
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function deriveCandlesFromCloseSeries(
  pair: ForexCatalogPair,
  ratesByDate: Record<string, Record<string, number>>
): ForexCandle[] {
  const rows = Object.entries(ratesByDate)
    .map(([date, values]) => ({ date, close: Number(values[pair.quote]) }))
    .filter((row) => Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) return [];

  return rows.map((row, index) => {
    const prevClose = index > 0 ? rows[index - 1].close : row.close;
    const open = prevClose;
    const close = row.close;
    const delta = close - open;
    const wiggle = Math.max(Math.abs(delta) * 0.35, pair.pipSize * 0.8);
    const high = Math.max(open, close) + wiggle;
    const low = Math.min(open, close) - wiggle;

    return {
      time: Math.floor(new Date(`${row.date}T00:00:00.000Z`).getTime() / 1000),
      open: roundForexPrice(open, pair),
      high: roundForexPrice(high, pair),
      low: roundForexPrice(low, pair),
      close: roundForexPrice(close, pair),
    };
  });
}

function resolvePair(symbol: string): ForexCatalogPair {
  const pair = getForexCatalogPair(symbol);
  if (!pair) {
    throw new Error(`unsupported_symbol:${normalizeForexSymbolInput(symbol)}`);
  }
  return pair;
}

function buildDateRange(days: number): { from: string; to: string } {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(days, 1));

  return {
    from: toDateOnly(fromDate),
    to: toDateOnly(toDate),
  };
}

function mapIntervalForAlpha(intervalRequested: string): {
  type: 'intraday' | 'daily' | 'unsupported';
  value?: '1min' | '5min' | '15min' | '30min' | '60min';
  intervalUsed: string;
} {
  const normalized = intervalRequested.trim().toLowerCase();
  if (normalized === '1m') return { type: 'intraday', value: '1min', intervalUsed: '1m' };
  if (normalized === '5m') return { type: 'intraday', value: '5min', intervalUsed: '5m' };
  if (normalized === '15m') return { type: 'intraday', value: '15min', intervalUsed: '15m' };
  if (normalized === '30m') return { type: 'intraday', value: '30min', intervalUsed: '30m' };
  if (normalized === '1h' || normalized === '60m') return { type: 'intraday', value: '60min', intervalUsed: '1h' };
  if (normalized === '1d' || normalized === '1day' || normalized === 'daily') {
    return { type: 'daily', intervalUsed: '1d' };
  }
  return { type: 'unsupported', intervalUsed: '1d' };
}

export async function getForexPairCatalog(symbols?: string[]): Promise<ForexPairDescriptor[]> {
  const pairs = resolveForexCatalogPairs(symbols);
  const session = getForexSessionSnapshot();

  return pairs.map((pair) => ({
    id: pair.id,
    symbol: pair.symbol,
    displaySymbol: formatForexSymbol(pair.symbol),
    base: pair.base,
    quote: pair.quote,
    name: pair.name,
    pipSize: pair.pipSize,
    pipetteSize: pair.pipetteSize,
    displayPrecision: pair.displayPrecision,
    priceStep: pair.priceStep,
    sessionGroup: pair.sessionGroup,
    rank: pair.rank,
    isMajor: pair.isMajor,
    typicalSpreadPips: pair.typicalSpreadPips,
    aliases: pair.aliases,
    marketStatus: session.state,
    sessionLabel: session.label,
    sessionNextTransitionAt: session.nextTransitionAt,
  }));
}

export async function getForexQuotes(symbols?: string[]): Promise<ForexQuote[]> {
  const pairs = resolveForexCatalogPairs(symbols);
  const cacheKey = `forex:quotes:${pairs.map((pair) => pair.symbol).join(',') || 'all'}`;

  return withRedisCache(cacheKey, 20, async () => {
    const [latest, previous] = await Promise.all([
      getLatestUsdRates(),
      getPreviousCloseUsdRates().catch(() => getLatestUsdRates()),
    ]);

    const session = getForexSessionSnapshot();

    return pairs
      .map((pair) => mapQuote(pair, latest, previous, session))
      .filter((quote): quote is ForexQuote => quote !== null)
      .sort((a, b) => a.rank - b.rank);
  });
}

export async function getForexCandleSeries(params: {
  symbol: string;
  interval?: string;
  range?: string;
}): Promise<ForexCandleSeries> {
  const pair = resolvePair(params.symbol);
  const intervalRequested = params.interval?.trim().toLowerCase() || '1d';
  const range = params.range?.trim().toLowerCase() || '30d';
  const days = parseRangeToDays(range);

  const { from, to } = buildDateRange(days);
  const minTimestamp = Math.floor(new Date(`${from}T00:00:00.000Z`).getTime() / 1000);
  const interval = mapIntervalForAlpha(intervalRequested);

  const cacheKey = `forex:candles:${pair.symbol}:${intervalRequested}:${range}`;

  return withRedisCache(cacheKey, 300, async () => {
    if (interval.type !== 'unsupported') {
      try {
        const alphaCandles = interval.type === 'intraday'
          ? await fetchAlphaVantageIntradayCandles(pair.base, pair.quote, interval.value!, minTimestamp)
          : await fetchAlphaVantageDailyCandles(pair.base, pair.quote, minTimestamp);

        if (alphaCandles.length >= 2) {
          return {
            symbol: pair.symbol,
            displaySymbol: formatForexSymbol(pair.symbol),
            intervalRequested,
            intervalUsed: interval.intervalUsed,
            range,
            quality: 'provider_ohlc',
            source: 'alpha_vantage' as const,
            lastUpdated: new Date().toISOString(),
            candles: alphaCandles.map(mapProviderCandle),
          };
        }
      } catch {
        // Fallback to close-only derived candles below.
      }
    }

    const history = await fetchFrankfurterHistory(pair.base, pair.quote, from, to);
    const candles = deriveCandlesFromCloseSeries(pair, history);

    return {
      symbol: pair.symbol,
      displaySymbol: formatForexSymbol(pair.symbol),
      intervalRequested,
      intervalUsed: '1d',
      range,
      quality: 'derived_close_only',
      source: 'frankfurter',
      lastUpdated: new Date().toISOString(),
      candles,
    };
  });
}

export async function getLegacyLatestUsdRatesMap(): Promise<Record<string, number>> {
  const latest = await withRedisCache('forex:legacy:latest-usd', 20, async () => getLatestUsdRates());
  return latest.rates;
}

export async function getLegacyHistory(
  base: string,
  quote: string,
  from: string,
  to: string
): Promise<{ rates: Record<string, Record<string, number>> }> {
  const rates = await withRedisCache(`forex:legacy:history:${base}:${quote}:${from}:${to}`, 300, async () => {
    return fetchFrankfurterHistory(base, quote, from, to);
  });
  return { rates };
}

export function getForexCatalog(): ForexCatalogPair[] {
  return FOREX_CATALOG;
}
