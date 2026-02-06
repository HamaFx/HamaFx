// Risk Management Calculation Utilities

import type { Position, TradeRecord } from '@/types';

/**
 * Calculate portfolio Value at Risk (VaR) using Historical Simulation
 * @param returns Array of daily return percentages
 * @param confidence Confidence level (e.g., 0.95)
 * @param portfolioValue Current portfolio value
 */
export function calculateVaR(
  returns: number[],
  confidence: number,
  portfolioValue: number
): { var1Day: number; var5Day: number; percentile: number } {
  if (returns.length < 5) {
    return { var1Day: 0, var5Day: 0, percentile: 0 };
  }

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (1 - confidence));
  const percentile = sorted[Math.max(0, index)] ?? 0;

  const var1Day = Math.abs(percentile * portfolioValue);
  const var5Day = var1Day * Math.sqrt(5);

  return { var1Day, var5Day, percentile };
}

/**
 * Calculate maximum drawdown from a series of portfolio values
 */
export function calculateMaxDrawdown(values: number[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakValue: number;
  troughValue: number;
  peakIndex: number;
  troughIndex: number;
} {
  if (values.length < 2) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0, peakValue: 0, troughValue: 0, peakIndex: 0, troughIndex: 0 };
  }

  let peak = values[0];
  let peakIdx = 0;
  let maxDD = 0;
  let maxDDPercent = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;
  let ddPeak = values[0];
  let ddTrough = values[0];

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIdx = i;
    }
    const dd = (peak - values[i]) / peak;
    if (dd > maxDDPercent) {
      maxDDPercent = dd;
      maxDD = peak - values[i];
      ddPeakIdx = peakIdx;
      ddTroughIdx = i;
      ddPeak = peak;
      ddTrough = values[i];
    }
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPercent * 100,
    peakValue: ddPeak,
    troughValue: ddTrough,
    peakIndex: ddPeakIdx,
    troughIndex: ddTroughIdx,
  };
}

/**
 * Calculate Sharpe Ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.05 / 252 // Daily risk-free rate (~5% annual)
): number {
  if (returns.length < 5) return 0;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const excessReturn = avgReturn - riskFreeRate;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  if (stdDev === 0) return 0;
  return (excessReturn / stdDev) * Math.sqrt(252); // Annualized
}

/**
 * Calculate position size based on risk tolerance
 */
export function calculatePositionSize(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number
): {
  positionSize: number;
  riskAmount: number;
  quantity: number;
  riskRewardIfTP?: number;
} {
  const riskAmount = accountBalance * (riskPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
  if (riskPerUnit === 0) return { positionSize: 0, riskAmount, quantity: 0 };
  
  const quantity = riskAmount / riskPerUnit;
  const positionSize = quantity * entryPrice;

  return { positionSize, riskAmount, quantity };
}

/**
 * Calculate correlation between two price series
 */
export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  const len = Math.min(seriesA.length, seriesB.length);
  if (len < 3) return 0;

  const a = seriesA.slice(0, len);
  const b = seriesB.slice(0, len);

  const meanA = a.reduce((s, v) => s + v, 0) / len;
  const meanB = b.reduce((s, v) => s + v, 0) / len;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < len; i++) {
    const dA = a[i] - meanA;
    const dB = b[i] - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}

/**
 * Monte Carlo simulation for portfolio
 */
export function runMonteCarloSimulation(
  startValue: number,
  dailyReturns: number[],
  days: number = 30,
  simulations: number = 200
): {
  paths: number[][];
  percentiles: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] };
  finalValues: number[];
} {
  if (dailyReturns.length < 5) {
    const flat = Array(days).fill(startValue);
    return {
      paths: [flat],
      percentiles: { p5: flat, p25: flat, p50: flat, p75: flat, p95: flat },
      finalValues: [startValue],
    };
  }

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length
  );

  const paths: number[][] = [];
  const finalValues: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [startValue];
    let value = startValue;

    for (let d = 0; d < days; d++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const dailyReturn = mean + stdDev * z;
      value *= (1 + dailyReturn);
      path.push(Math.max(value, 0));
    }

    paths.push(path);
    finalValues.push(value);
  }

  // Calculate percentiles at each day
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  for (let d = 0; d <= days; d++) {
    const dayValues = paths.map(p => p[d]).sort((a, b) => a - b);
    p5.push(dayValues[Math.floor(dayValues.length * 0.05)]);
    p25.push(dayValues[Math.floor(dayValues.length * 0.25)]);
    p50.push(dayValues[Math.floor(dayValues.length * 0.50)]);
    p75.push(dayValues[Math.floor(dayValues.length * 0.75)]);
    p95.push(dayValues[Math.floor(dayValues.length * 0.95)]);
  }

  return { paths, percentiles: { p5, p25, p50, p75, p95 }, finalValues };
}

