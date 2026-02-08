// Forex market API layer
// Backend-first in V2 mode, with direct-provider fallback for local/offline mode.

import {
  FOREX_CATALOG,
  formatForexSymbol,
  getForexCatalogPair,
  getLegacyForexId,
  resolveForexCatalogPairs,
  type ForexCatalogPair,
} from '@/config/forexCatalog';
import { isBackendEnabled } from '@/services/backend/config';
import { backendFetch } from '@/services/backend/http';
import { getForexSessionSnapshot } from '@/services/forexSessions';
import type { ForexCandleQuality, ForexPair, ForexQuote } from '@/types';
import { pipsToPrice, priceToPips, roundForexPrice } from '@/utils/forexMath';

const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const FRANKFURTER_URL = 'https://api.frankfurter.app';

interface ForexRates {
  [currency: string]: number;
}

interface BackendForexPair {
  id: string;
  symbol: string;
  displaySymbol: string;
  name: string;
  base: string;
  quote: string;
  pipSize: number;
  pipetteSize: number;
  displayPrecision: number;
  priceStep: number;
  sessionGroup: string;
  rank: number;
  isMajor: boolean;
  aliases?: string[];
  marketStatus: ForexPair['marketStatus'];
  sessionLabel: string;
  sessionNextTransitionAt: string;
  typicalSpreadPips: number;
}

interface BackendForexQuote extends BackendForexPair {
  mid: number;
  bid?: number;
  ask?: number;
  spreadPips: number;
  pipMove24h: number;
  change24h: number;
  changePercent24h: number;
  source: ForexPair['source'];
  stale: boolean;
  lastUpdated: string;
}

interface BackendForexCandleSeries {
  symbol: string;
  displaySymbol: string;
  intervalRequested: string;
  intervalUsed: string;
  range: string;
  quality: ForexCandleQuality;
  source: ForexPair['source'];
  lastUpdated: string;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
}

export const FOREX_PAIRS = FOREX_CATALOG;

const previousCloseCache = new Map<string, number>();

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

