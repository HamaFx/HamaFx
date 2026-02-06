import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '@/stores/marketStore';
import { generateTreemap, getPerformanceColor, TreemapRect } from '@/utils/treemap';

type SizeMode = 'marketCap' | 'volume' | 'equal';
type TimeFrame = '1h' | '24h' | '7d' | '30d';

function HeatmapTooltip({ rects, hoveredId, formatPrice }: { rects: TreemapRect[]; hoveredId: string; formatPrice: (p: number) => string }) {
  const r = rects.find(rc => rc.item.id === hoveredId);
  if (!r) return null;
  const name = String(r.item.meta?.name ?? '');
  const price = Number(r.item.meta?.price ?? 0);
  const type = String(r.item.meta?.type ?? '');
  const image = r.item.meta?.image ? String(r.item.meta.image) : null;
  return (
    <div className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur border border-nexus-border rounded-lg p-3 pointer-events-none z-10 min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        {image && <img src={image} alt="" className="w-5 h-5 rounded-full" />}
        <span className="font-bold text-white">{r.item.label}</span>
        <span className="text-xs text-slate-400">{name}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Price</span>
          <span className="text-white">{formatPrice(price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Change</span>
          <span className={r.item.change >= 0 ? 'text-green-400' : 'text-red-400'}>
            {r.item.change >= 0 ? '+' : ''}{r.item.change.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Type</span>
          <span className="text-white capitalize">{type}</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-blue-400">Click to view details →</div>
    </div>
  );
}

export function HeatmapPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { cryptoAssets, forexPairs, fetchCrypto, fetchForex, isLoadingCrypto } = useMarketStore();

  const [sizeMode, setSizeMode] = useState<SizeMode>('marketCap');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('24h');
  const [assetFilter, setAssetFilter] = useState<'all' | 'crypto' | 'forex'>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rects, setRects] = useState<TreemapRect[]>([]);
  const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

  useEffect(() => {
    fetchCrypto();
    fetchForex();
  }, [fetchCrypto, fetchForex]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ w: width, h: height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build treemap
  useEffect(() => {
    const items: { id: string; label: string; value: number; change: number; color: string; meta: Record<string, unknown> }[] = [];

    if (assetFilter !== 'forex') {
      cryptoAssets.forEach(a => {
        const change = a.changePercent24h ?? 0;
        const value = sizeMode === 'marketCap' ? (a.marketCap ?? 1) :
                      sizeMode === 'volume' ? (a.volume24h ?? 1) : 1;
        items.push({
          id: a.id,
          label: a.symbol.toUpperCase(),
          value: Math.max(value, 1),
          change,
          color: getPerformanceColor(change),
          meta: { name: a.name, price: a.price, image: a.image, type: 'crypto' },
        });
      });
    }

    if (assetFilter !== 'crypto') {
      forexPairs.forEach(a => {
        const change = a.changePercent24h ?? 0;
        items.push({
          id: a.id,
          label: a.symbol,
          value: sizeMode === 'equal' ? 1 : 100000,
          change,
          color: getPerformanceColor(change),
          meta: { name: a.name, price: a.rate, type: 'forex' },
        });
      });
    }

    if (items.length > 0 && dimensions.w > 0 && dimensions.h > 0) {
      setRects(generateTreemap(items, dimensions.w, dimensions.h));
    }
  }, [cryptoAssets, forexPairs, sizeMode, timeFrame, assetFilter, dimensions]);

  const handleClick = useCallback((id: string) => {
    navigate(`/asset/${id}`);
  }, [navigate]);

  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🗺️ Market Heatmap
          </h1>
          <p className="text-sm text-slate-400 mt-1">Visual overview of market performance</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {/* Asset filter */}
          <div className="flex bg-nexus-card rounded-lg border border-nexus-border overflow-hidden">
            {(['all', 'crypto', 'forex'] as const).map(f => (
              <button key={f} onClick={() => setAssetFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  assetFilter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {f}
              </button>
            ))}
          </div>

          {/* Size mode */}
          <div className="flex bg-nexus-card rounded-lg border border-nexus-border overflow-hidden">
            {([
              { k: 'marketCap', l: 'Mkt Cap' },
              { k: 'volume', l: 'Volume' },
              { k: 'equal', l: 'Equal' }
            ] as const).map(({ k, l }) => (
              <button key={k} onClick={() => setSizeMode(k as SizeMode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  sizeMode === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex bg-nexus-card rounded-lg border border-nexus-border overflow-hidden">
            {(['1h', '24h', '7d', '30d'] as const).map(t => (
              <button key={t} onClick={() => setTimeFrame(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeFrame === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <span>-10%</span>
        <div className="flex h-3 rounded overflow-hidden flex-1 max-w-xs">
          {['#880e4f','#b71c1c','#c62828','#e53935','#455a64','#4caf50','#388e3c','#2e7d32','#00c853'].map((c,i) => (
            <div key={i} style={{ background: c, flex: 1 }} />
          ))}
        </div>
        <span>+10%</span>
      </div>

      {/* Heatmap container */}
      <div ref={containerRef}
        className="relative bg-nexus-card border border-nexus-border rounded-xl overflow-hidden"
        style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>

        {isLoadingCrypto && rects.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : rects.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            No market data available
          </div>
        ) : (
          <svg width={dimensions.w} height={dimensions.h} className="block">
            {rects.map((r) => {
              const isHovered = hoveredId === r.item.id;
              const showLabel = r.w > 45 && r.h > 35;
              const showChange = r.w > 50 && r.h > 50;
              const showPrice = r.w > 70 && r.h > 65;
              const fontSize = Math.max(10, Math.min(r.w / 6, r.h / 4, 18));

              return (
                <g key={r.item.id}
                  onMouseEnter={() => setHoveredId(r.item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleClick(r.item.id)}
                  className="cursor-pointer">
                  <rect
                    x={r.x + 1} y={r.y + 1}
                    width={Math.max(r.w - 2, 0)} height={Math.max(r.h - 2, 0)}
                    rx={4}
                    fill={r.item.color}
                    opacity={isHovered ? 1 : 0.85}
                    stroke={isHovered ? '#fff' : 'rgba(0,0,0,0.3)'}
                    strokeWidth={isHovered ? 2 : 1}
                    className="transition-opacity duration-150"
                  />
                  {showLabel && (
                    <>
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (showChange ? fontSize * 0.5 : 0)}
                        textAnchor="middle" dominantBaseline="central"
                        fill="white" fontWeight="bold"
                        fontSize={fontSize}
                        className="pointer-events-none select-none">
                        {r.item.label}
                      </text>
                      {showChange && (
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fontSize * 0.6}
                          textAnchor="middle" dominantBaseline="central"
                          fill="rgba(255,255,255,0.9)" fontWeight="500"
                          fontSize={Math.max(9, fontSize * 0.7)}
                          className="pointer-events-none select-none">
                          {r.item.change >= 0 ? '+' : ''}{r.item.change.toFixed(2)}%
                        </text>
                      )}
                      {showPrice && r.item.meta?.price && (
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fontSize * 1.4}
                          textAnchor="middle" dominantBaseline="central"
                          fill="rgba(255,255,255,0.65)" fontWeight="400"
                          fontSize={Math.max(8, fontSize * 0.55)}
                          className="pointer-events-none select-none">
                          {formatPrice(r.item.meta.price as number)}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}

                {/* Tooltip */}
        {hoveredId && <HeatmapTooltip rects={rects} hoveredId={hoveredId} formatPrice={formatPrice} />}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Rectangle size based on {sizeMode === 'marketCap' ? 'market capitalization' : sizeMode === 'volume' ? '24h trading volume' : 'equal weighting'}. 
        Color represents {timeFrame} price performance. Click any asset for details.
      </p>
    </div>
  );
}

export default HeatmapPage;
