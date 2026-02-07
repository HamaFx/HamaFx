import { withRedisCache } from './redis';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINCAP_BASE = 'https://api.coincap.io/v2';

export async function getCryptoMarkets(perPage = 50) {
  return withRedisCache(`markets:crypto:${perPage}`, 30, async () => {
    const primary = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=24h`
    );
    if (primary.ok) {
      return await primary.json();
    }

    const fallback = await fetch(`${COINCAP_BASE}/assets?limit=${perPage}`);
    if (!fallback.ok) {
      throw new Error(`Market providers failed (${primary.status}, ${fallback.status})`);
    }
    const data = await fallback.json();
    return data.data ?? [];
  });
}

export async function getCryptoOHLC(coinId: string, days: number) {
  return withRedisCache(`ohlc:${coinId}:${days}`, 30, async () => {
    const res = await fetch(`${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`);
    if (!res.ok) throw new Error(`CoinGecko OHLC failed: ${res.status}`);
    return res.json();
  });
}

export async function getCryptoChart(coinId: string, days: number) {
  return withRedisCache(`chart:${coinId}:${days}`, 30, async () => {
    const res = await fetch(`${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
    if (!res.ok) throw new Error(`CoinGecko chart failed: ${res.status}`);
    return res.json();
  });
}

export async function getForexRates() {
  return withRedisCache('forex:latest', 20, async () => {
    const primary = await fetch('https://open.er-api.com/v6/latest/USD');
    if (primary.ok) {
      const data = await primary.json();
      return data.rates ?? {};
    }

    const fallback = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!fallback.ok) throw new Error(`Forex providers failed (${primary.status}, ${fallback.status})`);
    const data = await fallback.json();
    return data.rates ?? {};
  });
}

export async function getForexHistory(base: string, quote: string, from: string, to: string) {
  return withRedisCache(`forex:history:${base}:${quote}:${from}:${to}`, 300, async () => {
    const res = await fetch(`https://api.frankfurter.app/${from}..${to}?from=${base}&to=${quote}`);
    if (!res.ok) throw new Error(`Forex history failed: ${res.status}`);
    return res.json();
  });
}
