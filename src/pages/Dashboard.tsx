import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Bot, ArrowRight, AlertTriangle,
  DollarSign, BarChart3, Zap, Globe, Wifi, WifiOff, RefreshCw, Bell,
  ArrowUpRight, ArrowDownRight, Eye, CheckCircle2, Circle, X
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMarketStore } from '@/stores/marketStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useAlertStore } from '@/stores/alertStore';
import { useAuthStore } from '@/stores/authStore';
import { isBackendEnabled } from '@/services/backend/config';
import { getDashboardInsights } from '@/services/gemini';
import { AnimatedPrice, AnimatedPercent } from '@/components/ui/AnimatedPrice';
import { StaggerContainer } from '@/components/ui/PageTransition';
import type { AiDashboardInsights, Asset, ForexPair } from '@/types';

function formatPrice(price: number, assetType: 'crypto' | 'forex') {
  if (assetType === 'forex') return price.toFixed(4);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function formatVolume(vol: number) {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}T`;
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  return `$${vol.toLocaleString()}`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg', className)} />;
}

function MiniSparkline({ data, positive }: { data?: number[]; positive: boolean }) {
  if (!data || data.length < 5) return null;
  const points = data.slice(-20);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 80;
  const height = 32;

  const pathData = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaData = pathData + ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`spark-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaData} fill={`url(#spark-${positive ? 'up' : 'down'})`} />
      <path
        d={pathData}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Dashboard() {
  const { hasGeminiKey } = useSettingsStore();
  const {
    cryptoAssets, forexPairs, isLoadingCrypto,
    wsConnected, lastCryptoUpdate, dataSource, error, fetchCrypto, fetchForex,
    startWebSocket, startForexPolling
  } = useMarketStore();
  const { virtualBalance, positions, tradeHistory, getTotalValue, getTotalPnL, getInvestedAmount } = usePortfolioStore();
  const { watchlists } = useWatchlistStore();
  const { alerts } = useAlertStore();
  const { user } = useAuthStore();
  const backendAiReady = isBackendEnabled();
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => localStorage.getItem('hamafx_onboarding_dismissed') === '1');
  const [aiInsights, setAiInsights] = useState<AiDashboardInsights | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const activeAlerts = alerts.filter(a => a.isActive && !a.isTriggered);
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const portfolioValue = getTotalValue();
  const totalPnL = getTotalPnL();
  const invested = getInvestedAmount();
  const pnlPercent = totalPnL.percent;
  const onboardingItems = useMemo(() => ([
    { label: 'Start demo', done: !!user, href: '/login' },
    { label: 'Place first trade', done: tradeHistory.length > 0, href: '/markets' },
    { label: 'Create first alert', done: alerts.length > 0, href: '/alerts' },
    { label: 'Configure AI key', done: hasGeminiKey() || backendAiReady, href: '/settings' },
  ]), [alerts.length, backendAiReady, hasGeminiKey, tradeHistory.length, user]);
  const onboardingComplete = onboardingItems.every((item) => item.done);

  useEffect(() => {
    document.title = 'Dashboard — HamaFX';
    fetchCrypto();
    fetchForex();
    const wsCleanup = startWebSocket();
    const fxCleanup = startForexPolling();
    return () => { wsCleanup(); fxCleanup(); };
  }, [fetchCrypto, fetchForex, startWebSocket, startForexPolling]);

  useEffect(() => {
    let active = true;
    if (cryptoAssets.length === 0 && forexPairs.length === 0) return;

    setAiInsightsLoading(true);
    void getDashboardInsights()
      .then((next) => {
        if (active) setAiInsights(next);
      })
      .catch((error) => {
        console.warn('[Dashboard] AI insights unavailable:', error);
      })
      .finally(() => {
        if (active) setAiInsightsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [alerts.length, cryptoAssets.length, forexPairs.length, positions.length, tradeHistory.length]);

  // Watchlist items
  const defaultWl = watchlists.length > 0 ? watchlists[0] : null;
  const watchlistSymbols = defaultWl?.symbols.map(s => s.symbol) || [];
  const watchlistItems: (Asset | ForexPair)[] = watchlistSymbols.length > 0
    ? [
        ...cryptoAssets.filter(a => watchlistSymbols.includes(a.symbol)),
        ...forexPairs.filter(p => watchlistSymbols.includes(p.symbol)),
      ]
    : [...cryptoAssets.slice(0, 5), ...forexPairs.slice(0, 3)];

  const isForexPair = (item: Asset | ForexPair): item is ForexPair => 'rate' in item;

  // Top movers
  const topGainers = [...cryptoAssets].sort((a, b) => b.changePercent24h - a.changePercent24h).slice(0, 3);
  const topLosers = [...cryptoAssets].sort((a, b) => a.changePercent24h - b.changePercent24h).slice(0, 3);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ═══════════ HERO: Portfolio Summary ═══════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-nexus-border bg-gradient-to-br from-indigo-600/10 via-nexus-card to-violet-600/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_60%)]" />
        <div className="relative p-5 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400 font-medium">Portfolio Value</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium',
                wsConnected ? 'bg-emerald-500/15 text-emerald-400 live-glow' : 'bg-slate-500/10 text-slate-500'
              )}>
                {wsConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                {wsConnected ? 'Live' : 'Polling'}
              </span>
              <span className="text-xs text-slate-600 font-mono px-2 py-0.5 rounded-full bg-slate-500/10">Paper Trading</span>
            </div>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <AnimatedPrice
              value={portfolioValue}
              prefix="$"
              formatter={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              className="text-3xl md:text-4xl font-bold tracking-tight"
              showBgFlash
            />
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium mb-1 px-2 py-0.5 rounded-md',
              totalPnL.amount >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}>
              {totalPnL.amount >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <AnimatedPrice
                value={Math.abs(totalPnL.amount)}
                prefix={totalPnL.amount >= 0 ? '+$' : '-$'}
                formatter={(n) => n.toFixed(2)}
                className="text-sm"
                showFlash={false}
              />
              <span className="text-xs opacity-75">(<AnimatedPercent value={pnlPercent} className="text-xs" />)</span>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              <span>Cash:</span>
              <AnimatedPrice value={virtualBalance} prefix="$" formatter={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2 })} className="text-sm text-slate-300" showFlash={false} />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Positions:</span>
              <span className="text-slate-300 font-medium">{positions.length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              <span>Invested:</span>
              <AnimatedPrice value={invested} prefix="$" formatter={(n) => n.toFixed(2)} className="text-sm text-slate-300" showFlash={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2 animate-scale-in">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-400">{error}</span>
          <button onClick={() => { fetchCrypto(); fetchForex(); }} className="ml-auto text-amber-400 hover:text-amber-300">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Setup Prompt */}
      {!hasGeminiKey() && !backendAiReady && (
        <Link
          to="/settings"
          className="w-full bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center gap-4 hover:bg-violet-500/15 transition-[background-color,transform] duration-200 hover:scale-[1.005] text-left group animate-scale-in"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/30 transition-colors">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-300">Unlock AI-Powered Analysis</p>
            <p className="text-xs text-slate-400 mt-0.5">Add your free Google Gemini API key for trading signals & sentiment</p>
          </div>
          <ArrowRight className="w-4 h-4 text-violet-400 shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {!onboardingDismissed && !onboardingComplete && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-4 animate-scale-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Quick Start Checklist</p>
              <p className="text-xs text-slate-500 mt-0.5">Complete these steps to unlock the full demo experience.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('hamafx_onboarding_dismissed', '1');
                setOnboardingDismissed(true);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              aria-label="Dismiss onboarding checklist"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onboardingItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors',
                  item.done
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                    : 'border-nexus-border bg-nexus-elevated text-slate-300 hover:bg-white/[0.03]'
                )}
              >
                <span className="text-sm">{item.label}</span>
                {item.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-slate-500" />}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ BENTO GRID ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── Market Overview / Watchlist (spans 8 cols) ── */}
        <div className="lg:col-span-8 bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-nexus-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              {watchlistSymbols.length > 0 ? <><Eye className="w-4 h-4 text-indigo-400" /> Your Watchlist</> : <><Globe className="w-4 h-4 text-indigo-400" /> Market Overview</>}
            </h2>
            <div className="flex items-center gap-3">
              {lastCryptoUpdate && (
                <span className="text-xs text-slate-600 font-mono">via {dataSource}</span>
              )}
              <Link to="/markets" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 group">
                View All <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {(isLoadingCrypto && cryptoAssets.length === 0) ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <StaggerContainer fast className="divide-y divide-nexus-border">
              {watchlistItems.map(item => {
                const isFx = isForexPair(item);
                const price = isFx ? item.rate : item.price;
                const change = item.changePercent24h;
                const symbol = item.symbol;
                const assetType: 'crypto' | 'forex' = isFx ? 'forex' : 'crypto';

                return (
                  <Link
                    key={item.id}
                    to={`/asset/${item.id}`}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {'image' in item && item.image ? (
                        <img src={item.image} alt={symbol} width={36} height={36} loading="lazy" className="w-9 h-9 rounded-full ring-1 ring-white/5" />
                      ) : (
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold',
                          assetType === 'crypto' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                        )}>
                          {symbol.substring(0, 2)}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-semibold group-hover:text-indigo-400 transition-colors">{symbol}</p>
                        <p className="text-xs text-slate-500">{item.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {'sparkline' in item && <MiniSparkline data={item.sparkline} positive={change >= 0} />}
                      <div className="text-right min-w-[100px]">
                        <AnimatedPrice
                          value={price}
                          formatter={(n) => formatPrice(n, assetType)}
                          prefix="$"
                          className="text-sm font-medium"
                          showBgFlash
                        />
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          {change >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                          <AnimatedPercent value={change} className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </StaggerContainer>
          )}
        </div>

        {/* ── Right Column (spans 4 cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Top Movers - Gainers */}
          <StaggerContainer className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
            <div className="px-4 py-3 border-b border-nexus-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Top Gainers
              </h3>
            </div>
            {topGainers.map(asset => (
              <Link
                key={asset.id}
                to={`/asset/${asset.id}`}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {asset.image ? (
                    <img src={asset.image} alt={asset.symbol} width={24} height={24} loading="lazy" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-bold">
                      {asset.symbol.substring(0, 2)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{asset.symbol}</span>
                </div>
                <AnimatedPercent value={asset.changePercent24h} className="text-sm font-semibold" />
              </Link>
            ))}
          </StaggerContainer>

          {/* Top Movers - Losers */}
          <StaggerContainer className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
            <div className="px-4 py-3 border-b border-nexus-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Top Losers
              </h3>
            </div>
            {topLosers.map(asset => (
              <Link
                key={asset.id}
                to={`/asset/${asset.id}`}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {asset.image ? (
                    <img src={asset.image} alt={asset.symbol} width={24} height={24} loading="lazy" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs font-bold">
                      {asset.symbol.substring(0, 2)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{asset.symbol}</span>
                </div>
                <AnimatedPercent value={asset.changePercent24h} className="text-sm font-semibold" />
              </Link>
            ))}
          </StaggerContainer>

          {/* AI Summary */}
          <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border">
              <h2 className="text-xs font-semibold flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-violet-400" /> AI Summary
              </h2>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                aiInsights?.source === 'gemini' || hasGeminiKey() || backendAiReady
                  ? 'bg-violet-500/15 text-violet-400'
                  : 'bg-slate-500/10 text-slate-500'
              )}>
                {aiInsights?.source === 'gemini' ? '🤖 AI' : aiInsights ? '🧠 Copilot' : '📊 Auto'}
              </span>
            </div>
            <div className="p-4">
              {aiInsightsLoading && (
                <Shimmer className="h-20 w-full" />
              )}
              {!aiInsightsLoading && aiInsights ? (
                <>
                  <p className="text-sm text-slate-300 leading-relaxed">{aiInsights.summary}</p>
                  {aiInsights.keyDrivers.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {aiInsights.keyDrivers.slice(0, 3).map((driver) => (
                        <li key={driver} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{driver}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      aiInsights.marketMood === 'risk-on'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : aiInsights.marketMood === 'risk-off'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400'
                    )}>
                      Mood: {aiInsights.marketMood === 'risk-on' ? 'Risk-On 🟢' : aiInsights.marketMood === 'risk-off' ? 'Risk-Off 🔴' : 'Mixed 🟡'}
                    </span>
                  </div>
                  {aiInsights.riskFlags.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {aiInsights.riskFlags.slice(0, 2).map((flag) => (
                        <p key={flag} className="text-xs text-amber-300/90 flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{flag}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Shimmer className="h-20 w-full" />
              )}
              <p className="text-xs text-slate-600 mt-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Not financial advice.
              </p>
            </div>
          </div>
        </div>

        {/* ── Trading Signals (full width row) ── */}
        <div className="lg:col-span-8 bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-nexus-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Trading Signals
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {hasGeminiKey() || backendAiReady ? (
                <><Bot className="w-3 h-3 text-violet-400" /> AI-Powered</>
              ) : (
                <><BarChart3 className="w-3 h-3" /> Algorithm</>
              )}
            </div>
          </div>
          {cryptoAssets.length > 0 ? (
            <StaggerContainer fast className="divide-y divide-nexus-border">
              {cryptoAssets.slice(0, 4).map(asset => {
                const signal = asset.changePercent24h > 3 ? 'BUY' : asset.changePercent24h < -3 ? 'SELL' : 'HOLD';
                const confidence = Math.min(95, Math.max(30, 50 + Math.abs(asset.changePercent24h) * 5));

                return (
                  <Link
                    key={asset.id}
                    to={`/asset/${asset.id}`}
                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-bold tracking-wide',
                        signal === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' :
                        signal === 'SELL' ? 'bg-red-500/15 text-red-400' :
                        'bg-amber-500/15 text-amber-400'
                      )}>
                        {signal}
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.image && <img src={asset.image} alt={asset.symbol} width={24} height={24} loading="lazy" className="w-6 h-6 rounded-full" />}
                        <div className="text-left">
                          <p className="text-sm font-medium group-hover:text-indigo-400 transition-colors">{asset.symbol}</p>
                          <p className="text-xs text-slate-500">
                            <AnimatedPercent value={asset.changePercent24h} className="text-xs" /> today
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <AnimatedPrice
                          value={asset.price}
                          prefix="$"
                          formatter={(n) => formatPrice(n, 'crypto')}
                          className="text-sm font-medium"
                        />
                      </div>
                      {/* Confidence bar */}
                      <div className="w-16">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-500">{confidence.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-nexus-border rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width,background-color] duration-500',
                              confidence >= 70 ? 'bg-emerald-500' : confidence >= 50 ? 'bg-amber-500' : 'bg-slate-500'
                            )}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </StaggerContainer>
          ) : (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-12 w-full" />)}
            </div>
          )}
        </div>

        {/* ── Right side: Alerts + Forex + Stats ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Alerts Widget */}
          {(activeAlerts.length > 0 || triggeredAlerts.length > 0) && (
            <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden animate-scale-in">
              <div className="px-4 py-3 border-b border-nexus-border">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" /> Alerts
                </h3>
              </div>
              <div className="p-3 space-y-2">
                {triggeredAlerts.length > 0 && (
                  <Link
                    to="/alerts"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                      {triggeredAlerts.length}
                    </span>
                    alert{triggeredAlerts.length !== 1 ? 's' : ''} triggered
                    <ArrowRight className="w-3 h-3 ml-auto" />
                  </Link>
                )}
                {activeAlerts.length > 0 && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 px-1">
                    <Zap className="w-3 h-3" /> {activeAlerts.length} active
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Forex Rates */}
          {forexPairs.length > 0 && (
            <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
              <div className="px-4 py-3 border-b border-nexus-border">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" /> Forex Rates
                </h3>
              </div>
              <StaggerContainer fast className="divide-y divide-nexus-border">
                {forexPairs.slice(0, 4).map(pair => (
                  <Link
                    key={pair.id}
                    to={`/asset/${pair.id}`}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm font-medium">{pair.symbol}</span>
                    <div className="flex items-center gap-2">
                      <AnimatedPrice
                        value={pair.rate}
                        formatter={(n) => n.toFixed(4)}
                        className="text-sm"
                        showBgFlash
                      />
                      <AnimatedPercent value={pair.changePercent24h} className="text-xs" />
                    </div>
                  </Link>
                ))}
              </StaggerContainer>
            </div>
          )}

          {/* Market Stats */}
          {cryptoAssets.length > 0 && (
            <div className="bg-nexus-card rounded-xl border border-nexus-border p-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Market Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Total Volume (24h)</span>
                  <span className="text-sm font-mono font-medium">
                    {formatVolume(cryptoAssets.reduce((s, a) => s + a.volume24h, 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Assets Tracked</span>
                  <span className="text-sm font-mono font-medium">{cryptoAssets.length + forexPairs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">BTC Dominance</span>
                  <span className="text-sm font-mono font-medium">
                    {(() => {
                      const totalMcap = cryptoAssets.reduce((s, a) => s + (a.marketCap || 0), 0);
                      const btcMcap = cryptoAssets.find(a => a.symbol === 'BTC')?.marketCap || 0;
                      return totalMcap > 0 ? `${((btcMcap / totalMcap) * 100).toFixed(1)}%` : '—';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Risk Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-400/80 font-medium">Risk Disclaimer</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Paper trading only. AI signals are educational — not financial advice. Past performance ≠ future results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
