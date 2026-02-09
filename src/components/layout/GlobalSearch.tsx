import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  TrendingUp,
  TrendingDown,
  X,
  Command,
  PlusCircle,
  Bell,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  Briefcase,
  Newspaper,
  Settings,
  TrendingUpDown,
} from 'lucide-react';
import { getForexCatalogPair, normalizeForexSymbolInput } from '@/config/forexCatalog';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/marketStore';

type CommandAction = {
  id: string;
  title: string;
  subtitle: string;
  group: 'Navigation' | 'Actions';
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  shortcut?: string;
};

type PaletteRow =
  | {
      kind: 'action';
      id: string;
      title: string;
      subtitle: string;
      group: 'Navigation' | 'Actions';
      icon: React.ComponentType<{ className?: string }>;
      run: () => void;
      shortcut?: string;
    }
  | {
      kind: 'asset';
      id: string;
      title: string;
      subtitle: string;
      symbol: string;
      displaySymbol?: string;
      assetType: 'crypto' | 'forex';
      price: number;
      change: number;
      image?: string;
      precision?: number;
      run: () => void;
    };

interface GlobalSearchProps {
  onAskAi?: () => void;
  onCreateAlert?: () => void;
  onCreateOrder?: () => void;
}

function formatPrice(price: number, type: 'crypto' | 'forex', precision?: number) {
  if (type === 'forex') return price.toFixed(precision ?? 5);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000)
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return price.toFixed(2);
}

function commandHint() {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  return /mac|iphone|ipad|ipod/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
}

