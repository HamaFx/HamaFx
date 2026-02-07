import { describe, expect, it } from 'vitest';
import {
  readMarketsUrlState,
  readPortfolioUrlState,
  readSettingsUrlState,
  writeMarketsUrlState,
  writePortfolioUrlState,
  writeSettingsUrlState,
} from '@/utils/urlState';

describe('urlState', () => {
  it('parses portfolio tab with fallback', () => {
    expect(readPortfolioUrlState(new URLSearchParams('portfolioTab=orders'))).toBe('orders');
    expect(readPortfolioUrlState(new URLSearchParams('portfolioTab=unknown'))).toBe('positions');
  });

  it('reads and writes markets state with defaults', () => {
    const defaults = readMarketsUrlState(new URLSearchParams());
    expect(defaults).toEqual({
      view: 'list',
      asset: 'all',
      sort: 'marketCap',
      order: 'desc',
      q: '',
    });

    const next = writeMarketsUrlState(new URLSearchParams(), {
      view: 'grid',
      asset: 'crypto',
      sort: 'change',
      order: 'asc',
      q: 'btc',
    });

    expect(next.get('marketsView')).toBe('grid');
    expect(next.get('marketsAsset')).toBe('crypto');
    expect(next.get('marketsSort')).toBe('change');
    expect(next.get('marketsOrder')).toBe('asc');
    expect(next.get('marketsQ')).toBe('btc');
  });

  it('drops blank markets query on write', () => {
    const params = new URLSearchParams('marketsQ=eth');
    const next = writeMarketsUrlState(params, {
      view: 'list',
      asset: 'all',
      sort: 'marketCap',
      order: 'desc',
      q: '   ',
    });
    expect(next.has('marketsQ')).toBe(false);
  });

  it('parses and writes settings tab', () => {
    expect(readSettingsUrlState(new URLSearchParams('settingsTab=data'))).toBe('data');
    expect(readSettingsUrlState(new URLSearchParams('settingsTab=invalid'))).toBe('apikeys');

    const next = writeSettingsUrlState(new URLSearchParams(), 'audit');
    expect(next.get('settingsTab')).toBe('audit');
  });

  it('writes portfolio tab key', () => {
    const next = writePortfolioUrlState(new URLSearchParams(), 'history');
    expect(next.get('portfolioTab')).toBe('history');
  });
});