/**
 * Calculate portfolio risk score (0-100)
 */
export function calculateRiskScore(
  positions: Position[],
  totalValue: number,
  trades: TradeRecord[]
): {
  score: number;
  label: string;
  factors: { name: string; score: number; description: string }[];
} {
  const factors: { name: string; score: number; description: string }[] = [];

  // 1. Concentration risk (0-25) — biggest position as % of portfolio
  const positionValues = positions.map(p => Math.abs(p.quantity * p.currentPrice));
  const maxPosition = positionValues.length > 0 ? Math.max(...positionValues) : 0;
  const concentrationPct = totalValue > 0 ? (maxPosition / totalValue) * 100 : 0;
  const concentrationScore = Math.min(25, concentrationPct * 0.5);
  factors.push({
    name: 'Concentration',
    score: concentrationScore,
    description: `Largest position: ${concentrationPct.toFixed(1)}% of portfolio`,
  });

  // 2. Leverage/exposure risk (0-25) — total exposure vs balance
  const totalExposure = positionValues.reduce((a, b) => a + b, 0);
  const exposureRatio = totalValue > 0 ? totalExposure / totalValue : 0;
  const exposureScore = Math.min(25, exposureRatio * 25);
  factors.push({
    name: 'Exposure',
    score: exposureScore,
    description: `${(exposureRatio * 100).toFixed(0)}% of portfolio deployed`,
  });

  // 3. Diversification (0-25) — number of unique assets
  const uniqueAssets = new Set(positions.map(p => p.symbol)).size;
  const diversificationScore = uniqueAssets === 0 ? 0 : Math.max(0, 25 - uniqueAssets * 5);
  factors.push({
    name: 'Diversification',
    score: diversificationScore,
    description: `${uniqueAssets} unique asset(s) held`,
  });

  // 4. Loss streak risk (0-25) — recent trade win rate
  const recentTrades = trades.slice(-20);
  const losses = recentTrades.filter(t => (t.pnl ?? 0) < 0).length;
  const lossRate = recentTrades.length > 0 ? losses / recentTrades.length : 0;
  const lossScore = lossRate * 25;
  factors.push({
    name: 'Loss Rate',
    score: lossScore,
    description: `${(lossRate * 100).toFixed(0)}% of recent trades were losses`,
  });

  const score = Math.min(100, Math.round(factors.reduce((s, f) => s + f.score, 0)));
  const label = score < 25 ? 'Low Risk' : score < 50 ? 'Moderate' : score < 75 ? 'High Risk' : 'Very High Risk';

  return { score, label, factors };
}

/**
 * Get exposure breakdown
 */
export function getExposureBreakdown(
  positions: Position[],
  cashBalance: number
): { name: string; value: number; color: string }[] {
  const breakdown: { name: string; value: number; color: string }[] = [];
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

  let cryptoLong = 0, cryptoShort = 0, forexLong = 0, forexShort = 0;

  positions.forEach(p => {
    const val = Math.abs(p.quantity * p.currentPrice);
    if (p.assetType === 'crypto') {
      if (p.side === 'long') cryptoLong += val; else cryptoShort += val;
    } else {
      if (p.side === 'long') forexLong += val; else forexShort += val;
    }
  });

  if (cryptoLong > 0) breakdown.push({ name: 'Crypto Long', value: cryptoLong, color: colors[0] });
  if (cryptoShort > 0) breakdown.push({ name: 'Crypto Short', value: cryptoShort, color: colors[1] });
  if (forexLong > 0) breakdown.push({ name: 'Forex Long', value: forexLong, color: colors[2] });
  if (forexShort > 0) breakdown.push({ name: 'Forex Short', value: forexShort, color: colors[3] });
  if (cashBalance > 0) breakdown.push({ name: 'Cash', value: cashBalance, color: colors[4] });

  if (breakdown.length === 0) {
    breakdown.push({ name: 'Cash', value: cashBalance || 100000, color: colors[4] });
  }

  return breakdown;
}
