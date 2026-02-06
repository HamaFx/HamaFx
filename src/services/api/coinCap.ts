// CoinCap API Client — Fallback crypto + WebSocket streaming
// Free tier: 200 calls/min, no auth, CORS-friendly
// WebSocket: wss://ws.coincap.io/prices?assets=bitcoin,ethereum

const BASE_URL = 'https://api.coincap.io/v2';

interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  priceUsd: string;
  changePercent24Hr: string;
  volumeUsd24Hr: string;
  marketCapUsd: string;
}

export async function fetchCoinCapAssets(limit = 25): Promise<CoinCapAsset[]> {
  const res = await fetch(`${BASE_URL}/assets?limit=${limit}`);
  if (!res.ok) throw new Error(`CoinCap assets failed: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export function mapCoinCapToAsset(item: CoinCapAsset) {
  const price = parseFloat(item.priceUsd) || 0;
  const changePercent = parseFloat(item.changePercent24Hr) || 0;
  return {
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    assetType: 'crypto' as const,
    price,
    change24h: price * (changePercent / 100),
    changePercent24h: changePercent,
    high24h: 0,
    low24h: 0,
    volume24h: parseFloat(item.volumeUsd24Hr) || 0,
    marketCap: parseFloat(item.marketCapUsd) || 0,
    image: undefined,
    sparkline: undefined,
    lastUpdated: new Date().toISOString(),
  };
}

// WebSocket connection for real-time crypto prices
export type PriceUpdateCallback = (prices: Record<string, number>) => void;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectCoinCapWebSocket(
  assetIds: string[],
  onPriceUpdate: PriceUpdateCallback,
  onStatusChange?: (connected: boolean) => void
): () => void {
  const connect = () => {
    try {
      const ids = assetIds.join(',');
      ws = new WebSocket(`wss://ws.coincap.io/prices?assets=${ids}`);

      ws.onopen = () => {
        reconnectAttempts = 0;
        onStatusChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const prices: Record<string, number> = {};
          for (const [key, value] of Object.entries(data)) {
            prices[key] = parseFloat(value as string);
          }
          if (Object.keys(prices).length > 0) {
            onPriceUpdate(prices);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        onStatusChange?.(false);
        if (reconnectAttempts < MAX_RECONNECT) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      onStatusChange?.(false);
    }
  };

  connect();

  // Return cleanup function
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectAttempts = MAX_RECONNECT; // Prevent reconnection
    ws?.close();
    ws = null;
  };
}
