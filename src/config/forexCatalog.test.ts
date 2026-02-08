import { describe, expect, it } from 'vitest';
import {
  FOREX_CATALOG,
  formatForexSymbol,
  getForexCatalogPair,
  getLegacyForexId,
  isForexSymbol,
  normalizeForexSymbolInput,
  resolveForexCatalogPairs,
} from './forexCatalog';

describe('forexCatalog', () => {
  it('normalizes and resolves symbols across aliases', () => {
    expect(normalizeForexSymbolInput('eur/usd')).toBe('EURUSD');
    expect(getForexCatalogPair('eurusd')?.symbol).toBe('EURUSD');
    expect(getForexCatalogPair('EUR/USD')?.symbol).toBe('EURUSD');
    expect(getForexCatalogPair('cable')?.symbol).toBe('GBPUSD');
    expect(formatForexSymbol('usdjpy')).toBe('USD/JPY');
  });

  it('keeps legacy ids compatible and searchable', () => {
    expect(getLegacyForexId('EURUSD')).toBe('eurusd');
    expect(isForexSymbol('gbp/jpy')).toBe(true);
    expect(isForexSymbol('not-a-pair')).toBe(false);
  });

  it('dedupes and sorts selected pair lists by catalog rank', () => {
    const selected = resolveForexCatalogPairs(['gbpusd', 'EUR/USD', 'gbp/usd', 'USDJPY']);
    expect(selected.map((pair) => pair.symbol)).toEqual(['EURUSD', 'GBPUSD', 'USDJPY']);
    expect(selected[0].rank).toBeLessThan(selected[1].rank);
    expect(FOREX_CATALOG.length).toBeGreaterThan(8);
  });
});
