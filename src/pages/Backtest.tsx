import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, Play, RotateCcw, AlertTriangle,
  TrendingUp, TrendingDown, BarChart3, DollarSign, Target, Clock
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { fetchOHLCVData } from '@/stores/marketStore';
import { calculateRSI, calculateMACD, calculateSMA, calculateEMA } from '@/services/indicators';
import type { OHLCV } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Strategy = 'sma_cross' | 'rsi_oversold' | 'macd_cross' | 'ema_trend';

interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  equityCurve: { date: string; value: number }[];
  trades: { date: string; type: 'buy' | 'sell'; price: number; pnl?: number }[];
}

function runBacktest(data: OHLCV[], strategy: Strategy, initialCapital: number): BacktestResult {
  const closes = data.map(d => d.close);
  const trades: BacktestResult['trades'] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  let capital = initialCapital;
  let position = 0;
  let entryPrice = 0;
  let maxEquity = initialCapital;
  let maxDrawdown = 0;
  const pnls: number[] = [];

  // Generate signals based on strategy
  const signals: ('buy' | 'sell' | 'hold')[] = new Array(closes.length).fill('hold');

  if (strategy === 'sma_cross') {
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, Math.min(50, closes.length));
    for (let i = 1; i < closes.length; i++) {
      if (sma20[i] !== null && sma50[i] !== null && sma20[i - 1] !== null && sma50[i - 1] !== null) {
        if (sma20[i]! > sma50[i]! && sma20[i - 1]! <= sma50[i - 1]!) signals[i] = 'buy';
        if (sma20[i]! < sma50[i]! && sma20[i - 1]! >= sma50[i - 1]!) signals[i] = 'sell';
      }
    }
  } else if (strategy === 'rsi_oversold') {
    const rsi = calculateRSI(closes, 14);
    for (let i = 1; i < closes.length; i++) {
      if (rsi.values[i] !== null && rsi.values[i - 1] !== null) {
        if (rsi.values[i]! < 30 && rsi.values[i - 1]! >= 30) signals[i] = 'buy';
        if (rsi.values[i]! > 70 && rsi.values[i - 1]! <= 70) signals[i] = 'sell';
      }
    }
  } else if (strategy === 'macd_cross') {
    const macd = calculateMACD(closes);
    for (let i = 1; i < closes.length; i++) {
      if (macd.histogram[i] !== null && macd.histogram[i - 1] !== null) {
        if (macd.histogram[i]! > 0 && macd.histogram[i - 1]! <= 0) signals[i] = 'buy';
        if (macd.histogram[i]! < 0 && macd.histogram[i - 1]! >= 0) signals[i] = 'sell';
      }
    }
  } else if (strategy === 'ema_trend') {
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    for (let i = 1; i < closes.length; i++) {
      if (ema12[i] !== null && ema26[i] !== null && ema12[i - 1] !== null && ema26[i - 1] !== null) {
        if (ema12[i]! > ema26[i]! && ema12[i - 1]! <= ema26[i - 1]!) signals[i] = 'buy';
        if (ema12[i]! < ema26[i]! && ema12[i - 1]! >= ema26[i - 1]!) signals[i] = 'sell';
      }
    }
  }

  // Execute trades
  for (let i = 0; i < data.length; i++) {
    const dateStr = new Date(data[i].time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (signals[i] === 'buy' && position === 0) {
      position = capital / closes[i];
      entryPrice = closes[i];
      capital = 0;
      trades.push({ date: dateStr, type: 'buy', price: closes[i] });
    } else if (signals[i] === 'sell' && position > 0) {
      const saleValue = position * closes[i];
      const pnl = saleValue - (position * entryPrice);
      pnls.push(pnl);
      capital = saleValue;
      position = 0;
      trades.push({ date: dateStr, type: 'sell', price: closes[i], pnl });
    }

    const currentEquity = capital + position * closes[i];
    maxEquity = Math.max(maxEquity, currentEquity);
    const drawdown = ((maxEquity - currentEquity) / maxEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    // Record equity at each point (sample every few candles)
    if (i % Math.max(1, Math.floor(data.length / 50)) === 0 || i === data.length - 1) {
      equityCurve.push({ date: dateStr, value: Math.round(currentEquity * 100) / 100 });
    }
  }

  // Close any open position at end
  if (position > 0) {
    const finalValue = position * closes[closes.length - 1];
    const pnl = finalValue - (position * entryPrice);
    pnls.push(pnl);
    capital = finalValue;
    position = 0;
  }

  const finalValue = capital;
  const winningPnls = pnls.filter(p => p > 0);
  const losingPnls = pnls.filter(p => p < 0);
  const avgWin = winningPnls.length > 0 ? winningPnls.reduce((a, b) => a + b, 0) / winningPnls.length : 0;
  const avgLoss = losingPnls.length > 0 ? Math.abs(losingPnls.reduce((a, b) => a + b, 0) / losingPnls.length) : 0;
  const totalGains = winningPnls.reduce((a, b) => a + b, 0);
  const totalLosses = Math.abs(losingPnls.reduce((a, b) => a + b, 0));

  // Simple sharpe ratio approximation
  const returns = pnls.map(p => p / initialCapital);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 1;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    totalTrades: trades.filter(t => t.type === 'buy').length,
    winningTrades: winningPnls.length,
    losingTrades: losingPnls.length,
    winRate: pnls.length > 0 ? (winningPnls.length / pnls.length) * 100 : 0,
    totalReturn: Math.round((finalValue - initialCapital) * 100) / 100,
    totalReturnPercent: Math.round(((finalValue - initialCapital) / initialCapital) * 10000) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: totalLosses > 0 ? Math.round((totalGains / totalLosses) * 100) / 100 : totalGains > 0 ? Infinity : 0,
    equityCurve,
    trades,
  };
}

