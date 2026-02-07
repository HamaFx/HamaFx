import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Plus, Trash2, TrendingUp, TrendingDown, Edit2, Check, X,
  AlertTriangle, ArrowUpRight, Layers
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useMarketStore } from '@/stores/marketStore';
import type { Asset, ForexPair } from '@/types';

function formatPrice(price: number, type: string) {
  if (type === 'forex') return price.toFixed(4);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function MiniSparkline({ data, positive }: { data?: number[]; positive: boolean }) {
  if (!data || data.length < 5) return null;
  const points = data.slice(-20);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  const pathData = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={pathData} fill="none" stroke={positive ? '#10b981' : '#ef4444'} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export default function WatchlistPage() {
  const { watchlists, createWatchlist, deleteWatchlist, renameWatchlist, removeSymbol, setActiveWatchlist, activeWatchlistId } = useWatchlistStore();
  const { cryptoAssets, forexPairs } = useMarketStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Watchlists — HamaFX';
    if (watchlists.length > 0 && !activeWatchlistId) {
      setActiveWatchlist(watchlists[0].id);
    }
  }, [watchlists, activeWatchlistId, setActiveWatchlist]);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];

  const getAssetData = (symbol: string, assetType: string) => {
    if (assetType === 'crypto') {
      return cryptoAssets.find(a => a.symbol === symbol);
    }
    return forexPairs.find(p => p.symbol === symbol);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const wl = createWatchlist(newName.trim());
    setActiveWatchlist(wl.id);
    setNewName('');
    setShowCreate(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameWatchlist(id, editName.trim());
    setEditingId(null);
  };

  // All available assets for adding
  const allAssets = [
    ...cryptoAssets.map(a => ({ symbol: a.symbol, name: a.name, type: 'crypto' as const, price: a.price, change: a.changePercent24h, image: a.image })),
    ...forexPairs.map(p => ({ symbol: p.symbol, name: p.name, type: 'forex' as const, price: p.rate, change: p.changePercent24h, image: undefined })),
  ];

  const filteredAssets = allAssets.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    }
    return true;
  }).filter(a => !activeWatchlist?.symbols.some(s => s.symbol === a.symbol));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold">Watchlists</h1>
            <p className="text-xs text-slate-500">
              {watchlists.length} list{watchlists.length !== 1 ? 's' : ''} · {watchlists.reduce((s, w) => s + w.symbols.length, 0)} assets tracked
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-4 animate-slide-up flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Watchlist name..."
            className="flex-1 px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-600"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50">
            Create
          </button>
          <button onClick={() => { setShowCreate(false); setNewName(''); }} className="px-3 py-2.5 rounded-lg bg-nexus-elevated text-slate-400 text-sm">
            Cancel
          </button>
        </div>
      )}

      {/* Watchlist Tabs */}
      {watchlists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {watchlists.map(wl => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlist(wl.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                activeWatchlistId === wl.id
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-nexus-elevated text-slate-400 border border-nexus-border hover:text-slate-200'
              )}
            >
              <Star className={cn('w-3.5 h-3.5', activeWatchlistId === wl.id && 'fill-current')} />
              {editingId === wl.id ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-24 px-1 py-0.5 rounded bg-nexus-bg border border-nexus-border text-xs"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleRename(wl.id)}
                  />
                  <button onClick={() => handleRename(wl.id)} className="text-emerald-400"><Check className="w-3 h-3" /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <>
                  {wl.name} ({wl.symbols.length})
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {watchlists.length === 0 && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <Star className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No watchlists yet</p>
          <p className="text-xs text-slate-500 mt-1">Create a watchlist to track your favorite assets</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium mx-auto"
          >
            <Plus className="w-4 h-4" /> Create Your First Watchlist
          </button>
        </div>
      )}

      {/* Active Watchlist Content */}
      {activeWatchlist && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-nexus-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold">{activeWatchlist.name}</h2>
              <span className="text-xs text-slate-500">{activeWatchlist.symbols.length} assets</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nexus-elevated text-xs text-slate-400 hover:text-slate-200 border border-nexus-border"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <button
                onClick={() => { setEditingId(activeWatchlist.id); setEditName(activeWatchlist.name); }}
                aria-label="Rename watchlist"
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300"
                title="Rename"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {watchlists.length > 1 && (
                <button
                  onClick={() => {
                    deleteWatchlist(activeWatchlist.id);
                    setActiveWatchlist(watchlists.find(w => w.id !== activeWatchlist.id)?.id || null);
                  }}
                  aria-label="Delete watchlist"
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                  title="Delete watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {activeWatchlist.symbols.length === 0 ? (
            <div className="p-8 text-center">
              <Star className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">This watchlist is empty</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mx-auto"
              >
                <Plus className="w-3 h-3" /> Add assets to track
              </button>
            </div>
          ) : (
            <div className="divide-y divide-nexus-border">
              {activeWatchlist.symbols.map(item => {
                const assetData = getAssetData(item.symbol, item.assetType);
                if (!assetData) return null;

                const isFx = 'rate' in assetData;
                const price = isFx ? (assetData as ForexPair).rate : (assetData as Asset).price;
                const change = isFx ? (assetData as ForexPair).changePercent24h : (assetData as Asset).changePercent24h;
                const isPositive = change >= 0;
                const assetId = assetData.id;

                return (
                  <div key={item.symbol} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <Link
                      to={`/asset/${assetId}`}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      {'image' in assetData && (assetData as Asset).image ? (
                        <img src={(assetData as Asset).image!} alt={item.symbol} width={32} height={32} loading="lazy" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                          item.assetType === 'crypto' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                        )}>
                          {item.symbol.substring(0, 2)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{item.symbol}</p>
                        <p className="text-xs text-slate-500">{assetData.name}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-4">
                      {'sparkline' in assetData && (
                        <MiniSparkline data={(assetData as Asset).sparkline} positive={isPositive} />
                      )}
                      <div className="text-right min-w-[80px]">
                        <p className="text-sm font-mono font-medium">${formatPrice(price, item.assetType)}</p>
                        <p className={cn(
                          'text-xs font-mono flex items-center gap-0.5 justify-end',
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </p>
                      </div>
                      <button
                        onClick={() => removeSymbol(activeWatchlist.id, item.symbol)}
                        aria-label={`Remove ${item.symbol} from watchlist`}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && activeWatchlist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => { setShowAddModal(false); setSearchQuery(''); }} />
          <div className="relative bg-nexus-card rounded-xl border border-nexus-border w-full max-w-md max-h-[70vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-nexus-border shrink-0">
              <h3 className="text-sm font-semibold">Add to {activeWatchlist.name}</h3>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(''); }} aria-label="Close add asset modal" className="p-1 hover:bg-white/5 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="px-4 py-3 border-b border-nexus-border shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-600"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-nexus-border">
              {filteredAssets.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No matching assets</div>
              ) : (
                filteredAssets.slice(0, 20).map(asset => (
                  <button
                    key={asset.symbol}
                    onClick={() => {
                      useWatchlistStore.getState().addSymbol(activeWatchlist.id, asset.symbol, asset.type);
                    }}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {asset.image ? (
                        <img src={asset.image} alt={asset.symbol} width={28} height={28} loading="lazy" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                          asset.type === 'crypto' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                        )}>
                          {asset.symbol.substring(0, 2)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{asset.symbol}</p>
                        <p className="text-xs text-slate-500">{asset.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">${formatPrice(asset.price, asset.type)}</span>
                      <Plus className="w-4 h-4 text-amber-400" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="flex gap-3">
        <Link
          to="/markets"
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowUpRight className="w-3 h-3" /> Explore Markets
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Watchlist data updates in real-time. Prices are for educational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
