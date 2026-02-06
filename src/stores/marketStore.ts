import { create } from 'zustand';
import type { Asset, ForexPair, OHLCV } from '@/types';
import { fetchCryptoMarkets, mapCoinGeckoToAsset } from '@/services/api/coinGecko';
import { fetchCoinCapAssets, mapCoinCapToAsset, connectCoinCapWebSocket } from '@/services/api/coinCap';
import { fetchForexRates, mapForexRatesToPairs, simulateForexTick } from '@/services/api/forex';
import { cacheService } from '@/services/cache';
import { rateLimiter } from '@/services/rateLimiter';

interface MarketState {
  // Data
  cryptoAssets: Asset[];
  forexPairs: ForexPair[];

  // Status
  isLoadingCrypto: boolean;
  isLoadingForex: boolean;
  lastCryptoUpdate: string | null;
  lastForexUpdate: string | null;
  wsConnected: boolean;
  error: string | null;
  dataSource: 'coingecko' | 'coincap' | 'cache' | 'none';

  // Actions
  fetchCrypto: () => Promise<void>;
  fetchForex: () => Promise<void>;
  startWebSocket: () => () => void;
  startForexPolling: () => () => void;
  updateCryptoPrice: (id: string, price: number) => void;
  getAssetById: (id: string) => Asset | undefined;
  getForexPairById: (id: string) => ForexPair | undefined;
}