const STRATEGIES: { id: Strategy; name: string; desc: string }[] = [
  { id: 'sma_cross', name: 'SMA Crossover', desc: 'Buy when SMA20 crosses above SMA50, sell when it crosses below' },
  { id: 'rsi_oversold', name: 'RSI Oversold/Overbought', desc: 'Buy when RSI drops below 30, sell when it rises above 70' },
  { id: 'macd_cross', name: 'MACD Crossover', desc: 'Buy on bullish MACD histogram cross, sell on bearish cross' },
  { id: 'ema_trend', name: 'EMA Trend', desc: 'Buy when EMA12 crosses above EMA26, sell when it crosses below' },
];

export default function BacktestPage() {
  const [asset, setAsset] = useState('bitcoin');
  const [strategy, setStrategy] = useState<Strategy>('sma_cross');
  const [period, setPeriod] = useState(90);
  const [initialCapital] = useState(10000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => { document.title = 'Backtesting — HamaFX'; }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const data = await fetchOHLCVData(asset, 'crypto', period);
      if (data.length < 30) {
        setRunning(false);
        return;
      }
      // Small delay for UX
      await new Promise(r => setTimeout(r, 300));
      const res = runBacktest(data, strategy, initialCapital);
      setResult(res);
    } catch (err) {
      console.error('[Backtest] Failed:', err);
    }
    setRunning(false);
  }, [asset, strategy, period, initialCapital]);

  const selectedStrategy = STRATEGIES.find(s => s.id === strategy)!;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="w-5 h-5 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold">Backtesting</h1>
          <p className="text-xs text-slate-500">Test strategies against historical market data</p>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-nexus-card rounded-xl border border-nexus-border p-5 space-y-4">
        <h2 className="text-sm font-semibold">Strategy Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Asset */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Asset</label>
            <select
              value={asset}
              onChange={e => setAsset(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <option value="bitcoin">Bitcoin (BTC)</option>
              <option value="ethereum">Ethereum (ETH)</option>
              <option value="solana">Solana (SOL)</option>
              <option value="cardano">Cardano (ADA)</option>
              <option value="dogecoin">Dogecoin (DOGE)</option>
              <option value="polkadot">Polkadot (DOT)</option>
              <option value="ripple">XRP</option>
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Period</label>
            <select
              value={period}
              onChange={e => setPeriod(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>1 Year</option>
            </select>
          </div>

          {/* Capital */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Initial Capital</label>
            <div className="px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono text-slate-300">
              $10,000
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Strategy</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STRATEGIES.map(s => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  strategy === s.id
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-nexus-elevated border-nexus-border text-slate-400 hover:text-slate-200'
                )}
              >
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-[10px] mt-0.5 opacity-70">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <div className="flex gap-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {running ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running...</>
            ) : (
              <><Play className="w-4 h-4" /> Run Backtest</>
            )}
          </button>
          {result && (
            <button
              onClick={() => setResult(null)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-slate-400 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Return',
                value: `${result.totalReturn >= 0 ? '+' : ''}$${result.totalReturn.toFixed(2)}`,
                sub: `${result.totalReturnPercent >= 0 ? '+' : ''}${result.totalReturnPercent}%`,
                icon: DollarSign,
                color: result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
              {
                label: 'Win Rate',
                value: `${result.winRate.toFixed(0)}%`,
                sub: `${result.winningTrades}W / ${result.losingTrades}L`,
                icon: Target,
                color: result.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
              },
              {
                label: 'Max Drawdown',
                value: `-${result.maxDrawdown}%`,
                sub: 'peak to trough',
                icon: TrendingDown,
                color: result.maxDrawdown > 20 ? 'text-red-400' : 'text-amber-400',
              },
              {
                label: 'Profit Factor',
                value: result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2),
                sub: `Sharpe: ${result.sharpeRatio}`,
                icon: BarChart3,
                color: result.profitFactor > 1.5 ? 'text-emerald-400' : 'text-amber-400',
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-nexus-card rounded-xl border border-nexus-border p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={cn('w-4 h-4', color)} />
                  <span className="text-[10px] text-slate-500 uppercase">{label}</span>
                </div>
                <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="bg-nexus-card rounded-xl border border-nexus-border p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" /> Detailed Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Trades', value: result.totalTrades.toString() },
                { label: 'Avg Win', value: `+$${result.avgWin.toFixed(2)}` },
                { label: 'Avg Loss', value: `-$${result.avgLoss.toFixed(2)}` },
                { label: 'Strategy', value: selectedStrategy.name },
                { label: 'Period', value: `${period} days` },
                { label: 'Initial Capital', value: `$${initialCapital.toLocaleString()}` },
                { label: 'Final Value', value: `$${(initialCapital + result.totalReturn).toLocaleString()}` },
                { label: 'Sharpe Ratio', value: result.sharpeRatio.toFixed(2) },
              ].map(stat => (
                <div key={stat.label} className="bg-nexus-elevated rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">{stat.label}</p>
                  <p className="text-sm font-mono font-medium mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Equity Curve */}
          {result.equityCurve.length > 2 && (
            <div className="bg-nexus-card rounded-xl border border-nexus-border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Equity Curve
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={result.equityCurve}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['dataMin - 500', 'dataMax + 500']} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Equity']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="url(#equityGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trade Log */}
          {result.trades.length > 0 && (
            <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-nexus-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" /> Trade Log ({result.trades.length} trades)
                </h3>
              </div>
              <div className="divide-y divide-nexus-border max-h-64 overflow-y-auto">
                {result.trades.map((trade, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-bold',
                        trade.type === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      )}>
                        {trade.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{trade.date}</span>
                      <span className="text-xs font-mono">${trade.price.toFixed(2)}</span>
                    </div>
                    {trade.pnl !== undefined && (
                      <span className={cn(
                        'text-xs font-mono font-medium',
                        trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risk Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Backtesting uses historical data and does not account for slippage, fees, or market impact. Past performance does not guarantee future results. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
