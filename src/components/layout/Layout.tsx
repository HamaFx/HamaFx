import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Newspaper,
  Star,
  Calendar,
  FlaskConical,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Grid3X3,
  Bell,
  Shield,
  Columns2,
  MessageCircle,
  Clock3,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useChatStore } from '@/stores/chatStore';
import { useMarketStore } from '@/stores/marketStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { cn } from '@/utils/cn';
import { readMarketsUrlState, readPortfolioUrlState, readSettingsUrlState } from '@/utils/urlState';
import { getForexSessionSnapshot } from '@/services/forexSessions';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';
import AIChatDrawer from '../AIChatDrawer';
import { AiCompanion } from '@/components/ui/AiCompanion';
import { MiniTicker } from '@/components/ui/MiniTicker';
import { PageTransition } from '@/components/ui/PageTransition';
import { isBackendEnabled } from '@/services/backend/config';

type NavGroupId = 'trade' | 'research' | 'automation' | 'account';

type NavItemDef = {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  mobileLabel?: string;
  group: NavGroupId;
  description: string;
};

type SecondaryLink = {
  label: string;
  to: string;
  active: boolean;
};

type NavBadge = {
  text: string;
  toneClass: string;
  title: string;
};

const SIDEBAR_COLLAPSE_KEY = 'hamafx_sidebar_collapsed_v1';
const SIDEBAR_FAVORITES_KEY = 'hamafx_sidebar_favorites_v1';
const SIDEBAR_RECENTS_KEY = 'hamafx_sidebar_recents_v1';
const DEFAULT_FAVORITES = ['/', '/markets', '/portfolio'];
const SIDEBAR_COLLAPSED_CLASS = 'w-[4.75rem]';
const SIDEBAR_EXPANDED_CLASS = 'w-64';
const HEADER_HEIGHT_CLASS = 'h-14 md:h-16';

const navItems: NavItemDef[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', mobileLabel: 'Home', group: 'trade', description: 'Overview and command center' },
  { to: '/markets', icon: TrendingUp, label: 'Markets', group: 'trade', description: 'Live crypto and forex prices' },
  { to: '/terminal', icon: Columns2, label: 'Terminal', group: 'trade', description: 'Multi-chart execution workspace' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio', group: 'trade', description: 'Positions, orders, and history' },
  { to: '/watchlist', icon: Star, label: 'Watchlist', mobileLabel: 'Watch', group: 'research', description: 'Pinned assets and ideas' },
  { to: '/news', icon: Newspaper, label: 'News', group: 'research', description: 'Catalysts and macro headlines' },
  { to: '/calendar', icon: Calendar, label: 'Calendar', group: 'research', description: 'Economic events and releases' },
  { to: '/heatmap', icon: Grid3X3, label: 'Heatmap', group: 'research', description: 'Visual market breadth' },
  { to: '/alerts', icon: Bell, label: 'Alerts', group: 'automation', description: 'Price trigger automation' },
  { to: '/risk', icon: Shield, label: 'Risk', group: 'automation', description: 'Guardrails and exposure' },
  { to: '/backtest', icon: FlaskConical, label: 'Backtest', group: 'automation', description: 'Strategy validation lab' },
  { to: '/settings', icon: Settings, label: 'Settings', mobileLabel: 'More', group: 'account', description: 'Preferences and integrations' },
];

const navGroups: { id: NavGroupId; label: string }[] = [
  { id: 'trade', label: 'Trade' },
  { id: 'research', label: 'Research' },
  { id: 'automation', label: 'Automation' },
  { id: 'account', label: 'Account' },
];

const mobileNavItems = navItems.filter((item) => ['/', '/markets', '/portfolio', '/watchlist', '/settings'].includes(item.to));

function readStoredRoutes(key: string, fallback: string[]): string[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return fallback;
  }
}

function saveStoredRoutes(key: string, routes: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(routes));
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'No insights yet';
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes < 1) return 'Updated just now';
  if (deltaMinutes < 60) return `Updated ${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `Updated ${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  return `Updated ${deltaDays}d ago`;
}

