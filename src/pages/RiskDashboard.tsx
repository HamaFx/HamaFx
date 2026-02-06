import { useState, useMemo } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import {
  calculateVaR,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  runMonteCarloSimulation,
  calculatePositionSize,
} from '@/utils/riskCalculations';

// ── Risk Score Gauge ────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s < 30) return { color: '#22c55e', label: 'Low Risk', bg: 'bg-green-500/10' };
    if (s < 60) return { color: '#eab308', label: 'Moderate Risk', bg: 'bg-yellow-500/10' };
    if (s < 80) return { color: '#f97316', label: 'High Risk', bg: 'bg-orange-500/10' };
    return { color: '#ef4444', label: 'Very High Risk', bg: 'bg-red-500/10' };
  };
  const info = getColor(score);
  const dashOffset = 283 - (283 * Math.min(score, 100)) / 100;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-700" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={info.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray="283" strokeDashoffset={dashOffset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      <span className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${info.bg}`} style={{ color: info.color }}>
        {info.label}
      </span>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Correlation Matrix ──────────────────────────────────────────
function CorrelationMatrixView({ symbols }: { symbols: string[] }) {
  const matrix = useMemo(() => {
    const result: Record<string, number> = {};
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i; j < symbols.length; j++) {
        if (i === j) {
          result[`${symbols[i]}-${symbols[j]}`] = 1;
        } else {
          // Generate pseudo-correlation based on asset type similarity
          const a = symbols[i].toLowerCase();
          const b = symbols[j].toLowerCase();
          const cryptos = ['bitcoin', 'ethereum', 'solana', 'cardano', 'dogecoin', 'polkadot', 'ripple'];
          const aIsCrypto = cryptos.some(c => a.includes(c)) || a.length < 5;
          const bIsCrypto = cryptos.some(c => b.includes(c)) || b.length < 5;
          let corr: number;
          if (aIsCrypto && bIsCrypto) {
            corr = 0.4 + Math.random() * 0.4; // crypto-crypto: 0.4-0.8
          } else if (!aIsCrypto && !bIsCrypto) {
            corr = 0.1 + Math.random() * 0.5; // forex-forex: 0.1-0.6
          } else {
            corr = -0.2 + Math.random() * 0.4; // cross-asset: -0.2 to 0.2
          }
          const key = `${symbols[i]}-${symbols[j]}`;
          result[key] = Math.round(corr * 100) / 100;
        }
      }
    }
    return result;
  }, [symbols]);

  if (symbols.length < 2) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Need at least 2 different assets to show correlations</p>
      </div>
    );
  }

  const getCorrColor = (v: number) => {
    if (v >= 0.7) return 'bg-red-500/60 text-white';
    if (v >= 0.3) return 'bg-orange-500/40 text-white';
    if (v > -0.3) return 'bg-gray-600/40 text-gray-300';
    if (v > -0.7) return 'bg-blue-500/40 text-white';
    return 'bg-blue-600/60 text-white';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="p-2 text-xs text-gray-400"></th>
            {symbols.map(s => (
              <th key={s} className="p-2 text-xs text-gray-400 font-medium">{s.slice(0, 6).toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((s1, i) => (
            <tr key={s1}>
              <td className="p-2 text-xs text-gray-400 font-medium">{s1.slice(0, 6).toUpperCase()}</td>
              {symbols.map((s2, j) => {
                const key = i <= j ? `${s1}-${s2}` : `${s2}-${s1}`;
                const val = matrix[key] ?? 0;
                return (
                  <td key={s2} className={`p-2 text-center text-xs font-mono rounded ${getCorrColor(val)}`}>
                    {val.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/60"></span> High +corr</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-600/40"></span> Neutral</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600/60"></span> Negative corr</span>
      </div>
    </div>
  );
}

// ── Monte Carlo Chart (pure SVG) ────────────────────────────────
function MonteCarloChart({ initialValue, days }: { initialValue: number; days: number }) {
  const simResult = useMemo(() => {
    // Create synthetic daily returns based on typical crypto volatility
    const syntheticReturns: number[] = [];
    for (let i = 0; i < 60; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      syntheticReturns.push(0.0005 + z * 0.02); // ~2% daily vol
    }
    return runMonteCarloSimulation(initialValue, syntheticReturns, days, 200);
  }, [initialValue, days]);

  const bands = simResult.percentiles;
  const allVals = [...bands.p5, ...bands.p95];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;
  const chartH = 200;
  const chartW = 500;

  const toY = (v: number) => chartH - ((v - minVal) / range) * chartH;
  const toX = (i: number) => (i / days) * chartW;

  const makePath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  const makeArea = (upper: number[], lower: number[]) => {
    const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const bottom = [...lower].reverse().map((v, i) => `L${toX(days - i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    return top + ' ' + bottom + ' Z';
  };

  const finalMedian = bands.p50[bands.p50.length - 1];
  const pnl = finalMedian - initialValue;
  const pnlPct = (pnl / initialValue) * 100;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span className="text-gray-400">Median outcome:</span>
        <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          ${finalMedian.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`-40 -10 ${chartW + 60} ${chartH + 30}`} className="w-full max-w-xl" preserveAspectRatio="xMidYMid meet">
          <path d={makeArea(bands.p95, bands.p5)} fill="rgba(139,92,246,0.1)" />
          <path d={makeArea(bands.p75, bands.p25)} fill="rgba(139,92,246,0.2)" />
          <path d={makePath(bands.p50)} fill="none" stroke="#8b5cf6" strokeWidth="2" />
          <path d={makePath(bands.p5)} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          <path d={makePath(bands.p95)} fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
          <line x1="0" y1={toY(initialValue)} x2={chartW} y2={toY(initialValue)} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" />
          {[minVal, initialValue, maxVal].map((v, i) => (
            <text key={i} x="-5" y={toY(v) + 4} textAnchor="end" fill="#9ca3af" fontSize="9">
              ${(v / 1000).toFixed(0)}k
            </text>
          ))}
          {[0, Math.floor(days / 2), days].map(d => (
            <text key={d} x={toX(d)} y={chartH + 15} textAnchor="middle" fill="#9ca3af" fontSize="9">
              Day {d}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block"></span> Median (P50)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/20 inline-block"></span> P25-P75</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/10 inline-block"></span> P5-P95</span>
        <span className="text-gray-600">200 simulations</span>
      </div>
    </div>
  );
}

// ── Exposure Breakdown ──────────────────────────────────────────
function ExposureBreakdown({ positions, cash, totalValue }: {
  positions: { symbol: string; assetType: string; currentPrice: number; quantity: number; side: string }[];
  cash: number;
  totalValue: number;
}) {
  const breakdown = useMemo(() => {
    let cryptoLong = 0, cryptoShort = 0, forexLong = 0, forexShort = 0;
    positions.forEach(p => {
      const val = p.currentPrice * p.quantity;
      if (p.assetType === 'crypto') {
        if (p.side === 'long') cryptoLong += val; else cryptoShort += val;
      } else {
        if (p.side === 'long') forexLong += val; else forexShort += val;
      }
    });
    return [
      { label: 'Cash', value: cash, color: '#6b7280' },
      { label: 'Crypto Long', value: cryptoLong, color: '#22c55e' },
      { label: 'Crypto Short', value: cryptoShort, color: '#ef4444' },
      { label: 'Forex Long', value: forexLong, color: '#3b82f6' },
      { label: 'Forex Short', value: forexShort, color: '#f97316' },
    ].filter(i => i.value > 0);
  }, [positions, cash]);

  return (
    <div className="space-y-3">
      {breakdown.map(item => {
        const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
        return (
          <div key={item.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-gray-300">{item.label}</span>
              </span>
              <span className="text-white font-medium">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Position Sizing Calculator ──────────────────────────────────
function PositionSizer({ totalValue }: { totalValue: number }) {
  const [riskPercent, setRiskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');

  const result = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLossPrice);
    if (!entry || !sl || entry <= 0 || sl <= 0 || entry === sl) return null;
    return calculatePositionSize(totalValue, riskPercent, entry, sl);
  }, [totalValue, riskPercent, entryPrice, stopLossPrice]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Risk per Trade</label>
        <div className="flex items-center gap-3">
          <input
            type="range" min="0.5" max="10" step="0.5" value={riskPercent}
            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
            className="flex-1 accent-purple-500"
          />
          <span className="text-white font-bold w-16 text-right">{riskPercent}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Risk amount: ${(totalValue * riskPercent / 100).toFixed(2)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Entry Price</label>
          <input
            type="number" placeholder="e.g. 65000" value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Stop Loss Price</label>
          <input
            type="number" placeholder="e.g. 63000" value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
      </div>
      {result && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Position Size</span>
            <span className="text-white font-bold">{result.quantity.toFixed(6)} units</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Position Value</span>
            <span className="text-white font-bold">${result.positionSize.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Max Loss</span>
            <span className="text-red-400 font-bold">${result.riskAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Risk/Reward at 2:1</span>
            <span className="text-green-400 font-bold">${(result.riskAmount * 2).toFixed(2)}</span>
          </div>
        </div>
      )}
      {!result && entryPrice && stopLossPrice && (
        <p className="text-xs text-yellow-400">Enter valid entry and stop loss prices (they must be different)</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function RiskDashboard() {
  const { positions, tradeHistory, virtualBalance, getTotalValue, balanceHistory } = usePortfolioStore();
  const [mcDays, setMcDays] = useState(30);

  const totalValue = getTotalValue();

  const metrics = useMemo(() => {
    const returns = tradeHistory
      .filter(t => t.pnl !== undefined)
      .map(t => (t.pnl || 0) / (t.total || 1));

    const balanceValues = balanceHistory.map(s => s.totalValue);
    const balanceReturns = balanceHistory.length > 1
      ? balanceHistory.slice(1).map((s, i) => (s.totalValue - balanceHistory[i].totalValue) / balanceHistory[i].totalValue)
      : returns;

    const dataReturns = balanceReturns.length > 0 ? balanceReturns : returns;

    const varResult95 = calculateVaR(dataReturns, 0.95, totalValue);
    const varResult99 = calculateVaR(dataReturns, 0.99, totalValue);
    const maxDDResult = calculateMaxDrawdown(balanceValues.length > 1 ? balanceValues : [100000, totalValue]);
    const sharpe = calculateSharpeRatio(dataReturns);

    const wins = tradeHistory.filter(t => (t.pnl || 0) > 0).length;
    const losses = tradeHistory.filter(t => (t.pnl || 0) < 0).length;
    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    const avgWin = wins > 0
      ? tradeHistory.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + (t.pnl || 0), 0) / wins
      : 0;
    const avgLoss = losses > 0
      ? Math.abs(tradeHistory.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + (t.pnl || 0), 0)) / losses
      : 0;
    const profitFactor = avgLoss > 0 && losses > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? Infinity : 0;

    const posValues = positions.map(p => ({
      symbol: p.symbol,
      value: p.currentPrice * p.quantity,
    }));
    const totalInvested = posValues.reduce((s, p) => s + p.value, 0);
    const maxConcentration = totalInvested > 0 && posValues.length > 0
      ? Math.max(...posValues.map(p => (p.value / totalValue) * 100))
      : 0;

    // Risk score: 0-100
    let riskScore = 0;
    if (positions.length > 0) {
      if (positions.length === 1) riskScore += 25;
      else if (positions.length <= 3) riskScore += 15;
      else riskScore += 5;

      if (maxConcentration > 50) riskScore += 25;
      else if (maxConcentration > 30) riskScore += 15;
      else riskScore += 5;

      if (maxDDResult.maxDrawdownPercent > 20) riskScore += 25;
      else if (maxDDResult.maxDrawdownPercent > 10) riskScore += 15;
      else riskScore += 5;

      const exposurePct = (totalInvested / totalValue) * 100;
      if (exposurePct > 90) riskScore += 25;
      else if (exposurePct > 70) riskScore += 15;
      else riskScore += 5;
    }

    return {
      var95: varResult95,
      var99: varResult99,
      maxDD: maxDDResult,
      sharpe,
      winRate, wins, losses, totalTrades, avgWin, avgLoss,
      profitFactor, maxConcentration, riskScore,
    };
  }, [tradeHistory, balanceHistory, positions, totalValue]);

  const hasPositions = positions.length > 0;
  const hasTrades = tradeHistory.length > 0;
  const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Risk Management</h1>
        <p className="text-gray-400 mt-1">Portfolio risk analysis, exposure monitoring, and position sizing</p>
      </div>

      {!hasPositions && !hasTrades && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-white mb-2">No Data Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Start paper trading to see risk metrics. Your portfolio risk, exposure, and performance analytics will appear here.
          </p>
        </div>
      )}

      {(hasPositions || hasTrades) && (
        <>
          {/* Row 1: Risk Score + Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 flex flex-col items-center justify-center">
              <h2 className="text-sm font-medium text-gray-400 mb-4 self-start">Portfolio Risk Score</h2>
              <RiskGauge score={metrics.riskScore} />
              <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
                Composite score based on concentration, drawdown, exposure, and diversification
              </p>
            </div>
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Value at Risk (95%)"
                value={`${(metrics.var95.percentile * 100).toFixed(2)}%`}
                sub={`$${metrics.var95.var1Day.toFixed(0)} max daily loss`}
                color="text-yellow-400"
              />
              <StatCard
                label="Value at Risk (99%)"
                value={`${(metrics.var99.percentile * 100).toFixed(2)}%`}
                sub={`$${metrics.var99.var1Day.toFixed(0)} worst case`}
                color="text-red-400"
              />
              <StatCard
                label="Max Drawdown"
                value={`${metrics.maxDD.maxDrawdownPercent.toFixed(2)}%`}
                sub="Largest peak-to-trough decline"
                color={metrics.maxDD.maxDrawdownPercent > 15 ? 'text-red-400' : 'text-yellow-400'}
              />
              <StatCard
                label="Sharpe Ratio"
                value={metrics.sharpe === Infinity ? '∞' : metrics.sharpe.toFixed(2)}
                sub="Risk-adjusted returns"
                color={metrics.sharpe > 1 ? 'text-green-400' : 'text-gray-300'}
              />
              <StatCard
                label="Profit Factor"
                value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                sub={`${metrics.wins}W / ${metrics.losses}L (${metrics.winRate.toFixed(0)}%)`}
                color={metrics.profitFactor > 1.5 ? 'text-green-400' : metrics.profitFactor > 1 ? 'text-yellow-400' : 'text-red-400'}
              />
              <StatCard
                label="Max Concentration"
                value={`${metrics.maxConcentration.toFixed(1)}%`}
                sub="Largest single position"
                color={metrics.maxConcentration > 50 ? 'text-red-400' : 'text-gray-300'}
              />
            </div>
          </div>

          {/* Row 2: Exposure + Correlation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4">Exposure Breakdown</h2>
              {hasPositions ? (
                <ExposureBreakdown positions={positions} cash={virtualBalance} totalValue={totalValue} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No open positions — 100% cash</p>
                </div>
              )}
            </div>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4">Asset Correlation Matrix</h2>
              <CorrelationMatrixView symbols={uniqueSymbols} />
            </div>
          </div>

          {/* Row 3: Monte Carlo */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div>
                <h2 className="text-sm font-medium text-gray-400">Monte Carlo Simulation</h2>
                <p className="text-xs text-gray-500 mt-1">Projected portfolio outcomes based on simulated volatility</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Horizon:</span>
                {[30, 60, 90, 180].map(d => (
                  <button
                    key={d}
                    onClick={() => setMcDays(d)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      mcDays === d ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <MonteCarloChart initialValue={totalValue} days={mcDays} />
          </div>

          {/* Row 4: Position Sizer + Trade Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-1">Position Size Calculator</h2>
              <p className="text-xs text-gray-500 mb-4">Calculate optimal position size based on your risk tolerance</p>
              <PositionSizer totalValue={totalValue} />
            </div>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-sm font-medium text-gray-400 mb-4">Trade Performance</h2>
              {hasTrades ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-500/10 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-400">{metrics.wins}</p>
                      <p className="text-xs text-gray-400">Winning Trades</p>
                      <p className="text-xs text-green-400 mt-1">Avg: +${metrics.avgWin.toFixed(2)}</p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-400">{metrics.losses}</p>
                      <p className="text-xs text-gray-400">Losing Trades</p>
                      <p className="text-xs text-red-400 mt-1">Avg: -${metrics.avgLoss.toFixed(2)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Win Rate</span>
                      <span>{metrics.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: `${metrics.winRate}%` }}></div>
                      <div className="bg-red-500 h-full" style={{ width: `${100 - metrics.winRate}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-gray-700/50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Expected Value per Trade</p>
                    {(() => {
                      const ev = metrics.avgWin * metrics.winRate / 100 - metrics.avgLoss * (100 - metrics.winRate) / 100;
                      return (
                        <p className={`text-lg font-bold ${ev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${ev.toFixed(2)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No completed trades yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-xs text-yellow-500/70">
          ⚠️ Risk metrics are calculated from paper trading data and simulations. They are for educational purposes only.
          Past performance does not guarantee future results. Monte Carlo simulations assume normal distribution which may not reflect actual market conditions.
        </p>
      </div>
    </div>
  );
}
