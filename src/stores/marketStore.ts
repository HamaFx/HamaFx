import { create } from 'zustand';
import type { Asset, ForexCandleQuality, ForexPair, OHLCV } from '@/types';
import { fetchCryptoMarkets, mapCoinGeckoToAsset, fetchCryptoOHLC } from '@/services/api/coinGecko';
import { fetchCoinCapAssets, mapCoinCapToAsset, connectCoinCapWebSocket } from '@/services/api/coinCap';
import {
  fetchForexCandles,
  fetchForexQuotes,
  mapForexQuotesToPairs,
  resolveForexPairById,
  simulateForexTick,
} from '@/services/api/forex';
import { isBackendEnabled } from '@/services/backend/config';
import { cacheService } from '@/services/cache';
import { rateLimiter } from '@/services/rateLimiter';

interface ForexSeriesMeta {
  quality: ForexCandleQuality;
  source: string;
  intervalUsed: string;
  lastUpdated: string;
}

interface MarketState {
  cryptoAssets: Asset[];
  forexPairs: ForexPair[];

  isLoadingCrypto: boolean;
  isLoadingForex: boolean;
  lastCryptoUpdate: string | null;
  lastForexUpdate: string | null;
  wsConnected: boolean;
  error: string | null;
  dataSource: 'coingecko' | 'coincap' | 'cache' | 'none';
  forexDataSource: string;
  forexDataQuality: ForexCandleQuality | 'spot_quote' | 'unknown';
  forexStale: boolean;

  fetchCrypto: () => Promise<void>;
  fetchForex: () => Promise<void>;
  startWebSocket: () => () => void;
  startForexPolling: () => () => void;
  updateCryptoPrice: (id: string, price: number) => void;
  getAssetById: (id: string) => Asset | undefined;
  getForexPairById: (id: string) => ForexPair | undefined;
}

const CRYPTO_CACHE_KEY = 'crypto_markets';
const FOREX_CACHE_KEY = 'forex_quotes';
const CRYPTO_CACHE_TTL = 60_000;
const FOREX_CACHE_TTL = 60_000;