function pageMetaForPath(pathname: string) {
  if (pathname.startsWith('/markets')) {
    return { title: 'Markets', subtitle: 'Cross-asset discovery and momentum', icon: TrendingUp };
  }
  if (pathname.startsWith('/terminal')) {
    return { title: 'Terminal', subtitle: 'Execution-focused multi-chart workspace', icon: Columns2 };
  }
  if (pathname.startsWith('/portfolio')) {
    return { title: 'Portfolio', subtitle: 'Capital allocation and trade outcomes', icon: Briefcase };
  }
  if (pathname.startsWith('/watchlist')) {
    return { title: 'Watchlist', subtitle: 'Priority symbols and setups', icon: Star };
  }
  if (pathname.startsWith('/alerts')) {
    return { title: 'Alerts', subtitle: 'Automated signal monitoring', icon: Bell };
  }
  if (pathname.startsWith('/news')) {
    return { title: 'News', subtitle: 'Narratives, catalysts, and risk events', icon: Newspaper };
  }
  if (pathname.startsWith('/calendar')) {
    return { title: 'Calendar', subtitle: 'Upcoming macro events', icon: Calendar };
  }
  if (pathname.startsWith('/risk')) {
    return { title: 'Risk', subtitle: 'Exposure limits and controls', icon: Shield };
  }
  if (pathname.startsWith('/backtest')) {
    return { title: 'Backtest', subtitle: 'Validate strategy logic', icon: FlaskConical };
  }
  if (pathname.startsWith('/settings')) {
    return { title: 'Settings', subtitle: 'Personalization and integrations', icon: Settings };
  }
  if (pathname.startsWith('/heatmap')) {
    return { title: 'Heatmap', subtitle: 'Market breadth at a glance', icon: Grid3X3 };
  }
  return { title: 'Dashboard', subtitle: 'AI-guided trading command center', icon: LayoutDashboard };
}

