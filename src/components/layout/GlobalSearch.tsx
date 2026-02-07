import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/marketStore';

function formatPrice(price: number, type: string) {
  if (type === 'forex') return price.toFixed(4);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { cryptoAssets, forexPairs } = useMarketStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !open && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const allAssets = [
    ...cryptoAssets.map(a => ({
      id: a.id, symbol: a.symbol, name: a.name, type: 'crypto' as const,
      price: a.price, change: a.changePercent24h, image: a.image,
    })),
    ...forexPairs.map(p => ({
      id: p.id, symbol: p.symbol, name: p.name, type: 'forex' as const,
      price: p.rate, change: p.changePercent24h, image: undefined,
    })),
  ];

  const results = query.length > 0
    ? allAssets.filter(a => {
        const q = query.toLowerCase();
        return a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      }).slice(0, 8)
    : allAssets.slice(0, 6);

  const handleSelect = (id: string) => {
    navigate(`/asset/${id}`);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-elevated border border-nexus-border text-xs text-slate-500 hover:text-slate-300 hover:border-nexus-border transition-colors"
        aria-label="Open global search"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="px-1.5 py-0.5 rounded bg-nexus-bg border border-nexus-border text-[10px] font-mono text-slate-600">/</kbd>
      </button>

      {/* Mobile trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="sm:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
        aria-label="Open global search"
      >
        <Search className="w-4.5 h-4.5" />
      </button>

      {/* Search Modal */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/60 z-50"
            aria-label="Close search"
            onClick={() => { setOpen(false); setQuery(''); }}
          />
          <div className="fixed top-[10%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Global asset search"
              className="bg-nexus-card border border-nexus-border rounded-xl shadow-2xl overflow-hidden animate-fade-in modal-scroll-contain"
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-nexus-border">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <label htmlFor="global-search-input" className="sr-only">Search assets</label>
                <input
                  id="global-search-input"
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search assets, pairs, markets..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-600"
                  autoComplete="off"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search query" className="text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="px-1.5 py-0.5 rounded bg-nexus-elevated border border-nexus-border text-[10px] font-mono text-slate-600">esc</kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No results for "{query}"
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-1.5 bg-nexus-elevated/50">
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                        {query ? 'Results' : 'Popular'}
                      </span>
                    </div>
                    {results.map(asset => (
                      <button
                        key={asset.id}
                        onClick={() => handleSelect(asset.id)}
                        aria-label={`Open ${asset.symbol} details`}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
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
                        <div className="text-right">
                          <p className="text-sm font-mono">${formatPrice(asset.price, asset.type)}</p>
                          <p className={cn(
                            'text-xs font-mono flex items-center gap-0.5 justify-end',
                            asset.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                          )}>
                            {asset.change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Footer Hint */}
              <div className="px-4 py-2 border-t border-nexus-border bg-nexus-elevated/50 flex items-center justify-between">
                <span className="text-xs text-slate-600">Navigate with ↑↓ · Select with ↵</span>
                <span className="text-xs text-slate-600">{allAssets.length} assets</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
