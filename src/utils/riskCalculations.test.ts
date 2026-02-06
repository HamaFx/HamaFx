import { describe, expect, it } from 'vitest';
import {
  calculateMaxDrawdown,
  calculatePositionSize,
  calculateVaR,
  runMonteCarloSimulation,
} from '@/utils/riskCalculations';

describe('riskCalculations', () => {
  it('calculates VaR from historical returns', () => {
    const returns = [-0.05, -0.02, 0.01, 0.03, -0.01, -0.04];
    const result = calculateVaR(returns, 0.95, 10000);

    expect(result.percentile).toBe(-0.05);
    expect(result.var1Day).toBe(500);
    expect(result.var5Day).toBeCloseTo(1118.03, 2);
  });

  it('calculates max drawdown correctly', () => {
    const values = [100, 110, 105, 120, 90, 95];
    const result = calculateMaxDrawdown(values);

    expect(result.maxDrawdown).toBe(30);
    expect(result.maxDrawdownPercent).toBe(25);
    expect(result.peakValue).toBe(120);
    expect(result.troughValue).toBe(90);
  });

  it('calculates position size from risk parameters', () => {
    const result = calculatePositionSize(10000, 2, 100, 95);

    expect(result.riskAmount).toBe(200);
    expect(result.quantity).toBe(40);
    expect(result.positionSize).toBe(4000);
  });

  it('returns valid monte-carlo structures', () => {
    const sim = runMonteCarloSimulation(10000, [0.01, -0.008, 0.003, -0.004, 0.006, 0.002], 20, 30);

    expect(sim.paths).toHaveLength(30);
    expect(sim.paths.every(path => path.length === 21)).toBe(true);
    expect(sim.percentiles.p5).toHaveLength(21);
    expect(sim.percentiles.p50).toHaveLength(21);
    expect(sim.percentiles.p95).toHaveLength(21);
    expect(sim.finalValues.every(v => v >= 0)).toBe(true);
  });
});
