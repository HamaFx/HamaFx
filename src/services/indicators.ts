// Technical Indicator Calculations
// All computed client-side — no external library needed
// These feed both chart overlays AND AI context for Gemini prompts

import type { OHLCV } from '@/types';

// ===== Simple Moving Average =====
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// ===== Exponential Moving Average =====
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // First EMA = SMA
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push((data[i] - prev) * multiplier + prev);
    }
  }
  return result;
}

// ===== Relative Strength Index =====
export interface RSIResult {
  values: (number | null)[];
  overbought: number;
  oversold: number;
}

export function calculateRSI(data: number[], period: number = 14): RSIResult {
  const values: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  values.push(null); // First element has no RSI

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      values.push(null);
    } else if (i === period - 1) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      values.push(100 - 100 / (1 + rs));
    } else {
      // Use smoothed averages
      const prevRSI = values[values.length - 1];
      if (prevRSI === null) {
        values.push(null);
        continue;
      }
      // Reconstruct previous avg gain/loss from RSI
      const prevRS = prevRSI === 100 ? Infinity : prevRSI / (100 - prevRSI);
      const prevAvgLoss = prevRS === Infinity ? 0 : 1 / (1 + prevRS);
      const prevAvgGain = prevRS === Infinity ? 1 : prevRS * prevAvgLoss;

      const avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      values.push(Math.min(100, Math.max(0, 100 - 100 / (1 + rs))));
    }
  }

  return { values, overbought: 70, oversold: 30 };
}

// ===== MACD =====
export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine.push(fastEMA[i]! - slowEMA[i]!);
    } else {
      macdLine.push(null);
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalEMA = calculateEMA(validMacd, signalPeriod);

  // Align signal back to original length
  const signal: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      signal.push(signalEMA[signalIdx] ?? null);
      signalIdx++;
    } else {
      signal.push(null);
    }
  }

  // Histogram = MACD - Signal
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && signal[i] !== null) {
      histogram.push(macdLine[i]! - signal[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal, histogram };
}

// ===== Bollinger Bands =====
export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  const sma = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance) * stdDev;
      upper.push(mean + sd);
      lower.push(mean - sd);
    }
  }

  return { upper, middle: sma, lower };
}

// ===== Stochastic Oscillator =====
export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export function calculateStochastic(
  ohlcv: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult {
  const k: (number | null)[] = [];

  for (let i = 0; i < ohlcv.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
    } else {
      const slice = ohlcv.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(c => c.high));
      const lowest = Math.min(...slice.map(c => c.low));
      const range = highest - lowest;
      k.push(range === 0 ? 50 : ((ohlcv[i].close - lowest) / range) * 100);
    }
  }

  // %D = SMA of %K
  const validK = k.filter((v): v is number => v !== null);
  const dValues = calculateSMA(validK, dPeriod);

  const d: (number | null)[] = [];
  let dIdx = 0;
  for (let i = 0; i < k.length; i++) {
    if (k[i] !== null) {
      d.push(dValues[dIdx] ?? null);
      dIdx++;
    } else {
      d.push(null);
    }
  }

  return { k, d };
}

// ===== Volume Analysis =====
export function calculateVolumeMA(volumes: number[], period: number = 20): (number | null)[] {
  return calculateSMA(volumes, period);
}

// ===== Support & Resistance (simple pivot-based) =====
export function findSupportResistance(ohlcv: OHLCV[]): { support: number; resistance: number } {
  if (ohlcv.length < 5) {
    const last = ohlcv[ohlcv.length - 1];
    return { support: last?.low ?? 0, resistance: last?.high ?? 0 };
  }

  const recentData = ohlcv.slice(-30);
  const lows = recentData.map(c => c.low);
  const highs = recentData.map(c => c.high);

  // Simple: find clusters of lows and highs
  lows.sort((a, b) => a - b);
  highs.sort((a, b) => b - a);

  return {
    support: lows[Math.floor(lows.length * 0.1)],
    resistance: highs[Math.floor(highs.length * 0.1)],
  };
}

// ===== Build indicator context for AI prompts =====
export function buildIndicatorContext(ohlcv: OHLCV[]): Record<string, unknown> {
  if (ohlcv.length < 30) return { insufficient_data: true };

  const closes = ohlcv.map(c => c.close);
  const lastClose = closes[closes.length - 1];

  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, Math.min(200, closes.length));
  const stoch = calculateStochastic(ohlcv);
  const sr = findSupportResistance(ohlcv);

  const lastRSI = rsi.values.filter(v => v !== null).pop();
  const lastMACD = macd.macd.filter(v => v !== null).pop();
  const lastSignal = macd.signal.filter(v => v !== null).pop();
  const lastHistogram = macd.histogram.filter(v => v !== null).pop();
  const lastBBUpper = bb.upper.filter(v => v !== null).pop();
  const lastBBMiddle = bb.middle.filter(v => v !== null).pop();
  const lastBBLower = bb.lower.filter(v => v !== null).pop();
  const lastSMA20 = sma20.filter(v => v !== null).pop();
  const lastSMA50 = sma50.filter(v => v !== null).pop();
  const lastSMA200 = sma200.filter(v => v !== null).pop();
  const lastStochK = stoch.k.filter(v => v !== null).pop();
  const lastStochD = stoch.d.filter(v => v !== null).pop();

  return {
    currentPrice: lastClose,
    rsi14: lastRSI != null ? Math.round(lastRSI * 100) / 100 : null,
    macd: {
      macd: lastMACD != null ? Math.round(lastMACD * 100) / 100 : null,
      signal: lastSignal != null ? Math.round(lastSignal * 100) / 100 : null,
      histogram: lastHistogram != null ? Math.round(lastHistogram * 100) / 100 : null,
    },
    bollingerBands: {
      upper: lastBBUpper != null ? Math.round(lastBBUpper * 100) / 100 : null,
      middle: lastBBMiddle != null ? Math.round(lastBBMiddle * 100) / 100 : null,
      lower: lastBBLower != null ? Math.round(lastBBLower * 100) / 100 : null,
    },
    sma20: lastSMA20 != null ? Math.round(lastSMA20 * 100) / 100 : null,
    sma50: lastSMA50 != null ? Math.round(lastSMA50 * 100) / 100 : null,
    sma200: lastSMA200 != null ? Math.round(lastSMA200 * 100) / 100 : null,
    stochastic: {
      k: lastStochK != null ? Math.round(lastStochK * 100) / 100 : null,
      d: lastStochD != null ? Math.round(lastStochD * 100) / 100 : null,
    },
    support: Math.round(sr.support * 100) / 100,
    resistance: Math.round(sr.resistance * 100) / 100,
  };
}

