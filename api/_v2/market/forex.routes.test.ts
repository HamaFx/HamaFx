import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as forexGet } from './forex.js';
import { GET as candlesGet } from './forex/candles.js';
import { GET as pairsGet } from './forex/pairs.js';
import { GET as quotesGet } from './forex/quotes.js';
import { requireAuth } from '../../_lib/auth.js';
import {
  getForexCandleSeries,
  getForexPairCatalog,
  getForexQuotes,
  getLegacyHistory,
  getLegacyLatestUsdRatesMap,
} from '../../_lib/forex/service.js';
import { rateLimit } from '../../_lib/redis.js';

vi.mock('../../_lib/auth.js', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('../../_lib/redis.js', () => ({
  rateLimit: vi.fn(),
}));

vi.mock('../../_lib/forex/service.js', () => ({
  getForexCandleSeries: vi.fn(),
  getForexPairCatalog: vi.fn(),
  getForexQuotes: vi.fn(),
  getLegacyHistory: vi.fn(),
  getLegacyLatestUsdRatesMap: vi.fn(),
}));

describe('forex market handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    vi.mocked(rateLimit).mockResolvedValue(true);

    vi.mocked(getLegacyLatestUsdRatesMap).mockResolvedValue({ EUR: 0.92, JPY: 150.2 });
    vi.mocked(getLegacyHistory).mockResolvedValue({
      rates: {
        '2026-02-01': { EUR: 0.92 },
        '2026-02-02': { EUR: 0.93 },
      },
    });
    vi.mocked(getForexPairCatalog).mockResolvedValue([
      {
        id: 'eurusd',
        symbol: 'EURUSD',
        displaySymbol: 'EUR/USD',
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
        aliases: ['EUR/USD', 'eurusd'],
        marketStatus: 'open',
        sessionLabel: 'Open',
        sessionNextTransitionAt: '2026-02-10T22:00:00.000Z',
      },
    ]);
    vi.mocked(getForexQuotes).mockResolvedValue([
      {
        id: 'eurusd',
        symbol: 'EURUSD',
        displaySymbol: 'EUR/USD',
        name: 'Euro / US Dollar',
        base: 'EUR',
        quote: 'USD',
        mid: 1.0865,
        bid: 1.08647,
        ask: 1.08653,
        spreadPips: 0.6,
        pipMove24h: 12.3,
        change24h: 0.0012,
        changePercent24h: 0.11,
        pipSize: 0.0001,
        pipetteSize: 0.00001,
        displayPrecision: 5,
        priceStep: 0.00001,
        sessionGroup: 'europe',
        rank: 1,
        isMajor: true,
        source: 'exchange_rate_api',
        stale: false,
        marketStatus: 'open',
        sessionLabel: 'Open',
        sessionNextTransitionAt: '2026-02-10T22:00:00.000Z',
        lastUpdated: '2026-02-10T10:00:00.000Z',
      },
    ]);
    vi.mocked(getForexCandleSeries).mockResolvedValue({
      symbol: 'EURUSD',
      displaySymbol: 'EUR/USD',
      intervalRequested: '1h',
      intervalUsed: '1h',
      range: '30d',
      quality: 'provider_ohlc',
      source: 'alpha_vantage',
      lastUpdated: '2026-02-10T10:00:00.000Z',
      candles: [
        { time: 1739145600, open: 1.085, high: 1.087, low: 1.0845, close: 1.0865 },
      ],
    });
  });

  it('serves compatibility latest mode with deterministic payload', async () => {
    const response = await forexGet(new Request('https://app.test/api/v2/market/forex?mode=latest'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ EUR: 0.92, JPY: 150.2 });
    expect(getLegacyLatestUsdRatesMap).toHaveBeenCalledTimes(1);
  });

  it('rejects compatibility candles mode without symbol', async () => {
    const response = await forexGet(new Request('https://app.test/api/v2/market/forex?mode=candles'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toContain('symbol is required');
  });

  it('supports canonical pairs/quotes/candles routes', async () => {
    const pairsResponse = await pairsGet(new Request('https://app.test/api/v2/market/forex/pairs?symbols=EURUSD,USDJPY'));
    const pairsBody = await pairsResponse.json();
    expect(pairsResponse.status).toBe(200);
    expect(pairsBody.ok).toBe(true);
    expect(getForexPairCatalog).toHaveBeenCalledWith(['EURUSD', 'USDJPY']);

    const quotesResponse = await quotesGet(new Request('https://app.test/api/v2/market/forex/quotes?symbols=EURUSD'));
    const quotesBody = await quotesResponse.json();
    expect(quotesResponse.status).toBe(200);
    expect(quotesBody.ok).toBe(true);
    expect(getForexQuotes).toHaveBeenCalledWith(['EURUSD']);

    const candlesResponse = await candlesGet(new Request('https://app.test/api/v2/market/forex/candles?symbol=EURUSD&interval=1h&range=30d'));
    const candlesBody = await candlesResponse.json();
    expect(candlesResponse.status).toBe(200);
    expect(candlesBody.ok).toBe(true);
    expect(getForexCandleSeries).toHaveBeenCalledWith({
      symbol: 'EURUSD',
      interval: '1h',
      range: '30d',
    });
  });
});