export default function GlobalSearch({
  onAskAi,
  onCreateAlert,
  onCreateOrder,
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const { cryptoAssets, forexPairs } = useMarketStore();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hint = commandHint();

  const openPalette = () => {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closePalette = () => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInputTarget = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const isCommand = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';

      if (isCommand) {
        e.preventDefault();
        if (!open) openPalette();
        else closePalette();
        return;
      }

      if (
        e.key === '/' &&
        !open &&
        !isInputTarget &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        openPalette();
      }

      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePalette();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const commandActions = useMemo<CommandAction[]>(
    () => [
      {
        id: 'nav-dashboard',
        title: 'Go to Dashboard',
        subtitle: 'Portfolio pulse and macro snapshot',
        group: 'Navigation',
        keywords: ['home', 'overview', 'dashboard'],
        icon: LayoutDashboard,
        run: () => navigate('/'),
      },
      {
        id: 'nav-markets',
        title: 'Go to Markets',
        subtitle: 'Browse crypto and forex movers',
        group: 'Navigation',
        keywords: ['markets', 'prices', 'forex', 'crypto'],
        icon: TrendingUpDown,
        run: () => navigate('/markets'),
      },
      {
        id: 'nav-portfolio',
        title: 'Go to Portfolio',
        subtitle: 'Positions, orders, and PnL',
        group: 'Navigation',
        keywords: ['portfolio', 'positions', 'orders'],
        icon: Briefcase,
        run: () => navigate('/portfolio?portfolioTab=positions'),
      },
      {
        id: 'nav-news',
        title: 'Go to News',
        subtitle: 'Catalysts and sentiment feed',
        group: 'Navigation',
        keywords: ['news', 'events', 'headlines'],
        icon: Newspaper,
        run: () => navigate('/news'),
      },
      {
        id: 'nav-settings',
        title: 'Go to Settings',
        subtitle: 'Preferences, keys, and risk defaults',
        group: 'Navigation',
        keywords: ['settings', 'preferences', 'configuration'],
        icon: Settings,
        run: () => navigate('/settings?settingsTab=preferences'),
      },
      {
        id: 'action-new-order',
        title: 'New Order',
        subtitle: 'Open BTC asset and place a trade',
        group: 'Actions',
        keywords: ['trade', 'order', 'buy', 'sell'],
        icon: PlusCircle,
        run: () => {
          if (onCreateOrder) onCreateOrder();
          else navigate('/asset/bitcoin');
        },
      },
      {
        id: 'action-new-alert',
        title: 'New Alert',
        subtitle: 'Create and manage price triggers',
        group: 'Actions',
        keywords: ['alert', 'trigger', 'notification'],
        icon: Bell,
        run: () => {
          if (onCreateAlert) onCreateAlert();
          else navigate('/alerts');
        },
      },
      {
        id: 'action-ask-ai',
        title: 'Ask AI Copilot',
        subtitle: 'Open AI chat with your current context',
        group: 'Actions',
        keywords: ['ai', 'copilot', 'assistant', 'analysis'],
        icon: Sparkles,
        run: () => {
          if (onAskAi) onAskAi();
        },
        shortcut: hint,
      },
    ],
    [hint, navigate, onAskAi, onCreateAlert, onCreateOrder]
  );

  const allAssets = useMemo(
    () => [
      ...cryptoAssets.map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        displaySymbol: asset.symbol,
        name: asset.name,
        assetType: 'crypto' as const,
        price: asset.price,
        change: asset.changePercent24h,
        image: asset.image,
        precision: undefined as number | undefined,
      })),
      ...forexPairs.map((pair) => ({
        id: pair.id,
        symbol: pair.symbol,
        displaySymbol: pair.displaySymbol ?? pair.symbol,
        name: pair.name,
        assetType: 'forex' as const,
        price: pair.rate,
        change: pair.changePercent24h,
        image: undefined,
        precision: pair.displayPrecision,
      })),
    ],
    [cryptoAssets, forexPairs]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const actionRows = useMemo<PaletteRow[]>(() => {
    const filtered =
      normalizedQuery.length === 0
        ? commandActions
        : commandActions.filter((action) => {
            const haystack = `${action.title} ${action.subtitle} ${action.keywords.join(' ')}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          });

    return filtered.map((action) => ({
      kind: 'action',
      id: action.id,
      title: action.title,
      subtitle: action.subtitle,
      group: action.group,
      icon: action.icon,
      run: action.run,
      shortcut: action.shortcut,
    }));
  }, [commandActions, normalizedQuery]);

  const assetRows = useMemo<PaletteRow[]>(() => {
    const filtered =
      normalizedQuery.length === 0
        ? allAssets.slice(0, 8)
        : allAssets
            .filter((asset) => {
              const normalizedSymbol = normalizeForexSymbolInput(query);
              const catalog = getForexCatalogPair(asset.symbol);
              const aliasMatches = catalog?.aliases.some((alias) =>
                alias.toLowerCase().includes(normalizedQuery)
              );

              return (
                asset.symbol.toLowerCase().includes(normalizedQuery) ||
                asset.displaySymbol?.toLowerCase().includes(normalizedQuery) ||
                asset.name.toLowerCase().includes(normalizedQuery) ||
                (normalizedSymbol.length >= 3 && asset.symbol.includes(normalizedSymbol)) ||
                aliasMatches
              );
            })
            .slice(0, 10);

    return filtered.map((asset) => ({
      kind: 'asset',
      id: asset.id,
      title: asset.displaySymbol ?? asset.symbol,
      subtitle: asset.name,
      symbol: asset.symbol,
      displaySymbol: asset.displaySymbol,
      assetType: asset.assetType,
      price: asset.price,
      change: asset.change,
      image: asset.image,
      precision: asset.precision,
      run: () => navigate(`/asset/${asset.id}`),
    }));
  }, [allAssets, navigate, normalizedQuery, query]);

  const rows = useMemo(() => [...actionRows, ...assetRows], [actionRows, assetRows]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const runRow = (row: PaletteRow) => {
    row.run();
    closePalette();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % rows.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + rows.length) % rows.length);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      runRow(rows[activeIndex]);
    }
  };

  const renderRows = (segment: 'actions' | 'assets', offset: number) => {
    const source = segment === 'actions' ? actionRows : assetRows;

    if (source.length === 0) return null;

    return (
      <>
        <div className="px-4 py-1.5 bg-nexus-elevated/50 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
          {segment === 'actions' ? 'Actions' : 'Markets'}
        </div>
        {source.map((row, index) => {
          const globalIndex = offset + index;
          const active = activeIndex === globalIndex;

          if (row.kind === 'action') {
            const Icon = row.icon;
            return (
              <button
                key={row.id}
                type="button"
                onMouseEnter={() => setActiveIndex(globalIndex)}
                onClick={() => runRow(row)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-transparent',
                  active ? 'bg-indigo-500/10 border-indigo-500/20' : 'hover:bg-white/[0.03]'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">{row.title}</p>
                  <p className="text-xs text-slate-500 truncate">{row.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  {row.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-nexus-bg border border-nexus-border text-[10px] font-mono text-slate-500">
                      {row.shortcut}
                    </kbd>
                  )}
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={row.id}
              type="button"
              onMouseEnter={() => setActiveIndex(globalIndex)}
              onClick={() => runRow(row)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                active ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {row.image ? (
                  <img
                    src={row.image}
                    alt={row.symbol}
                    width={28}
                    height={28}
                    loading="lazy"
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                      row.assetType === 'crypto' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                    )}
                  >
                    {(row.displaySymbol ?? row.symbol).substring(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.displaySymbol ?? row.symbol}</p>
                  <p className="text-xs text-slate-500 truncate">{row.subtitle}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono">${formatPrice(row.price, row.assetType, row.precision)}</p>
                <p
                  className={cn(
                    'text-xs font-mono flex items-center gap-0.5 justify-end',
                    row.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {row.change >= 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5" />
                  )}
                  {row.change >= 0 ? '+' : ''}
                  {row.change.toFixed(2)}%
                </p>
              </div>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="hidden sm:flex w-full items-center gap-2.5 px-3.5 py-2 rounded-xl bg-nexus-elevated/70 border border-nexus-border text-sm text-slate-400 hover:text-slate-200 hover:border-indigo-500/40 transition-colors"
        aria-label="Open command palette"
      >
        <Command className="w-4 h-4 text-indigo-300" />
        <span className="truncate">Search markets or run command...</span>
        <kbd className="ml-auto px-1.5 py-0.5 rounded bg-nexus-bg border border-nexus-border text-[10px] font-mono text-slate-500">
          {hint}
        </kbd>
      </button>

      <button
        type="button"
        onClick={openPalette}
        className="sm:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
        aria-label="Open command palette"
      >
        <Search className="w-4.5 h-4.5" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/70 z-50"
            aria-label="Close command palette"
            onClick={closePalette}
          />
          <div className="fixed top-[8%] left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in modal-scroll-contain"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-nexus-border">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <label htmlFor="global-search-input" className="sr-only">
                  Search commands and markets
                </label>
                <input
                  id="global-search-input"
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Type a command or symbol..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-600"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear command query"
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="px-1.5 py-0.5 rounded bg-nexus-elevated border border-nexus-border text-[10px] font-mono text-slate-600">
                  esc
                </kbd>
              </div>

              <div className="max-h-[65vh] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No commands or assets found for "{query}"</div>
                ) : (
                  <>
                    {renderRows('actions', 0)}
                    {renderRows('assets', actionRows.length)}
                  </>
                )}
              </div>

              <div className="px-4 py-2 border-t border-nexus-border bg-nexus-elevated/40 flex items-center justify-between text-xs text-slate-600">
                <span>↑↓ navigate · ↵ run · esc close</span>
                <span>{rows.length} results</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