function calculateCrossRate(rates: ForexRates, base: string, quote: string): number | null {
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

function toPairFromQuote(quote: BackendForexQuote): ForexPair {
  return {
    id: quote.id,
    symbol: quote.symbol,
    displaySymbol: quote.displaySymbol,
    name: quote.name,
    base: quote.base,
    quote: quote.quote,
    rate: quote.mid,
    bid: quote.bid,
    ask: quote.ask,
    spreadPips: quote.spreadPips,
    pipMove24h: quote.pipMove24h,
    change24h: quote.change24h,
    changePercent24h: quote.changePercent24h,
    pipSize: quote.pipSize,
    pipetteSize: quote.pipetteSize,
    displayPrecision: quote.displayPrecision,
    priceStep: quote.priceStep,
    sessionGroup: quote.sessionGroup,
    rank: quote.rank,
    isMajor: quote.isMajor,
    aliases: quote.aliases,
    source: quote.source,
    stale: quote.stale,
    marketStatus: quote.marketStatus,
    sessionLabel: quote.sessionLabel,
    sessionNextTransitionAt: quote.sessionNextTransitionAt,
    lastUpdated: quote.lastUpdated,
    dataQuality: 'spot_quote',
  };
}

function toPairFromRates(pair: ForexCatalogPair, rates: ForexRates): ForexPair | null {
  const midRaw = calculateCrossRate(rates, pair.base, pair.quote);
  if (!midRaw || !Number.isFinite(midRaw)) return null;

  const session = getForexSessionSnapshot();
  const mid = roundForexPrice(midRaw, pair);
  const spreadPrice = pipsToPrice(pair.typicalSpreadPips, pair);
  const bid = roundForexPrice(mid - spreadPrice / 2, pair);
  const ask = roundForexPrice(mid + spreadPrice / 2, pair);

  const prev = previousCloseCache.get(pair.symbol);
  const change24h = prev ? roundForexPrice(mid - prev, pair) : 0;
  const changePercent24h = prev && prev !== 0
    ? Number((((mid - prev) / prev) * 100).toFixed(4))
    : 0;

  previousCloseCache.set(pair.symbol, mid);

  return {
    id: pair.id,
    symbol: pair.symbol,
    displaySymbol: formatForexSymbol(pair.symbol),
    name: pair.name,
    base: pair.base,
    quote: pair.quote,
    rate: mid,
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
    aliases: pair.aliases,
    source: 'exchange_rate_api',
    stale: false,
    marketStatus: session.state,
    sessionLabel: session.label,
    sessionNextTransitionAt: session.nextTransitionAt,
    lastUpdated: new Date().toISOString(),
    dataQuality: 'spot_quote',
  };
}

async function fetchDirectUsdRates(): Promise<ForexRates> {
  try {
    const response = await fetch(EXCHANGE_RATE_URL);
    if (response.ok) {
      const payload = await response.json();
      return payload.rates ?? {};
    }
  } catch {
    // fall through
  }

  const fallback = await fetch(`${FRANKFURTER_URL}/latest?from=USD`);
  if (!fallback.ok) throw new Error(`Forex rates failed: ${fallback.status}`);
  const payload = await fallback.json();
  return payload.rates ?? {};
}

export async function fetchForexRates(): Promise<ForexRates> {
  if (isBackendEnabled()) {
    return backendFetch<ForexRates>('/api/v2/market/forex?mode=latest');
  }

  return fetchDirectUsdRates();
}

export async function fetchForexPairs(symbols?: string[]): Promise<BackendForexPair[]> {
  if (isBackendEnabled()) {
    const query = symbols && symbols.length > 0
      ? `?symbols=${encodeURIComponent(symbols.join(','))}`
      : '';
    return backendFetch<BackendForexPair[]>(`/api/v2/market/forex/pairs${query}`);
  }

  const localPairs = resolveForexCatalogPairs(symbols);
  const session = getForexSessionSnapshot();
  return localPairs.map((pair) => ({
    id: pair.id,
    symbol: pair.symbol,
    displaySymbol: formatForexSymbol(pair.symbol),
    name: pair.name,
    base: pair.base,
    quote: pair.quote,
    pipSize: pair.pipSize,
    pipetteSize: pair.pipetteSize,
    displayPrecision: pair.displayPrecision,
    priceStep: pair.priceStep,
    sessionGroup: pair.sessionGroup,
    rank: pair.rank,
    isMajor: pair.isMajor,
    aliases: pair.aliases,
    marketStatus: session.state,
    sessionLabel: session.label,
    sessionNextTransitionAt: session.nextTransitionAt,
    typicalSpreadPips: pair.typicalSpreadPips,
  }));
}

export async function fetchForexQuotes(symbols?: string[]): Promise<ForexQuote[]> {
  if (isBackendEnabled()) {
    const query = symbols && symbols.length > 0
      ? `?symbols=${encodeURIComponent(symbols.join(','))}`
      : '';
    const quotes = await backendFetch<BackendForexQuote[]>(`/api/v2/market/forex/quotes${query}`);
    return quotes.map((quote) => ({ ...toPairFromQuote(quote), mid: quote.mid }));
  }

  const rates = await fetchDirectUsdRates();
  const pairs = resolveForexCatalogPairs(symbols)
    .map((pair) => toPairFromRates(pair, rates))
    .filter((pair): pair is ForexPair => pair !== null)
    .map((pair) => ({ ...pair, mid: pair.rate }));

  return pairs;
}

export function mapForexRatesToPairs(rates: ForexRates): ForexPair[] {
  return FOREX_CATALOG
    .map((pair) => toPairFromRates(pair, rates))
    .filter((pair): pair is ForexPair => pair !== null)
    .sort((a, b) => a.rank - b.rank);
}

export function mapForexQuotesToPairs(quotes: ForexQuote[]): ForexPair[] {
  return quotes
    .map((quote) => ({ ...quote, rate: quote.mid }))
    .sort((a, b) => a.rank - b.rank);
}

export async function fetchForexHistory(base: string, quote: string, days: number): Promise<{ date: string; rate: number }[]> {
  if (isBackendEnabled()) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const from = startDate.toISOString().split('T')[0];
    const to = endDate.toISOString().split('T')[0];

    const payload = await backendFetch<{ rates: Record<string, Record<string, number>> }>(
      `/api/v2/market/forex?mode=history&base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}&from=${from}&to=${to}`
    );

    return Object.entries(payload.rates ?? {})
      .map(([date, values]) => ({ date, rate: values[quote] ?? 0 }))
      .filter((row) => Number.isFinite(row.rate) && row.rate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const from = startDate.toISOString().split('T')[0];
  const to = endDate.toISOString().split('T')[0];

  const endpoint = `${FRANKFURTER_URL}/${from}..${to}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Forex history failed: ${response.status}`);

  const payload = await response.json();
  const rows = Object.entries(payload.rates ?? {})
    .map(([date, values]) => ({ date, rate: (values as Record<string, number>)[quote] ?? 0 }))
    .filter((row) => Number.isFinite(row.rate) && row.rate > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return rows;
}

export async function fetchForexCandles(symbol: string, interval = '1d', range = '30d'): Promise<BackendForexCandleSeries> {
  if (isBackendEnabled()) {
    const pair = getForexCatalogPair(symbol);
    const canonical = pair?.symbol ?? symbol;
    return backendFetch<BackendForexCandleSeries>(
      `/api/v2/market/forex/candles?symbol=${encodeURIComponent(canonical)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
    );
  }

  const pair = getForexCatalogPair(symbol);
  if (!pair) {
    throw new Error(`Unsupported forex symbol: ${symbol}`);
  }

  const days = parseRangeToDays(range);
  const rows = await fetchForexHistory(pair.base, pair.quote, days);
  const candles = rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1].rate : row.rate;
    const open = previous;
    const close = row.rate;
    const delta = close - open;
    const wiggle = Math.max(Math.abs(delta) * 0.35, pair.pipSize * 0.8);

    return {
      time: Math.floor(new Date(`${row.date}T00:00:00.000Z`).getTime() / 1000),
      open: roundForexPrice(open, pair),
      high: roundForexPrice(Math.max(open, close) + wiggle, pair),
      low: roundForexPrice(Math.min(open, close) - wiggle, pair),
      close: roundForexPrice(close, pair),
    };
  });

  return {
    symbol: pair.symbol,
    displaySymbol: formatForexSymbol(pair.symbol),
    intervalRequested: interval,
    intervalUsed: '1d',
    range,
    quality: 'derived_close_only',
    source: 'frankfurter',
    lastUpdated: new Date().toISOString(),
    candles,
  };
}

export function resolveForexPairById(id: string): ForexCatalogPair | undefined {
  const normalized = id.toLowerCase();
  return FOREX_CATALOG.find((pair) => pair.id === normalized || getLegacyForexId(pair.symbol) === normalized);
}

export function simulateForexTick(lastRate: number, volatility = 0.0001): number {
  const maxChange = lastRate * volatility;
  const change = (Math.random() - 0.5) * 2 * maxChange;
  return lastRate + change;
}
