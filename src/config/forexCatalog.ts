export type ForexSessionGroup = 'global' | 'asia' | 'europe' | 'americas';

export interface ForexCatalogPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  name: string;
  pipSize: number;
  pipetteSize: number;
  displayPrecision: number;
  priceStep: number;
  sessionGroup: ForexSessionGroup;
  rank: number;
  isMajor: boolean;
  typicalSpreadPips: number;
  aliases: string[];
}

const PAIRS: ForexCatalogPair[] = [
  {
    id: 'eurusd',
    symbol: 'EURUSD',
    base: 'EUR',
    quote: 'USD',
    name: 'Euro / US Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'europe',
    rank: 1,
    isMajor: true,
    typicalSpreadPips: 0.6,
    aliases: ['EUR/USD', 'eurusd', 'eur/usd'],
  },
  {
    id: 'gbpusd',
    symbol: 'GBPUSD',
    base: 'GBP',
    quote: 'USD',
    name: 'British Pound / US Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'europe',
    rank: 2,
    isMajor: true,
    typicalSpreadPips: 0.8,
    aliases: ['GBP/USD', 'gbpusd', 'gbp/usd', 'cable'],
  },
  {
    id: 'usdjpy',
    symbol: 'USDJPY',
    base: 'USD',
    quote: 'JPY',
    name: 'US Dollar / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 3,
    isMajor: true,
    typicalSpreadPips: 0.7,
    aliases: ['USD/JPY', 'usdjpy', 'usd/jpy'],
  },
  {
    id: 'usdchf',
    symbol: 'USDCHF',
    base: 'USD',
    quote: 'CHF',
    name: 'US Dollar / Swiss Franc',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'europe',
    rank: 4,
    isMajor: true,
    typicalSpreadPips: 0.9,
    aliases: ['USD/CHF', 'usdchf', 'usd/chf'],
  },
  {
    id: 'audusd',
    symbol: 'AUDUSD',
    base: 'AUD',
    quote: 'USD',
    name: 'Australian Dollar / US Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'asia',
    rank: 5,
    isMajor: true,
    typicalSpreadPips: 0.9,
    aliases: ['AUD/USD', 'audusd', 'aud/usd'],
  },
  {
    id: 'usdcad',
    symbol: 'USDCAD',
    base: 'USD',
    quote: 'CAD',
    name: 'US Dollar / Canadian Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'americas',
    rank: 6,
    isMajor: true,
    typicalSpreadPips: 1,
    aliases: ['USD/CAD', 'usdcad', 'usd/cad'],
  },
  {
    id: 'nzdusd',
    symbol: 'NZDUSD',
    base: 'NZD',
    quote: 'USD',
    name: 'New Zealand Dollar / US Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'asia',
    rank: 7,
    isMajor: true,
    typicalSpreadPips: 1.1,
    aliases: ['NZD/USD', 'nzdusd', 'nzd/usd'],
  },
  {
    id: 'eurgbp',
    symbol: 'EURGBP',
    base: 'EUR',
    quote: 'GBP',
    name: 'Euro / British Pound',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'europe',
    rank: 8,
    isMajor: false,
    typicalSpreadPips: 1.2,
    aliases: ['EUR/GBP', 'eurgbp', 'eur/gbp'],
  },
  {
    id: 'eurjpy',
    symbol: 'EURJPY',
    base: 'EUR',
    quote: 'JPY',
    name: 'Euro / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 9,
    isMajor: false,
    typicalSpreadPips: 1.4,
    aliases: ['EUR/JPY', 'eurjpy', 'eur/jpy'],
  },
  {
    id: 'gbpjpy',
    symbol: 'GBPJPY',
    base: 'GBP',
    quote: 'JPY',
    name: 'British Pound / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 10,
    isMajor: false,
    typicalSpreadPips: 1.8,
    aliases: ['GBP/JPY', 'gbpjpy', 'gbp/jpy'],
  },
  {
    id: 'eurchf',
    symbol: 'EURCHF',
    base: 'EUR',
    quote: 'CHF',
    name: 'Euro / Swiss Franc',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'europe',
    rank: 11,
    isMajor: false,
    typicalSpreadPips: 1.4,
    aliases: ['EUR/CHF', 'eurchf', 'eur/chf'],
  },
  {
    id: 'chfjpy',
    symbol: 'CHFJPY',
    base: 'CHF',
    quote: 'JPY',
    name: 'Swiss Franc / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 12,
    isMajor: false,
    typicalSpreadPips: 1.6,
    aliases: ['CHF/JPY', 'chfjpy', 'chf/jpy'],
  },
  {
    id: 'audjpy',
    symbol: 'AUDJPY',
    base: 'AUD',
    quote: 'JPY',
    name: 'Australian Dollar / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 13,
    isMajor: false,
    typicalSpreadPips: 1.7,
    aliases: ['AUD/JPY', 'audjpy', 'aud/jpy'],
  },
  {
    id: 'cadjpy',
    symbol: 'CADJPY',
    base: 'CAD',
    quote: 'JPY',
    name: 'Canadian Dollar / Japanese Yen',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 3,
    priceStep: 0.001,
    sessionGroup: 'asia',
    rank: 14,
    isMajor: false,
    typicalSpreadPips: 1.8,
    aliases: ['CAD/JPY', 'cadjpy', 'cad/jpy'],
  },
  {
    id: 'euraud',
    symbol: 'EURAUD',
    base: 'EUR',
    quote: 'AUD',
    name: 'Euro / Australian Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'asia',
    rank: 15,
    isMajor: false,
    typicalSpreadPips: 2,
    aliases: ['EUR/AUD', 'euraud', 'eur/aud'],
  },
  {
    id: 'gbpaud',
    symbol: 'GBPAUD',
    base: 'GBP',
    quote: 'AUD',
    name: 'British Pound / Australian Dollar',
    pipSize: 0.0001,
    pipetteSize: 0.00001,
    displayPrecision: 5,
    priceStep: 0.00001,
    sessionGroup: 'asia',
    rank: 16,
    isMajor: false,
    typicalSpreadPips: 2.3,
    aliases: ['GBP/AUD', 'gbpaud', 'gbp/aud'],
  },
  {
    id: 'xauusd',
    symbol: 'XAUUSD',
    base: 'XAU',
    quote: 'USD',
    name: 'Gold / US Dollar',
    pipSize: 0.01,
    pipetteSize: 0.001,
    displayPrecision: 2,
    priceStep: 0.01,
    sessionGroup: 'global',
    rank: 17,
    isMajor: false,
    typicalSpreadPips: 2.5,
    aliases: ['XAU/USD', 'xauusd', 'xau/usd', 'gold'],
  },
];

