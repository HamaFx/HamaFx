import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Briefcase, TrendingUp, TrendingDown, BarChart3,
  Clock, X, RefreshCw, PieChart, ArrowUpRight, Shield, DollarSign, Activity,
  ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { readPortfolioUrlState, writePortfolioUrlState } from '@/utils/urlState';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, ComposedChart
} from 'recharts';

function formatPrice(price: number) {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];
const INITIAL_BALANCE = 100000;

// Custom Tooltip for charts - avoids Recharts type issues
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#1a1d2e] border border-[#2d3148] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-mono" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? (p.name === 'Drawdown' ? `${p.value.toFixed(2)}%` : `$${p.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function Portfolio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    virtualBalance, positions, tradeHistory, balanceHistory,
    loadPortfolio, closePosition, getTotalValue, getTotalPnL,
    getInvestedAmount, resetPortfolio, snapshotBalance,
    orders, cancelOrder,
  } = usePortfolioStore();
  const { cryptoAssets } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>(() => readPortfolioUrlState(searchParams));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [chartView, setChartView] = useState<'equity' | 'drawdown' | 'pnl'>('equity');
  const [sortBy, setSortBy] = useState<'pnl' | 'value' | 'name'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    document.title = 'Portfolio — HamaFX';
    loadPortfolio();
    snapshotBalance();
  }, [loadPortfolio, snapshotBalance]);

  useEffect(() => {
    const urlTab = readPortfolioUrlState(searchParams);
    setActiveTab((prev) => (prev === urlTab ? prev : urlTab));
  }, [searchParams]);

  useEffect(() => {
    const next = writePortfolioUrlState(searchParams, activeTab);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (cryptoAssets.length > 0 && positions.length > 0) {
      const priceMap: Record<string, number> = {};
      cryptoAssets.forEach(a => { priceMap[a.symbol] = a.price; });
      usePortfolioStore.getState().updatePositionPrices(priceMap);
    }
  }, [cryptoAssets, positions.length]);

  const totalValue = getTotalValue();
  const totalPnL = getTotalPnL();
  const invested = getInvestedAmount();
  const cashPercent = totalValue > 0 ? (virtualBalance / totalValue) * 100 : 100;
  const isProfit = totalPnL.amount >= 0;
  const totalReturn = ((totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

  // Sorted positions
  const sortedPositions = [...positions].sort((a, b) => {
    if (sortBy === 'pnl') return sortDir === 'desc' ? b.unrealizedPnL - a.unrealizedPnL : a.unrealizedPnL - b.unrealizedPnL;
    if (sortBy === 'value') return sortDir === 'desc' ? (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity) : (a.currentPrice * a.quantity) - (b.currentPrice * b.quantity);
    return sortDir === 'desc' ? b.symbol.localeCompare(a.symbol) : a.symbol.localeCompare(b.symbol);
  });

  // Allocation data
  const allocationData = [
    ...positions.map((pos, i) => ({
      name: pos.symbol, value: pos.currentPrice * pos.quantity, color: COLORS[i % COLORS.length],
    })),
    { name: 'Cash', value: virtualBalance, color: '#475569' },
  ].filter(d => d.value > 0);

  // Equity curve data
  const equityData = balanceHistory.slice(-60).map(snap => ({
    time: new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: snap.totalValue,
    benchmark: INITIAL_BALANCE,
  }));

  // Drawdown data
  const drawdownData = (() => {
    const history = balanceHistory.slice(-60);
    let peak = INITIAL_BALANCE;
    return history.map(snap => {
      if (snap.totalValue > peak) peak = snap.totalValue;
      const dd = ((snap.totalValue - peak) / peak) * 100;
      return {
        time: new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Drawdown: dd,
      };
    });
  })();

  // Daily P&L data
  const dailyPnL = (() => {
    const history = balanceHistory.slice(-30);
    const result: Array<{ time: string; pnl: number }> = [];
    for (let i = 1; i < history.length; i++) {
      const change = history[i].totalValue - history[i - 1].totalValue;
      result.push({
        time: new Date(history[i].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl: change,
      });
    }
    return result;
  })();

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const recentTrades = tradeHistory.slice(0, 30);
  const winRate = (() => {
    const closing = tradeHistory.filter(t => t.pnl !== undefined);
    if (closing.length === 0) return 0;
    return (closing.filter(t => (t.pnl ?? 0) > 0).length / closing.length) * 100;
  })();
  const totalRealizedPnL = tradeHistory.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalFees = tradeHistory.reduce((sum, t) => sum + t.fee, 0);
  const avgWin = (() => {
    const wins = tradeHistory.filter(t => (t.pnl ?? 0) > 0);
    return wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  })();
  const avgLoss = (() => {
    const losses = tradeHistory.filter(t => (t.pnl ?? 0) < 0);
    return losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;
  })();
  const maxDrawdown = drawdownData.length > 0 ? Math.min(...drawdownData.map(d => d.Drawdown)) : 0;

  const toggleSort = (col: 'pnl' | 'value' | 'name') => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-xs text-slate-500">Paper Trading Account</p>
          </div>
        </div>
        <button onClick={() => setShowResetConfirm(!showResetConfirm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Reset Confirm */}
      {showResetConfirm && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between animate-scale-in">
          <div>
            <p className="text-sm text-red-300 font-medium">Reset portfolio to $100,000?</p>
            <p className="text-xs text-slate-400 mt-0.5">This will close all positions and clear trade history.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { resetPortfolio(); setShowResetConfirm(false); }}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors">Reset</button>
            <button onClick={() => setShowResetConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 text-xs hover:bg-white/10 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* ════════ Hero Card ════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-nexus-border bg-nexus-card">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-emerald-600/5" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative p-5 md:p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-400">Total Portfolio Value</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium">Paper Trading</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4 mb-5">
            <AnimatedPrice
              value={totalValue}
              prefix="$"
              formatter={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              className="text-4xl md:text-5xl font-bold font-mono tracking-tighter"
              showBgFlash
            />
            <div className={cn(
              'flex items-center gap-1.5 text-sm font-semibold mb-1 px-2.5 py-1 rounded-lg w-fit',
              isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <AnimatedPrice value={Math.abs(totalPnL.amount)} prefix={totalPnL.amount >= 0 ? '+$' : '-$'} formatter={(n) => n.toFixed(2)} className="text-sm" showFlash={false} />
              <span className="text-xs opacity-75">({totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-nexus-border to-transparent mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { label: 'Cash', value: `$${virtualBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-slate-400' },
              { label: 'Invested', value: `$${invested.toFixed(0)}`, icon: <Activity className="w-3.5 h-3.5" />, color: 'text-blue-400' },
              { label: 'Positions', value: positions.length.toString(), icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
              { label: 'Win Rate', value: winRate > 0 ? `${winRate.toFixed(0)}%` : '—', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
              { label: 'Max Drawdown', value: `${maxDrawdown.toFixed(1)}%`, icon: <TrendingDown className="w-3.5 h-3.5" />, color: 'text-red-400' },
              { label: 'Total Trades', value: tradeHistory.length.toString(), icon: <Clock className="w-3.5 h-3.5" />, color: 'text-amber-400' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg bg-white/5', stat.color)}>{stat.icon}</div>
                <div>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-sm font-mono font-semibold">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ Charts Section ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-nexus-card rounded-2xl border border-nexus-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-nexus-border">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold">Performance</span>
            </div>
            <div className="flex bg-nexus-elevated rounded-lg p-0.5">
              {[
                { id: 'equity' as const, label: 'Equity' },
                { id: 'drawdown' as const, label: 'Drawdown' },
                { id: 'pnl' as const, label: 'Daily P&L' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setChartView(tab.id)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    chartView === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {equityData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                {chartView === 'equity' ? (
                  <ComposedChart data={equityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,49,72,0.3)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['dataMin - 500', 'dataMax + 500']} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={INITIAL_BALANCE} stroke="#475569" strokeDasharray="5 5" label={{ value: '$100K', fill: '#64748b', fontSize: 10, position: 'right' }} />
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" name="Portfolio" stroke="#6366f1" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                ) : chartView === 'drawdown' ? (
                  <AreaChart data={drawdownData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,49,72,0.3)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <defs>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="Drawdown" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                ) : (
                  <BarChart data={dailyPnL}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,49,72,0.3)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>
                      {dailyPnL.map((entry, index) => (
                        <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Not enough data yet</p>
                <p className="text-xs text-slate-600 mt-1">Performance charts appear after trading activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Allocation */}
        <div className="bg-nexus-card rounded-2xl border border-nexus-border overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-nexus-border">
            <PieChart className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">Allocation</span>
          </div>
          <div className="p-4">
            {positions.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {allocationData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {allocationData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 px-1 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-slate-400">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-300">${item.value.toFixed(0)}</span>
                        <span className="text-slate-500 w-12 text-right font-mono">{((item.value / totalValue) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium">100% Cash</p>
                <p className="text-xs text-slate-500 mt-1">Open positions to see allocation</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════ Advanced Stats ════════ */}
      {tradeHistory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Realized P&L', value: `${totalRealizedPnL >= 0 ? '+' : ''}$${totalRealizedPnL.toFixed(0)}`, positive: totalRealizedPnL >= 0, icon: <TrendingUp className="w-3 h-3" /> },
            { label: 'Avg Win', value: `+$${avgWin.toFixed(0)}`, positive: true, icon: <ChevronUp className="w-3 h-3" /> },
            { label: 'Avg Loss', value: `-$${Math.abs(avgLoss).toFixed(0)}`, positive: false, icon: <ChevronDown className="w-3 h-3" /> },
            { label: 'Total Fees', value: `$${totalFees.toFixed(2)}`, positive: null, icon: <DollarSign className="w-3 h-3" /> },
            { label: 'Cash %', value: `${cashPercent.toFixed(0)}%`, positive: null, icon: <PieChart className="w-3 h-3" /> },
            { label: 'Win/Loss', value: `${tradeHistory.filter(t => (t.pnl ?? 0) > 0).length}/${tradeHistory.filter(t => (t.pnl ?? 0) < 0).length}`, positive: null, icon: <Activity className="w-3 h-3" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-nexus-card rounded-xl border border-nexus-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('opacity-60', stat.positive === true ? 'text-emerald-400' : stat.positive === false ? 'text-red-400' : 'text-slate-400')}>{stat.icon}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className={cn(
                'text-lg font-mono font-bold',
                stat.positive === true ? 'text-emerald-400' : stat.positive === false ? 'text-red-400' : 'text-slate-200'
              )}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ════════ Positions / Orders / History ════════ */}
      <div className="bg-nexus-card rounded-2xl border border-nexus-border overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-3 border-b border-nexus-border">
          {[
            { id: 'positions' as const, label: 'Positions', count: positions.length },
            { id: 'orders' as const, label: 'Orders', count: pendingOrders.length },
            { id: 'history' as const, label: 'History', count: recentTrades.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 min-h-11 rounded-xl text-sm font-medium transition-colors flex items-center gap-2',
                activeTab === tab.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              )}>
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-medium',
                  activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-500'
                )}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Briefcase className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No open positions</p>
              <p className="text-xs text-slate-500 mt-1">Start trading to build your portfolio</p>
              <Link to="/markets"
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> Explore Markets
              </Link>
            </div>
          ) : (
            <>
              {/* Sort controls */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-nexus-border/50">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Sort:</span>
                {(['value', 'pnl', 'name'] as const).map(col => (
                  <button key={col} onClick={() => toggleSort(col)}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-md font-medium transition-colors',
                      sortBy === col ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                    )}>
                    {col === 'value' ? 'Value' : col === 'pnl' ? 'P&L' : 'Name'}
                    {sortBy === col && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                  </button>
                ))}
                {positions.length > 1 && (
                  <button onClick={() => positions.forEach(pos => closePosition(pos.id, pos.currentPrice))}
                    className="ml-auto text-xs text-red-400/70 hover:text-red-400 transition-colors">
                    Close All
                  </button>
                )}
              </div>
              <div className="divide-y divide-nexus-border/30">
                {sortedPositions.map(pos => {
                  const value = pos.currentPrice * pos.quantity;
                  const pnlColor = pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <div key={pos.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.015] transition-colors group">
                      <Link to={`/asset/${pos.symbol.toLowerCase()}`} className="flex items-center gap-3 text-left min-w-0">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                          pos.side === 'long'
                            ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400'
                            : 'bg-gradient-to-br from-red-500/20 to-red-500/5 text-red-400'
                        )}>
                          {pos.side === 'long' ? '↑' : '↓'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold group-hover:text-indigo-400 transition-colors">{pos.symbol}</p>
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded font-medium uppercase',
                              pos.side === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            )}>{pos.side}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono">{pos.quantity.toFixed(4)} @ ${formatPrice(pos.entryPrice)}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                        {/* Current price */}
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-slate-500">Current</p>
                          <AnimatedPrice value={pos.currentPrice} prefix="$" formatter={(n) => formatPrice(n)} className="text-xs font-mono" showBgFlash />
                        </div>
                        {/* Value & P&L */}
                        <div className="text-right">
                          <p className="text-sm font-mono font-semibold">${value.toFixed(2)}</p>
                          <p className={cn('text-xs font-mono font-medium', pnlColor)}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                            <span className="text-xs opacity-70 ml-1">({pos.unrealizedPnLPercent.toFixed(1)}%)</span>
                          </p>
                        </div>
                        <button onClick={() => closePosition(pos.id, pos.currentPrice)}
                          className="px-3 py-2 min-h-11 md:min-h-0 md:px-2.5 md:py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-[color,background-color,opacity] duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* Pending Orders */}
        {activeTab === 'orders' && (
          pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Clock className="w-8 h-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">No pending orders</p>
            </div>
          ) : (
            <div className="divide-y divide-nexus-border/30">
              {pendingOrders.map(order => (
                <div key={order.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded font-bold uppercase',
                      order.side === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    )}>{order.side}</span>
                    <div>
                      <p className="text-sm font-semibold">{order.symbol}</p>
                      <p className="text-xs text-slate-500 font-mono">{order.type} @ ${order.price?.toFixed(2)} • Qty: {order.quantity.toFixed(4)}</p>
                    </div>
                  </div>
                  <button onClick={() => cancelOrder(order.id)} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Trade History */}
        {activeTab === 'history' && (
          recentTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="w-8 h-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">No trades yet</p>
              <p className="text-xs text-slate-500 mt-1">Start trading to see your history</p>
            </div>
          ) : (
            <div className="divide-y divide-nexus-border/30">
              {recentTrades.map(trade => (
                <div key={trade.id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded font-bold uppercase',
                      trade.side === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    )}>{trade.side}</span>
                    <div>
                      <p className="text-sm font-medium">{trade.symbol}</p>
                      <p className="text-xs text-slate-500 font-mono">{trade.quantity.toFixed(4)} @ ${formatPrice(trade.price)} • ${trade.total.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.pnl !== undefined && (
                      <p className={cn('text-sm font-mono font-medium', trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {new Date(trade.executedAt).toLocaleDateString()} {new Date(trade.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/markets"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-[box-shadow,transform] duration-200 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Trade Now
        </Link>
        <Link to="/risk"
          className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2">
          <Shield className="w-4 h-4" /> Risk Analysis
        </Link>
        <Link to="/backtest"
          className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2">
          <Activity className="w-4 h-4" /> Backtest
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Paper trading only — no real money is at risk. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