async function fetchForexSeries(
  assetId: string,
  days: number
): Promise<{ ohlcv: OHLCV[]; meta: ForexSeriesMeta }> {
  const pair = resolveForexPairById(assetId);
  if (!pair) {
    return {
      ohlcv: [],
      meta: {
        quality: 'derived_close_only',
        source: 'unknown',
        intervalUsed: '1d',
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  const range = `${Math.max(days, 1)}d`;
  const series = await fetchForexCandles(pair.symbol, '1d', range);
  const ohlcv: OHLCV[] = series.candles.map((item) => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }));

  return {
    ohlcv,
    meta: {
      quality: series.quality,
      source: series.source ?? 'unknown',
      intervalUsed: series.intervalUsed,
      lastUpdated: series.lastUpdated,
    },
  };
}

export const useMarketStore = create<MarketState>((set, get) => ({
  cryptoAssets: [],
  forexPairs: [],
  isLoadingCrypto: false,
  isLoadingForex: false,
  lastCryptoUpdate: null,
  lastForexUpdate: null,
  wsConnected: false,
  error: null,
  dataSource: 'none',
  forexDataSource: 'none',
  forexDataQuality: 'unknown',
  forexStale: false,

  fetchCrypto: async () => {
    const cached = cacheService.get<Asset[]>(CRYPTO_CACHE_KEY);
    if (cached && cached.length > 0) {
      set({
        cryptoAssets: cached,
        lastCryptoUpdate: new Date().toISOString(),
        dataSource: 'cache',
      });
      if (!rateLimiter.canMakeRequest('coingecko')) return;
    }

    set({ isLoadingCrypto: true, error: null });

    try {
      if (rateLimiter.canMakeRequest('coingecko')) {
        rateLimiter.recordRequest('coingecko');
        const data = await fetchCryptoMarkets(25);
        const assets = data.map(mapCoinGeckoToAsset);
        cacheService.set(CRYPTO_CACHE_KEY, assets, CRYPTO_CACHE_TTL);
        set({
          cryptoAssets: assets,
          isLoadingCrypto: false,
          lastCryptoUpdate: new Date().toISOString(),
          dataSource: 'coingecko',
        });
        return;
      }
    } catch (error) {
      console.warn('[Market] CoinGecko failed, trying CoinCap fallback:', error);
    }

    try {
      if (rateLimiter.canMakeRequest('coincap')) {
        rateLimiter.recordRequest('coincap');
        const data = await fetchCoinCapAssets(25);
        const assets = data.map(mapCoinCapToAsset);
        cacheService.set(CRYPTO_CACHE_KEY, assets, CRYPTO_CACHE_TTL);
        set({
          cryptoAssets: assets,
          isLoadingCrypto: false,
          lastCryptoUpdate: new Date().toISOString(),
          dataSource: 'coincap',
        });
        return;
      }
    } catch (error) {
      console.warn('[Market] CoinCap fallback failed:', error);
    }

    const stale = cacheService.getStale<Asset[]>(CRYPTO_CACHE_KEY);
    if (stale && stale.length > 0) {
      set({
        cryptoAssets: stale,
        isLoadingCrypto: false,
        lastCryptoUpdate: null,
        dataSource: 'cache',
        error: 'Using cached crypto data — providers unavailable',
      });
      return;
    }

    set({
      isLoadingCrypto: false,
      error: 'Unable to fetch market data. Please try again later.',
    });
  },

  fetchForex: async () => {
    const cached = cacheService.get<ForexPair[]>(FOREX_CACHE_KEY);
    if (cached && cached.length > 0) {
      set({
        forexPairs: cached,
        lastForexUpdate: new Date().toISOString(),
      });
    }

    set({ isLoadingForex: true });

    try {
      if (!isBackendEnabled() && !rateLimiter.canMakeRequest('exchangerate')) {
        const stale = cacheService.getStale<ForexPair[]>(FOREX_CACHE_KEY);
        if (stale && stale.length > 0) {
          set({
            forexPairs: stale,
            isLoadingForex: false,
            forexDataSource: 'cache',
            forexStale: true,
          });
          return;
        }
      }

      if (!isBackendEnabled()) {
        rateLimiter.recordRequest('exchangerate');
      }

      const quotes = await fetchForexQuotes();
      const pairs = mapForexQuotesToPairs(quotes);

      cacheService.set(FOREX_CACHE_KEY, pairs, FOREX_CACHE_TTL);

      const source = quotes[0]?.source ?? (isBackendEnabled() ? 'backend' : 'exchange_rate_api');
      const quality = quotes[0]?.dataQuality ?? 'spot_quote';
      const stale = quotes.some((quote) => quote.stale);

      set({
        forexPairs: pairs,
        isLoadingForex: false,
        lastForexUpdate: new Date().toISOString(),
        forexDataSource: source,
        forexDataQuality: quality,
        forexStale: stale,
      });
      return;
    } catch (error) {
      console.warn('[Market] Forex fetch failed:', error);
    }

    const stale = cacheService.getStale<ForexPair[]>(FOREX_CACHE_KEY);
    if (stale && stale.length > 0) {
      set({
        forexPairs: stale,
        isLoadingForex: false,
        forexDataSource: 'cache',
        forexDataQuality: 'unknown',
        forexStale: true,
      });
      return;
    }

    set({ isLoadingForex: false });
  },

  startWebSocket: () => {
    const topCryptoIds = [
      'bitcoin',
      'ethereum',
      'solana',
      'binance-coin',
      'ripple',
      'cardano',
      'dogecoin',
      'polkadot',
      'avalanche-2',
      'chainlink',
    ];

    const cleanup = connectCoinCapWebSocket(
      topCryptoIds,
      (prices) => {
        const { cryptoAssets } = get();
        const idMap: Record<string, string> = {
          'binance-coin': 'binancecoin',
          'avalanche-2': 'avalanche-2',
        };

        const updated = cryptoAssets.map((asset) => {
          const coinCapId = Object.entries(idMap).find(([, value]) => value === asset.id)?.[0] || asset.id;
          const newPrice = prices[coinCapId] || prices[asset.id];

          if (newPrice && newPrice > 0) {
            const change = newPrice - (asset.price - asset.change24h);
            return {
              ...asset,
              price: newPrice,
              change24h: change,
              changePercent24h: ((change) / (asset.price - asset.change24h || 1)) * 100,
              lastUpdated: new Date().toISOString(),
            };
          }

          return asset;
        });

        set({ cryptoAssets: updated });
      },
      (connected) => {
        set({ wsConnected: connected });
      }
    );

    return cleanup;
  },

  startForexPolling: () => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let localTickTimer: ReturnType<typeof setInterval> | null = null;

    const schedule = async () => {
      if (cancelled) return;

      await get().fetchForex();
      const state = get();
      const marketStatus = state.forexPairs[0]?.marketStatus;

      let nextDelay = 120_000;
      if (isBackendEnabled()) {
        if (marketStatus === 'weekend_closed') nextDelay = 600_000;
        else nextDelay = document.hidden ? 180_000 : 60_000;
      } else {
        nextDelay = document.hidden ? 180_000 : 120_000;
      }

      timer = setTimeout(schedule, nextDelay);
    };

    schedule();

    if (!isBackendEnabled()) {
      localTickTimer = setInterval(() => {
        const { forexPairs } = get();
        if (forexPairs.length === 0) return;

        const updated = forexPairs.map((pair) => ({
          ...pair,
          rate: simulateForexTick(pair.rate),
        }));

        set({ forexPairs: updated, forexDataQuality: 'spot_quote' });
      }, 3000);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (localTickTimer) clearInterval(localTickTimer);
    };
  },

  updateCryptoPrice: (id: string, price: number) => {
    const { cryptoAssets } = get();
    set({
      cryptoAssets: cryptoAssets.map((asset) =>
        asset.id === id ? { ...asset, price, lastUpdated: new Date().toISOString() } : asset
      ),
    });
  },

  getAssetById: (id: string) => {
    return get().cryptoAssets.find((asset) => asset.id === id);
  },

  getForexPairById: (id: string) => {
    return get().forexPairs.find((pair) => pair.id === id);
  },
}));