export const FOREX_CATALOG: ForexCatalogPair[] = [...PAIRS].sort((a, b) => a.rank - b.rank);

const bySymbol = new Map<string, ForexCatalogPair>();
const byId = new Map<string, ForexCatalogPair>();

for (const pair of FOREX_CATALOG) {
  bySymbol.set(pair.symbol, pair);
  byId.set(pair.id, pair);

  const normalizedAliasSet = new Set<string>([
    pair.symbol,
    pair.id,
    `${pair.base}/${pair.quote}`,
    `${pair.base}${pair.quote}`,
    ...pair.aliases,
  ]);

  for (const alias of normalizedAliasSet) {
    bySymbol.set(normalizeForexSymbolInput(alias), pair);
  }
}

export function normalizeForexSymbolInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '');
}

export function formatForexSymbol(symbol: string, delimiter = '/'): string {
  const normalized = normalizeForexSymbolInput(symbol);
  if (normalized.length !== 6) return normalized;
  return `${normalized.slice(0, 3)}${delimiter}${normalized.slice(3)}`;
}

export function getForexCatalogPair(value: string): ForexCatalogPair | undefined {
  const normalized = normalizeForexSymbolInput(value);
  return bySymbol.get(normalized) ?? byId.get(value.toLowerCase());
}

export function resolveForexCatalogPairs(values?: string[]): ForexCatalogPair[] {
  if (!values || values.length === 0) return FOREX_CATALOG;

  const deduped = new Map<string, ForexCatalogPair>();
  for (const value of values) {
    const pair = getForexCatalogPair(value);
    if (!pair) continue;
    deduped.set(pair.symbol, pair);
  }

  return Array.from(deduped.values()).sort((a, b) => a.rank - b.rank);
}

export function getLegacyForexId(symbol: string): string {
  return normalizeForexSymbolInput(symbol).toLowerCase();
}

export function getCatalogById(id: string): ForexCatalogPair | undefined {
  return byId.get(id.toLowerCase());
}

export function isForexSymbol(value: string): boolean {
  return Boolean(getForexCatalogPair(value));
}
