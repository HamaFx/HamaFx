import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown, Grid3X3, List, RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/marketStore';
import { PremiumCard, PremiumBadge, PremiumButton, PremiumInput, TabBar, EmptyState } from '@/components/ui/Premium';
import type { Asset, ForexPair } from '@/types';

type FilterType = 'all' | 'crypto' | 'forex';
type SortField = 'name' | 'price' | 'change' | 'volume' | 'marketCap';

interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  assetType: 'crypto' | 'forex';
  image?: string;
  sparkline?: number[];
}

function toMarketRow(asset: Asset): MarketRow {
  return {
    id: asset.id, symbol: asset.symbol, name: asset.name,
    price: asset.price, changePercent: asset.changePercent24h,
    volume: asset.volume24h, marketCap: asset.marketCap || 0,
    assetType: 'crypto', image: asset.image, sparkline: asset.sparkline,
  };
}

function forexToMarketRow(pair: ForexPair): MarketRow {
  return {
    id: pair.id, symbol: pair.symbol, name: pair.name,
    price: pair.rate, changePercent: pair.changePercent24h,
    volume: 0, marketCap: 0, assetType: 'forex',
  };
}

function formatPrice(price: number, type: string) {
  if (type === 'forex') return price.toFixed(4);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function formatVolume(vol: number) {
  if (vol <= 0) return '—';
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}T`;
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  return `$${vol.toLocaleString()}`;
}

function formatMarketCap(mc: number) {
  if (mc <= 0) return '—';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={`sg-${positive ? 'g' : 'r'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
          <stop offset="100%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#sg-${positive ? 'g' : 'r'})`} />
      <polyline points={points} fill="none" stroke={positive ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Markets() {
  const navigate = useNavigate();
  const { cryptoAssets, forexPairs, isLoadingCrypto, wsConnected, dataSource, fetchCrypto, fetchForex } = useMarketStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortField, setSortField] = useState<SortField>('marketCap');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    document.title = 'Markets — NexusTrade';
    if (cryptoAssets.length === 0) fetchCrypto();
    if (forexPairs.length === 0) fetchForex();
  }, [cryptoAssets.length, forexPairs.length, fetchCrypto, fetchForex]);

  const allRows: MarketRow[] = [...cryptoAssets.map(toMarketRow), ...forexPairs.map(forexToMarketRow)];

  const filtered = allRows
    .filter(r => {
      if (filter !== 'all' && r.assetType !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'name': diff = a.symbol.localeCompare(b.symbol); break;
        case 'price': diff = a.price - b.price; break;
        case 'change': diff = a.changePercent - b.changePercent; break;
        case 'volume': diff = a.volume - b.volume; break;
        case 'marketCap': diff = a.marketCap - b.marketCap; break;
      }
      return sortAsc ? diff : -diff;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const isLoading = isLoadingCrypto && allRows.length === 0;

  // Top movers
  const topGainer = [...allRows].sort((a, b) => b.changePercent - a.changePercent)[0];
  const topLoser = [...allRows].sort((a, b) => a.changePercent - b.changePercent)[0];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Markets</h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            {allRows.length} assets
            {dataSource !== 'none' && <PremiumBadge variant="default" size="xs">via {dataSource}</PremiumBadge>}
            {wsConnected && <PremiumBadge variant="success" size="xs" dot pulse>Live</PremiumBadge>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PremiumButton variant="ghost" size="sm" onClick={() => { fetchCrypto(); fetchForex(); }}
            icon={<RefreshCw className={cn('w-3.5 h-3.5', isLoadingCrypto && 'animate-spin')} />}
          />
          <div className="hidden sm:flex items-center gap-0.5 bg-nexus-elevated rounded-xl p-0.5 border border-nexus-border">
            <button onClick={() => setViewMode('list')} className={cn('p-2 rounded-lg transition-all', viewMode === 'list' ? 'bg-nexus-card text-white shadow-sm' : 'text-slate-500')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn('p-2 rounded-lg transition-all', viewMode === 'grid' ? 'bg-nexus-card text-white shadow-sm' : 'text-slate-500')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Movers Strip */}
      {topGainer && topLoser && !isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <PremiumCard className="p-3 cursor-pointer card-hover" glow="emerald" onClick={() => navigate(`/asset/${topGainer.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Top Gainer</p>
                  <p className="text-sm font-semibold">{topGainer.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-emerald-400">+{topGainer.changePercent.toFixed(2)}%</p>
                <p className="text-[10px] text-slate-500 font-mono">${formatPrice(topGainer.price, topGainer.assetType)}</p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3 cursor-pointer card-hover" glow="red" onClick={() => navigate(`/asset/${topLoser.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Top Loser</p>
                  <p className="text-sm font-semibold">{topLoser.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-red-400">{topLoser.changePercent.toFixed(2)}%</p>
                <p className="text-[10px] text-slate-500 font-mono">${formatPrice(topLoser.price, topLoser.assetType)}</p>
              </div>
            </div>
          </PremiumCard>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <PremiumInput
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            size="sm"
          />
        </div>
        <TabBar
          tabs={[
            { id: 'all' as FilterType, label: 'All', count: allRows.length },
            { id: 'crypto' as FilterType, label: 'Crypto', count: cryptoAssets.length },
            { id: 'forex' as FilterType, label: 'Forex', count: forexPairs.length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <PremiumCard className="p-5 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-shimmer rounded-lg h-14 w-full" />
          ))}
        </PremiumCard>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && (
        <PremiumCard>
          {/* Header Row */}
          <div className="hidden sm:grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_80px] px-5 py-3 border-b border-nexus-border text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
            <button onClick={() => handleSort('name')} className="text-left hover:text-slate-300 transition-colors flex items-center gap-1">
              Asset {sortField === 'name' && (sortAsc ? '↑' : '↓')}
            </button>
            <button onClick={() => handleSort('price')} className="text-right hover:text-slate-300 transition-colors">
              Price {sortField === 'price' && (sortAsc ? '↑' : '↓')}
            </button>
            <button onClick={() => handleSort('change')} className="text-right hover:text-slate-300 transition-colors">
              24h Change {sortField === 'change' && (sortAsc ? '↑' : '↓')}
            </button>
            <button onClick={() => handleSort('volume')} className="text-right hover:text-slate-300 transition-colors">
              Volume {sortField === 'volume' && (sortAsc ? '↑' : '↓')}
            </button>
            <button onClick={() => handleSort('marketCap')} className="text-right hover:text-slate-300 transition-colors">
              Mkt Cap {sortField === 'marketCap' && (sortAsc ? '↑' : '↓')}
            </button>
            <span className="text-right">7d</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-nexus-border/50 stagger-fast">
            {filtered.map((row) => (
              <button
                key={row.id}
                onClick={() => navigate(`/asset/${row.id}`)}
                className="w-full grid grid-cols-2 sm:grid-cols-[2.5fr_1fr_1fr_1fr_1fr_80px] items-center px-5 py-3.5 hover:bg-white/[0.02] transition-all text-left group"
              >
                {/* Asset Info */}
                <div className="flex items-center gap-3">
                  {row.image ? (
                    <img src={row.image} alt={row.symbol} className="w-9 h-9 rounded-full ring-1 ring-white/5" />
                  ) : (
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
                      row.assetType === 'crypto' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                    )}>
                      {row.symbol.substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold group-hover:text-white transition-colors">{row.symbol}</p>
                      <PremiumBadge variant={row.assetType === 'crypto' ? 'warning' : 'info'} size="xs">
                        {row.assetType}
                      </PremiumBadge>
                    </div>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">{row.name}</p>
                  </div>
                </div>

                {/* Price */}
                <p className="text-sm font-mono font-semibold text-right tabular-nums">
                  ${formatPrice(row.price, row.assetType)}
                </p>

                {/* Change */}
                <div className={cn(
                  'flex items-center gap-1 justify-end text-sm font-mono font-medium',
                  row.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {row.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{row.changePercent >= 0 ? '+' : ''}{row.changePercent.toFixed(2)}%</span>
                </div>

                {/* Volume */}
                <p className="hidden sm:block text-sm text-slate-400 text-right font-mono tabular-nums">
                  {formatVolume(row.volume)}
                </p>

                {/* Market Cap */}
                <p className="hidden sm:block text-sm text-slate-400 text-right font-mono tabular-nums">
                  {formatMarketCap(row.marketCap)}
                </p>

                {/* Sparkline */}
                <div className="hidden sm:flex justify-end">
                  {row.sparkline && <MiniSparkline data={row.sparkline} positive={row.changePercent >= 0} />}
                </div>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="No assets found"
              description="Try adjusting your search or filters"
            />
          )}
        </PremiumCard>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
          {filtered.map(row => (
            <PremiumCard
              key={row.id}
              hover
              glow={row.changePercent >= 0 ? 'emerald' : 'red'}
              className="p-4"
              onClick={() => navigate(`/asset/${row.id}`)}
            >
              <div className="flex items-center gap-2.5 mb-3">
                {row.image ? (
                  <img src={row.image} alt={row.symbol} className="w-8 h-8 rounded-full ring-1 ring-white/5" />
                ) : (
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                    row.assetType === 'crypto' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                  )}>
                    {row.symbol.substring(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold">{row.symbol}</p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[80px]">{row.name}</p>
                </div>
              </div>

              {/* Sparkline */}
              {row.sparkline && (
                <div className="mb-2">
                  <MiniSparkline data={row.sparkline} positive={row.changePercent >= 0} />
                </div>
              )}

              <p className="text-lg font-mono font-bold tracking-tight">${formatPrice(row.price, row.assetType)}</p>
              <div className={cn(
                'text-sm font-mono font-medium mt-1 flex items-center gap-1',
                row.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {row.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {row.changePercent >= 0 ? '+' : ''}{row.changePercent.toFixed(2)}%
              </div>
              {row.volume > 0 && (
                <p className="text-[10px] text-slate-500 mt-1.5 font-mono">Vol: {formatVolume(row.volume)}</p>
              )}
            </PremiumCard>
          ))}
        </div>
      )}

      {/* Market Stats Bar */}
      {!isLoading && allRows.length > 0 && (
        <div className="flex items-center justify-center gap-6 py-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {allRows.filter(r => r.changePercent > 0).length} gainers</span>
          <span>{allRows.filter(r => r.changePercent < 0).length} losers</span>
          <span>{wsConnected ? <Wifi className="w-3 h-3 inline text-emerald-500" /> : <WifiOff className="w-3 h-3 inline" />} {wsConnected ? 'Streaming' : 'Polling'}</span>
          <span className="hidden sm:inline">Total Vol: {formatVolume(allRows.reduce((s, r) => s + r.volume, 0))}</span>
        </div>
      )}
    </div>
  );
}