// ===== Rule-Based Signal Engine (fallback when no Gemini key) =====
export function generateRuleBasedSignal(ohlcv: OHLCV[]): {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  riskFactors: string[];
} {
  if (ohlcv.length < 30) {
    return { signal: 'HOLD', confidence: 20, reasoning: ['Insufficient data for analysis'], riskFactors: ['Limited historical data'] };
  }

  const closes = ohlcv.map(c => c.close);
  let score = 0; // -100 to +100
  const reasoning: string[] = [];
  const riskFactors: string[] = [];

  // RSI
  const rsi = calculateRSI(closes, 14);
  const lastRSI = rsi.values.filter(v => v !== null).pop() ?? 50;
  if (lastRSI < 30) { score += 25; reasoning.push(`RSI at ${lastRSI.toFixed(1)} indicates oversold conditions`); }
  else if (lastRSI > 70) { score -= 25; reasoning.push(`RSI at ${lastRSI.toFixed(1)} indicates overbought conditions`); }
  else if (lastRSI < 45) { score += 10; reasoning.push(`RSI at ${lastRSI.toFixed(1)} — neutral-bullish`); }
  else if (lastRSI > 55) { score -= 10; reasoning.push(`RSI at ${lastRSI.toFixed(1)} — neutral-bearish`); }

  // MACD
  const macd = calculateMACD(closes);
  const lastHist = macd.histogram.filter(v => v !== null).pop() ?? 0;
  const prevHist = macd.histogram.filter(v => v !== null).slice(-2)[0] ?? 0;
  if (lastHist > 0 && prevHist <= 0) { score += 20; reasoning.push('MACD bullish crossover detected'); }
  else if (lastHist < 0 && prevHist >= 0) { score -= 20; reasoning.push('MACD bearish crossover detected'); }
  else if (lastHist > 0) { score += 10; reasoning.push('MACD histogram positive — bullish momentum'); }
  else if (lastHist < 0) { score -= 10; reasoning.push('MACD histogram negative — bearish momentum'); }

  // SMA Trend
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, Math.min(50, closes.length));
  const lastSMA20 = sma20.filter(v => v !== null).pop();
  const lastSMA50 = sma50.filter(v => v !== null).pop();
  const lastClose = closes[closes.length - 1];

  if (lastSMA20 && lastClose > lastSMA20) { score += 10; reasoning.push('Price above 20-day SMA — short-term uptrend'); }
  if (lastSMA20 && lastClose < lastSMA20) { score -= 10; reasoning.push('Price below 20-day SMA — short-term downtrend'); }
  if (lastSMA20 && lastSMA50 && lastSMA20 > lastSMA50) { score += 10; reasoning.push('20 SMA above 50 SMA — golden cross pattern'); }
  if (lastSMA20 && lastSMA50 && lastSMA20 < lastSMA50) { score -= 10; riskFactors.push('Death cross: 20 SMA below 50 SMA'); }

  // Bollinger Bands
  const bb = calculateBollingerBands(closes);
  const lastBBUpper = bb.upper.filter(v => v !== null).pop();
  const lastBBLower = bb.lower.filter(v => v !== null).pop();
  if (lastBBLower && lastClose <= lastBBLower) { score += 15; reasoning.push('Price at lower Bollinger Band — potential bounce'); }
  if (lastBBUpper && lastClose >= lastBBUpper) { score -= 15; riskFactors.push('Price at upper Bollinger Band — potential pullback'); }

  // Volume trend
  const volumes = ohlcv.map(c => c.volume ?? 0);
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (recentVol > avgVol * 1.5 && score > 0) { score += 10; reasoning.push('Above-average volume confirms bullish pressure'); }
  if (recentVol > avgVol * 1.5 && score < 0) { score -= 10; riskFactors.push('High volume on selling — bearish confirmation'); }

  // Risk factors
  if (Math.abs(score) < 20) riskFactors.push('Mixed signals — consider waiting for clearer direction');
  riskFactors.push('Algorithm-based analysis — not financial advice');

  // Convert score to signal
  const signal: 'BUY' | 'SELL' | 'HOLD' = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';
  const confidence = Math.min(95, Math.max(15, Math.abs(score) + 20));

  return { signal, confidence, reasoning: reasoning.slice(0, 5), riskFactors: riskFactors.slice(0, 4) };
}