export async function fetchOHLCVData(assetId: string, assetType: 'crypto' | 'forex', days: number): Promise<OHLCV[]> {
  const cacheKey = `ohlcv_${assetId}_${days}`;
  const cached = cacheService.get<OHLCV[]>(cacheKey);
  if (cached) return cached;

  if (assetType === 'crypto') {
    try {
      if (!rateLimiter.canMakeRequest('coingecko')) {
        return cacheService.getStale<OHLCV[]>(cacheKey) || [];
      }

      rateLimiter.recordRequest('coingecko');
      const data = await fetchCryptoOHLC(assetId, days);
      const ohlcv: OHLCV[] = data.map((item: number[]) => ({
        time: Math.floor(item[0] / 1000),
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
      }));

      cacheService.set(cacheKey, ohlcv, 300_000);
      return ohlcv;
    } catch {
      return cacheService.getStale<OHLCV[]>(cacheKey) || [];
    }
  }

  if (assetType === 'forex') {
    try {
      const { ohlcv } = await fetchForexSeries(assetId, days);
      cacheService.set(cacheKey, ohlcv, 300_000);
      return ohlcv;
    } catch {
      return cacheService.getStale<OHLCV[]>(cacheKey) || [];
    }
  }

  return [];
}

export async function fetchForexOHLCVSeries(assetId: string, days: number): Promise<{ ohlcv: OHLCV[]; meta: ForexSeriesMeta }> {
  return fetchForexSeries(assetId, days);
}
