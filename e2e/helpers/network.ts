import type { Page, Route } from '@playwright/test';

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  sparkline_in_7d: { price: number[] };
  last_updated: string;
};

function mockCoinGeckoMarkets(): CoinGeckoMarket[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
      current_price: 64500,
      market_cap: 1_270_000_000_000,
      total_volume: 32_000_000_000,
      price_change_24h: 850,
      price_change_percentage_24h: 1.34,
      high_24h: 65200,
      low_24h: 63300,
      sparkline_in_7d: { price: [63000, 63600, 64200, 64000, 64800, 64500] },
      last_updated: now,
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
      current_price: 3200,
      market_cap: 390_000_000_000,
      total_volume: 15_200_000_000,
      price_change_24h: -42,
      price_change_percentage_24h: -1.29,
      high_24h: 3270,
      low_24h: 3150,
      sparkline_in_7d: { price: [3300, 3260, 3240, 3210, 3190, 3200] },
      last_updated: now,
    },
    {
      id: 'solana',
      symbol: 'sol',
      name: 'Solana',
      image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
      current_price: 145,
      market_cap: 68_000_000_000,
      total_volume: 2_100_000_000,
      price_change_24h: 3.4,
      price_change_percentage_24h: 2.4,
      high_24h: 148,
      low_24h: 140,
      sparkline_in_7d: { price: [138, 140, 143, 142, 144, 145] },
      last_updated: now,
    },
  ];
}

function createMockOHLC(days: number): number[][] {
  const points = Math.max(24, Math.min(days * 8, 400));
  const now = Date.now();
  const interval = Math.max(Math.floor((days * 24 * 60 * 60 * 1000) / points), 60 * 60 * 1000);
  let previousClose = 64000;
  const rows: number[][] = [];

  for (let i = points - 1; i >= 0; i -= 1) {
    const timestamp = now - i * interval;
    const drift = Math.sin(i / 6) * 120;
    const open = previousClose;
    const close = Math.max(100, open + drift / 6);
    const high = Math.max(open, close) + 45;
    const low = Math.min(open, close) - 45;
    rows.push([timestamp, open, high, low, close]);
    previousClose = close;
  }

  return rows;
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function installNetworkMocks(page: Page): Promise<void> {
  await page.route('https://api.coingecko.com/api/v3/coins/markets**', (route) =>
    json(route, mockCoinGeckoMarkets())
  );

  await page.route('https://api.coingecko.com/api/v3/coins/*/ohlc**', (route) => {
    const url = new URL(route.request().url());
    const days = Number(url.searchParams.get('days') || '30');
    return json(route, createMockOHLC(days));
  });

  await page.route('https://api.coingecko.com/api/v3/coins/*/market_chart**', (route) => {
    const url = new URL(route.request().url());
    const days = Number(url.searchParams.get('days') || '30');
    const prices = createMockOHLC(days).map(([time, _open, _high, _low, close]) => [time, close]);
    return json(route, { prices });
  });

  await page.route('https://api.coingecko.com/api/v3/simple/price**', (route) =>
    json(route, {
      bitcoin: { usd: 64500, usd_24h_change: 1.34 },
      ethereum: { usd: 3200, usd_24h_change: -1.29 },
      solana: { usd: 145, usd_24h_change: 2.4 },
    })
  );

  await page.route('https://api.coincap.io/v2/assets**', (route) =>
    json(route, {
      data: [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', priceUsd: '64500', changePercent24Hr: '1.34', volumeUsd24Hr: '32000000000', marketCapUsd: '1270000000000' },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', priceUsd: '3200', changePercent24Hr: '-1.29', volumeUsd24Hr: '15200000000', marketCapUsd: '390000000000' },
      ],
    })
  );

  await page.route('https://open.er-api.com/v6/latest/USD', (route) =>
    json(route, {
      rates: {
        EUR: 0.92,
        GBP: 0.79,
        JPY: 156.3,
        CHF: 0.88,
        AUD: 1.51,
        CAD: 1.36,
        NZD: 1.63,
      },
    })
  );

  await page.route('https://api.frankfurter.app/latest?from=USD', (route) =>
    json(route, {
      rates: {
        EUR: 0.92,
        GBP: 0.79,
        JPY: 156.3,
      },
    })
  );

  await page.route('https://api.frankfurter.app/**', (route) => {
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const rates: Record<string, { USD: number }> = {};

    for (let i = 20; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * day).toISOString().slice(0, 10);
      rates[d] = { USD: 1.07 + i * 0.0002 };
    }

    return json(route, { rates });
  });
}