function NavItem({
  item,
  collapsed,
  onClick,
  showPin,
  isFavorite,
  onToggleFavorite,
  badge,
}: {
  item: NavItemDef;
  collapsed?: boolean;
  onClick?: () => void;
  showPin?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (route: string) => void;
  badge?: NavBadge;
}) {
  const Icon = item.icon;

  return (
    <div className={cn('group relative flex items-center', collapsed ? 'mx-0' : 'mx-2')}>
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        onClick={onClick}
        data-sidebar-nav-link="true"
        className={({ isActive }) =>
          cn(
            'group/nav relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden touch-target',
            collapsed ? 'justify-center px-2 py-2.5 w-full' : 'px-3 py-2.5 w-full',
            !collapsed && showPin && 'pr-10',
            isActive
              ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-100 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.35),0_0_18px_rgba(99,102,241,0.18)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.9)]" />
            )}
            <Icon
              className={cn(
                'w-[18px] h-[18px] shrink-0 transition-colors',
                isActive ? 'text-indigo-300' : 'text-slate-500 group-hover/nav:text-slate-300'
              )}
            />
            {!collapsed && (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className={cn('truncate', isActive && 'translate-x-0.5 transition-transform')}>
                  {item.label}
                </span>
                {badge && (
                  <span
                    title={badge.title}
                    className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none', badge.toneClass)}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
            )}
            {collapsed && badge && (
              <span
                title={badge.title}
                className={cn(
                  'absolute top-2 right-2 h-1.5 w-1.5 rounded-full',
                  badge.toneClass.includes('red')
                    ? 'bg-red-400'
                    : badge.toneClass.includes('amber')
                    ? 'bg-amber-400'
                    : badge.toneClass.includes('emerald')
                    ? 'bg-emerald-400'
                    : 'bg-indigo-400'
                )}
              />
            )}
          </>
        )}
      </NavLink>

      {showPin && !collapsed && onToggleFavorite && (
        <button
          type="button"
          title={isFavorite ? `Unpin ${item.label}` : `Pin ${item.label}`}
          aria-label={isFavorite ? `Unpin ${item.label}` : `Pin ${item.label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(item.to);
          }}
          className={cn(
            'absolute right-2 p-1 rounded-md transition-colors',
            isFavorite
              ? 'text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20'
              : 'text-slate-600 hover:text-slate-300 hover:bg-white/5 opacity-0 group-hover:opacity-100'
          )}
        >
          <Pin className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
        </button>
      )}
    </div>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [favoriteRoutes, setFavoriteRoutes] = useState<string[]>(() => readStoredRoutes(SIDEBAR_FAVORITES_KEY, DEFAULT_FAVORITES));
  const [recentRoutes, setRecentRoutes] = useState<string[]>(() => readStoredRoutes(SIDEBAR_RECENTS_KEY, []));
  const [sessionSnapshot, setSessionSnapshot] = useState(() => getForexSessionSnapshot());
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const { user, logout } = useAuthStore();
  const { settings, setTheme, hasGeminiKey } = useSettingsStore();
  const { forexPairs, isLoadingCrypto, isLoadingForex, error: marketError } = useMarketStore();
  const { watchlists } = useWatchlistStore();
  const { alerts } = useAlertStore();
  const { isOpen: chatOpen, isLoading: aiLoading, messages, openChat } = useChatStore();

  const navigate = useNavigate();
  const location = useLocation();

  const aiConnected = hasGeminiKey() || isBackendEnabled();
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false);

  const riskPosture = (() => {
    if (!settings.trading.enableRiskGuardrails) {
      return { label: 'Risk Off', tone: 'bg-red-500/15 text-red-300 border-red-500/25' };
    }

    const conservative =
      settings.trading.maxPositionSizePercent <= 15 &&
      settings.trading.maxDailyLossPercent <= 3 &&
      settings.trading.maxOpenPositions <= 5;

    const aggressive =
      settings.trading.maxPositionSizePercent >= 40 ||
      settings.trading.maxDailyLossPercent >= 10 ||
      settings.trading.maxOpenPositions >= 15;

    if (conservative) return { label: 'Risk Low', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    if (aggressive) return { label: 'Risk High', tone: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
    return { label: 'Risk Med', tone: 'bg-blue-500/15 text-blue-300 border-blue-500/25' };
  })();

  const pageMeta = useMemo(() => pageMetaForPath(location.pathname), [location.pathname]);

  const lastAssistantTimestamp = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') return messages[index].timestamp;
    }
    return null;
  }, [messages]);

  const aiMetaLabel = aiLoading
    ? 'Thinking...'
    : aiConnected
      ? formatRelativeTime(lastAssistantTimestamp)
      : 'AI not configured';

  const aiStatusLabel = aiLoading ? 'AI syncing' : aiConnected ? 'AI ready' : 'AI setup required';

  const aiStatusTone = aiLoading
    ? 'border-violet-400/35 bg-violet-500/12 text-violet-200'
    : aiConnected
      ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
      : 'border-amber-400/35 bg-amber-500/12 text-amber-200';

  const isHeaderBusy = aiLoading || isLoadingCrypto || isLoadingForex;

  const forexSession = forexPairs[0]?.sessionLabel ?? sessionSnapshot.label;
  const forexSessionState = forexPairs[0]?.marketStatus ?? sessionSnapshot.state;

  const forexSessionTone =
    forexSessionState === 'open'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : forexSessionState === 'thin_liquidity'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        : forexSessionState === 'rollover'
          ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
          : 'bg-slate-500/10 text-slate-300 border-slate-500/20';

  const secondaryLinks = useMemo<SecondaryLink[]>(() => {
    const params = new URLSearchParams(location.search);

    if (location.pathname.startsWith('/markets')) {
      const state = readMarketsUrlState(params);
      const mk = (next: Partial<typeof state>) => {
        const search = new URLSearchParams();
        const merged = { ...state, ...next };
        search.set('marketsView', merged.view);
        search.set('marketsAsset', merged.asset);
        search.set('marketsSort', merged.sort);
        search.set('marketsOrder', merged.order);
        if (merged.q.trim()) search.set('marketsQ', merged.q);
        return `/markets?${search.toString()}`;
      };

      return [
        {
          label: 'Overview',
          to: mk({ asset: 'all', sort: 'marketCap', order: 'desc', view: 'list', q: '' }),
          active: state.asset === 'all' && state.sort === 'marketCap',
        },
        {
          label: 'Crypto',
          to: mk({ asset: 'crypto', sort: 'marketCap', order: 'desc', view: state.view }),
          active: state.asset === 'crypto',
        },
        {
          label: 'Forex',
          to: mk({ asset: 'forex', sort: 'change', order: 'desc', view: state.view }),
          active: state.asset === 'forex',
        },
        {
          label: 'Top Movers',
          to: mk({ sort: 'change', order: 'desc' }),
          active: state.sort === 'change' && state.order === 'desc',
        },
      ];
    }

    if (location.pathname.startsWith('/portfolio')) {
      const tab = readPortfolioUrlState(params);
      return [
        { label: 'Positions', to: '/portfolio?portfolioTab=positions', active: tab === 'positions' },
        { label: 'Orders', to: '/portfolio?portfolioTab=orders', active: tab === 'orders' },
        { label: 'History', to: '/portfolio?portfolioTab=history', active: tab === 'history' },
      ];
    }

    if (location.pathname.startsWith('/settings')) {
      const tab = readSettingsUrlState(params);
      return [
        { label: 'API Keys', to: '/settings?settingsTab=apikeys', active: tab === 'apikeys' },
        { label: 'Profile', to: '/settings?settingsTab=profile', active: tab === 'profile' },
        { label: 'Theme', to: '/settings?settingsTab=preferences', active: tab === 'preferences' },
        { label: 'Alerts', to: '/settings?settingsTab=notifications', active: tab === 'notifications' },
        { label: 'Data', to: '/settings?settingsTab=data', active: tab === 'data' },
      ];
    }

    return [];
  }, [location.pathname, location.search]);

  const navItemsByPath = useMemo(() => new Map(navItems.map((item) => [item.to, item])), []);

  const favoriteItems = useMemo(
    () => favoriteRoutes.map((route) => navItemsByPath.get(route)).filter((item): item is NavItemDef => Boolean(item)),
    [favoriteRoutes, navItemsByPath]
  );

  const recentItems = useMemo(
    () =>
      recentRoutes
        .map((route) => navItemsByPath.get(route))
        .filter((item): item is NavItemDef => Boolean(item))
        .filter((item) => !favoriteRoutes.includes(item.to)),
    [favoriteRoutes, navItemsByPath, recentRoutes]
  );

  const groupedNav = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: navItems.filter(
            (item) =>
              item.group === group.id &&
              (sidebarCollapsed || !favoriteRoutes.includes(item.to))
          ),
        }))
        .filter((group) => group.items.length > 0),
    [favoriteRoutes, sidebarCollapsed]
  );

  const groupedNavMobile = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: navItems.filter((item) => item.group === group.id),
        }))
        .filter((group) => group.items.length > 0),
    []
  );

  const watchlistSymbolCount = useMemo(
    () => watchlists.reduce((sum, list) => sum + list.symbols.length, 0),
    [watchlists]
  );

  const triggeredAlertCount = useMemo(
    () => alerts.filter((alert) => alert.isTriggered).length,
    [alerts]
  );

  const activeAlertCount = useMemo(
    () => alerts.filter((alert) => alert.isActive && !alert.isTriggered).length,
    [alerts]
  );

  const navBadges = useMemo<Record<string, NavBadge | undefined>>(
    () => ({
      '/watchlist':
        watchlistSymbolCount > 0
          ? {
              text: String(watchlistSymbolCount),
              toneClass: 'border-indigo-400/35 bg-indigo-500/15 text-indigo-200',
              title: String(watchlistSymbolCount) + ' symbols in watchlists',
            }
          : undefined,
      '/alerts':
        triggeredAlertCount > 0
          ? {
              text: String(triggeredAlertCount),
              toneClass: 'border-red-400/40 bg-red-500/15 text-red-200',
              title: String(triggeredAlertCount) + ' triggered alerts',
            }
          : activeAlertCount > 0
          ? {
              text: String(activeAlertCount),
              toneClass: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
              title: String(activeAlertCount) + ' active alerts',
            }
          : undefined,
      '/settings': !aiConnected
        ? {
            text: 'Setup',
            toneClass: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
            title: 'Configure AI to unlock copilot features',
          }
        : undefined,
      '/markets': marketError
        ? {
            text: 'Cache',
            toneClass: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
            title: marketError,
          }
        : undefined,
    }),
    [activeAlertCount, aiConnected, marketError, triggeredAlertCount, watchlistSymbolCount]
  );

  const badgeForRoute = (route: string) => navBadges[route];

  const handleSidebarNavigationKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!event.target.matches('[data-sidebar-nav-link="true"]')) return;

    const links = Array.from(
      sidebarNavRef.current?.querySelectorAll<HTMLElement>('[data-sidebar-nav-link="true"]') ?? []
    );

    if (links.length === 0) return;
    const index = links.indexOf(event.target);
    if (index === -1) return;

    const focusAt = (nextIndex: number) => {
      links[nextIndex]?.focus();
    };

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt((index + 1) % links.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt((index - 1 + links.length) % links.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusAt(links.length - 1);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleFavorite = (route: string) => {
    setFavoriteRoutes((previous) => {
      const next = previous.includes(route)
        ? previous.filter((item) => item !== route)
        : [...previous, route];

      const order = new Map(navItems.map((item, index) => [item.to, index]));
      next.sort((left, right) => (order.get(left) ?? 999) - (order.get(right) ?? 999));
      saveStoredRoutes(SIDEBAR_FAVORITES_KEY, next);
      return next;
    });
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleResize = () => {
      if (window.innerWidth >= 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const route = location.pathname.startsWith('/asset/') ? '/markets' : location.pathname;
    if (!navItemsByPath.has(route)) return;

    setRecentRoutes((previous) => {
      const next = [route, ...previous.filter((item) => item !== route)].slice(0, 6);
      saveStoredRoutes(SIDEBAR_RECENTS_KEY, next);
      return next;
    });
  }, [location.pathname, navItemsByPath]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSessionSnapshot(getForexSessionSnapshot());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex h-screen overflow-hidden">
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-nexus-border bg-nexus-card/60 backdrop-blur-xl shrink-0 z-20 transition-[width] duration-300',
            sidebarCollapsed ? SIDEBAR_COLLAPSED_CLASS : SIDEBAR_EXPANDED_CLASS
          )}
        >
          <div className="flex items-center gap-2.5 px-4 h-16 border-b border-nexus-border">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  HamaFX
                </h1>
              </div>
            )}
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed((previous) => !previous)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="px-3 py-3 border-b border-nexus-border space-y-3">
              {favoriteItems.length > 0 && (
                <section>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1">Favorites</p>
                  <div className="space-y-0.5">
                    {favoriteItems.map((item) => (
                      <NavItem
                        key={`fav-${item.to}`}
                        item={item}
                        showPin
                        isFavorite
                        onToggleFavorite={toggleFavorite}
                      badge={badgeForRoute(item.to)}
                    />
                    ))}
                  </div>
                </section>
              )}

              {recentItems.length > 0 && (
                <section>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1">Recents</p>
                  <div className="space-y-0.5">
                    {recentItems.slice(0, 4).map((item) => (
                      <NavItem
                        key={`recent-${item.to}`}
                        item={item}
                        showPin
                        isFavorite={favoriteRoutes.includes(item.to)}
                        onToggleFavorite={toggleFavorite}
                      badge={badgeForRoute(item.to)}
                    />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <nav
            ref={sidebarNavRef}
            onKeyDown={handleSidebarNavigationKeyDown}
            className="flex-1 px-2 py-4 overflow-y-auto"
          >
            {groupedNav.map((group) => (
              <section key={group.id} className="mb-3">
                {!sidebarCollapsed && (
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-3 mb-1.5">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.to}
                      item={item}
                      collapsed={sidebarCollapsed}
                      showPin
                      isFavorite={favoriteRoutes.includes(item.to)}
                      onToggleFavorite={toggleFavorite}
                      badge={badgeForRoute(item.to)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <div className="px-3 py-3 border-t border-nexus-border">
            <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center')}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Log out"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Dismiss navigation overlay"
              className="absolute inset-0 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 bg-nexus-card flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-5 h-16 border-b border-nexus-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <TrendingUp className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className="font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">HamaFX</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-4 overflow-y-auto">
                {groupedNavMobile.map((group) => (
                  <section key={`mobile-${group.id}`} className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1.5">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <NavItem
                          key={`mobile-${item.to}`}
                          item={item}
                          onClick={() => setSidebarOpen(false)}
                          badge={badgeForRoute(item.to)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </nav>

              <div className="px-3 py-3 border-t border-nexus-border">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="border-b border-nexus-border bg-nexus-card/70 backdrop-blur-md shrink-0">
            <div className={cn(HEADER_HEIGHT_CLASS, 'px-3 sm:px-4 md:px-6')}>
              <div className="grid h-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(280px,1.4fr)_minmax(220px,1fr)] sm:gap-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 -ml-1 rounded-lg hover:bg-white/5"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="w-5 h-5 text-slate-400" />
                  </button>

                  <div className="flex min-w-0 items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                      <pageMeta.icon className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{pageMeta.title}</p>
                      <p className="hidden xl:block text-xs text-slate-500 truncate">{pageMeta.subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="hidden min-w-0 sm:flex sm:justify-center">
                  <div className="w-full max-w-xl">
                    <GlobalSearch
                      onAskAi={() => openChat()}
                      onCreateAlert={() => navigate('/alerts')}
                      onCreateOrder={() => navigate('/asset/bitcoin')}
                    />
                  </div>
                </div>

                <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
                  <div className="sm:hidden">
                    <GlobalSearch
                      onAskAi={() => openChat()}
                      onCreateAlert={() => navigate('/alerts')}
                      onCreateOrder={() => navigate('/asset/bitcoin')}
                      enableHotkeys={false}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle theme"
                  >
                    {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
                  </button>

                  <NotificationCenter />

                  {isHeaderBusy ? (
                    <div className="hidden lg:flex h-7 w-[108px] animate-pulse rounded-full border border-white/10 bg-white/5" />
                  ) : (
                    <div
                      title={aiMetaLabel}
                      className={cn(
                        'hidden lg:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                        aiStatusTone
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          aiLoading ? 'bg-violet-300 animate-pulse' : aiConnected ? 'bg-emerald-300' : 'bg-amber-300'
                        )}
                      />
                      <span>{aiStatusLabel}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => openChat()}
                    className={cn(
                      'flex shrink-0 items-center gap-2 whitespace-nowrap pl-2 pr-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                      chatOpen
                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                        : 'bg-white/5 text-slate-300 border-transparent hover:bg-white/10'
                    )}
                    aria-label="Ask AI Copilot"
                    title={aiMetaLabel}
                    data-testid="desktop-ai-chat-toggle"
                  >
                    <span className="hidden xl:inline">Ask AI</span>
                    <AiCompanion compact />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 md:px-6 pb-2">
              <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                {secondaryLinks.length > 0 && (
                  <nav className="flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1 min-w-0">
                    {secondaryLinks.map((link) => (
                      <Link
                        key={link.label}
                        to={link.to}
                        className={cn(
                          'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                          link.active
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            : 'bg-white/5 text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/10'
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                )}

                <div className={cn('flex items-center gap-2 ml-auto', secondaryLinks.length === 0 && 'w-full justify-end')}>
                  <div className={cn('hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', forexSessionTone)}>
                    <Clock3 className="w-3.5 h-3.5" />
                    <span>{forexSession}</span>
                  </div>
                  <div className={cn('hidden md:flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', riskPosture.tone)}>
                    {riskPosture.label}
                  </div>
                  <div className="hidden xl:block">
                    <MiniTicker />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>

          <div className="hidden md:block border-t border-nexus-border bg-nexus-card/70 backdrop-blur px-4 py-1.5">
            <p className="text-xs text-slate-600 text-center">
              ⚠️ Paper trading only. Not financial advice. AI signals are for educational purposes. Past performance ≠ future results.
            </p>
          </div>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-nexus-card border-t border-nexus-border flex items-center justify-around px-2 z-40">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const badge = badgeForRoute(item.to);
            return (
              <NavLink
                key={`mobile-nav-${item.to}`}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[60px]',
                    isActive ? 'text-indigo-400' : 'text-slate-500'
                  )
                }
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge && (
                    <span
                      className={cn(
                        'absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full',
                        badge.toneClass.includes('red')
                          ? 'bg-red-400'
                          : badge.toneClass.includes('amber')
                          ? 'bg-amber-400'
                          : badge.toneClass.includes('emerald')
                          ? 'bg-emerald-400'
                          : 'bg-indigo-400'
                      )}
                    />
                  )}
                </div>
                <span className="text-xs font-medium">{item.mobileLabel ?? item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <AIChatDrawer />

        {!chatOpen && (
          <button
            type="button"
            onClick={() => openChat()}
            className={cn(
              'md:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25 items-center justify-center hover:scale-105 active:scale-95 transition-transform bottom-[calc(5.75rem+env(safe-area-inset-bottom))]',
              sidebarOpen ? 'hidden' : 'flex'
            )}
            aria-label="Open AI Chat"
            data-testid="mobile-ai-chat-toggle"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
        )}
      </div>
    </>
  );
}
