import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/utils/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function MiniTicker() {
  const { cryptoAssets, forexPairs } = useMarketStore();

  // Combine top assets (e.g. BTC, ETH, EURUSD, GBPUSD)
  const assets = [
    ...cryptoAssets.slice(0, 3),
    ...forexPairs.slice(0, 2)
  ];

  if (assets.length === 0) return null;

  return (
    <div className="hidden md:flex items-center overflow-hidden h-8 w-64 mask-linear-fade relative group cursor-default">
      {/* Ticker Content */}
      <div className="flex items-center gap-6 animate-ticker whitespace-nowrap group-hover:[animation-play-state:paused]">
        {[...assets, ...assets].map((asset, i) => { // Duplicate for seamless loop
          const isFx = 'rate' in asset;
          const price = isFx ? asset.rate : asset.price;
          const change = asset.changePercent24h;
          
          return (
            <div key={`${asset.id}-${i}`} className="flex items-center gap-2 text-xs font-mono">
              <span className="font-bold text-slate-300">{asset.symbol}</span>
              <span className={cn(
                "flex items-center gap-0.5",
                change >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {price.toLocaleString(undefined, { maximumFractionDigits: isFx ? 4 : 2 })}
                {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Fade Edges */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-nexus-card to-transparent" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-nexus-card to-transparent" />
    </div>
  );
}