const CRYPTO_CACHE_KEY = 'crypto_markets';
const FOREX_CACHE_KEY = 'forex_rates';
const CRYPTO_CACHE_TTL = 60_000;  // 60s
const FOREX_CACHE_TTL = 120_000;  // 2min

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

  fetchCrypto: async () => {
    // Check cache first
    const cached = cacheService.get<Asset[]>(CRYPTO_CACHE_KEY);
    if (cached && cached.length > 0) {
      set({
        cryptoAssets: cached,
        lastCryptoUpdate: new Date().toISOString(),
        dataSource: 'cache',
      });
      // Still try to refresh in background if rate limit allows
      if (!rateLimiter.canMakeRequest('coingecko')) return;
    }

    set({ isLoadingCrypto: true, error: null });

    try {
      // Try CoinGecko first (better data: images, sparklines, market cap)
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
    } catch (err) {
      console.warn('[Market] CoinGecko failed, trying CoinCap fallback:', err);
    }

    try {
      // Fallback to CoinCap
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
    } catch (err) {
      console.warn('[Market] CoinCap also failed:', err);
    }

    // Last resort: use stale cache
    const stale = cacheService.getStale<Asset[]>(CRYPTO_CACHE_KEY);
    if (stale && stale.length > 0) {
      set({
        cryptoAssets: stale,
        isLoadingCrypto: false,
        lastCryptoUpdate: null,
        dataSource: 'cache',
        error: 'Using cached data — live API temporarily unavailable',
      });
      return;
    }

    set({
      isLoadingCrypto: false,
      error: 'Unable to fetch market data. Please try again later.',
    });
  },

  fetchForex: async () => {
    // Check cache first
    const cached = cacheService.get<ForexPair[]>(FOREX_CACHE_KEY);
    if (cached && cached.length > 0) {
      set({
        forexPairs: cached,
        lastForexUpdate: new Date().toISOString(),
      });
      if (!rateLimiter.canMakeRequest('exchangerate')) return;
    }

    set({ isLoadingForex: true });

    try {
      if (rateLimiter.canMakeRequest('exchangerate')) {
        rateLimiter.recordRequest('exchangerate');
        const rates = await fetchForexRates();
        const pairs = mapForexRatesToPairs(rates);
        cacheService.set(FOREX_CACHE_KEY, pairs, FOREX_CACHE_TTL);
        set({
          forexPairs: pairs,
          isLoadingForex: false,
          lastForexUpdate: new Date().toISOString(),
        });
        return;
      }
    } catch (err) {
      console.warn('[Market] Forex fetch failed:', err);
    }

    // Stale cache fallback
    const stale = cacheService.getStale<ForexPair[]>(FOREX_CACHE_KEY);
    if (stale && stale.length > 0) {
      set({ forexPairs: stale, isLoadingForex: false });
    } else {
      set({ isLoadingForex: false });
    }
  },

  startWebSocket: () => {
    const topCryptoIds = [
      'bitcoin', 'ethereum', 'solana', 'binance-coin', 'ripple',
      'cardano', 'dogecoin', 'polkadot', 'avalanche-2', 'chainlink',
    ];

    const cleanup = connectCoinCapWebSocket(
      topCryptoIds,
      (prices) => {
        const { cryptoAssets } = get();
        // Map CoinCap IDs to our asset IDs
        const idMap: Record<string, string> = {
          'binance-coin': 'binancecoin',
          'avalanche-2': 'avalanche-2',
        };

        const updated = cryptoAssets.map(asset => {
          // CoinCap uses different IDs than CoinGecko — try both
          const coinCapId = Object.entries(idMap).find(([, v]) => v === asset.id)?.[0] || asset.id;
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
    // Simulate forex ticks every 3-5 seconds
    const tickInterval = setInterval(() => {
      const { forexPairs } = get();
      if (forexPairs.length === 0) return;

      const updated = forexPairs.map(pair => ({
        ...pair,
        rate: simulateForexTick(pair.rate),
      }));
      set({ forexPairs: updated });
    }, 3000);

    // Real API poll every 2 minutes
    const pollInterval = setInterval(() => {
      get().fetchForex();
    }, 120_000);

    return () => {
      clearInterval(tickInterval);
      clearInterval(pollInterval);
    };
  },

  updateCryptoPrice: (id: string, price: number) => {
    const { cryptoAssets } = get();
    set({
      cryptoAssets: cryptoAssets.map(a =>
        a.id === id ? { ...a, price, lastUpdated: new Date().toISOString() } : a
      ),
    });
  },

  getAssetById: (id: string) => {
    return get().cryptoAssets.find(a => a.id === id);
  },

  getForexPairById: (id: string) => {
    return get().forexPairs.find(p => p.id === id);
  },
}));

// Utility: fetch OHLCV data for charts (called from components)
export async function fetchOHLCVData(assetId: string, assetType: 'crypto' | 'forex', days: number): Promise<OHLCV[]> {
  const cacheKey = `ohlcv_${assetId}_${days}`;
  const cached = cacheService.get<OHLCV[]>(cacheKey);
  if (cached) return cached;

  if (assetType === 'crypto') {
    try {
      const { fetchCryptoOHLC } = await import('@/services/api/coinGecko');
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
      cacheService.set(cacheKey, ohlcv, 300_000); // 5 min cache
      return ohlcv;
    } catch {
      return cacheService.getStale<OHLCV[]>(cacheKey) || [];
    }
  }

  if (assetType === 'forex') {
    try {
      const { fetchForexHistory, FOREX_PAIRS } = await import('@/services/api/forex');
      const pair = FOREX_PAIRS.find(p => p.id === assetId);
      if (!pair) return [];
      const history = await fetchForexHistory(pair.base, pair.quote, days);
      const ohlcv: OHLCV[] = history.map(h => {
        const ts = Math.floor(new Date(h.date).getTime() / 1000);
        // Frankfurter gives close prices only — simulate OHLC
        const spread = h.rate * 0.001;
        return {
          time: ts,
          open: h.rate - spread * (Math.random() - 0.5),
          high: h.rate + spread * Math.random(),
          low: h.rate - spread * Math.random(),
          close: h.rate,
        };
      });
      cacheService.set(cacheKey, ohlcv, 300_000);
      return ohlcv;
    } catch {
      return cacheService.getStale<OHLCV[]>(cacheKey) || [];
    }
  }

  return [];
}
