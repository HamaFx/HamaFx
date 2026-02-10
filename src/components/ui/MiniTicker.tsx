import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

function formatTickerPrice(price: number, isForex: boolean): string {
  return price.toLocaleString(undefined, {
    maximumFractionDigits: isForex ? 4 : 2,
  });
}

export function MiniTicker() {
  const { cryptoAssets, forexPairs, isLoadingCrypto, isLoadingForex } = useMarketStore();

  const assets = [...cryptoAssets.slice(0, 3), ...forexPairs.slice(0, 2)];
  const isLoading = isLoadingCrypto || isLoadingForex;

  if (assets.length === 0) {
    return (
      <div className="hidden md:flex h-8 w-64 items-center rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] text-slate-500">
        {isLoading ? (
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        ) : (
          <span className="truncate">Waiting for market feed...</span>
        )}
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center overflow-hidden h-8 w-64 mask-linear-fade relative group cursor-default">
      <div className="flex items-center gap-6 animate-ticker whitespace-nowrap group-hover:[animation-play-state:paused]">
        {[...assets, ...assets].map((asset, i) => {
          const isForex = 'rate' in asset;
          const price = isForex ? asset.rate : asset.price;
          const change = asset.changePercent24h;

          return (
            <div key={`${asset.id}-${i}`} className="flex items-center gap-2 text-xs font-mono">
              <span className="font-bold text-slate-300">{asset.symbol}</span>
              <span
                className={cn(
                  'flex items-center gap-0.5',
                  change >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {formatTickerPrice(price, isForex)}
                {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-nexus-card to-transparent" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-nexus-card to-transparent" />
    </div>
  );
}
