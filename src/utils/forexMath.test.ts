import { describe, expect, it } from 'vitest';
import { getForexCatalogPair } from '@/config/forexCatalog';
import {
  LOT_SIZES,
  lotsToUnits,
  pipsToPrice,
  priceToPips,
  roundForexPrice,
  toAccountUsdNotional,
  unitsToLots,
} from './forexMath';

describe('forexMath', () => {
  it('rounds prices using pair-specific steps and precision', () => {
    const eurusd = getForexCatalogPair('EURUSD');
    const usdjpy = getForexCatalogPair('USDJPY');
    if (!eurusd || !usdjpy) throw new Error('Expected catalog pairs to exist');

    expect(roundForexPrice(1.0867349, eurusd)).toBe(1.08673);
    expect(roundForexPrice(149.12389, usdjpy)).toBe(149.124);
  });

  it('converts pips and price deltas consistently', () => {
    const eurusd = getForexCatalogPair('EURUSD');
    if (!eurusd) throw new Error('Expected EURUSD in catalog');

    const delta = pipsToPrice(25, eurusd);
    expect(delta).toBeCloseTo(0.0025, 8);
    expect(priceToPips(delta, eurusd)).toBeCloseTo(25, 8);
  });

  it('converts lot sizes to units and back', () => {
    const units = lotsToUnits(1.5, LOT_SIZES.mini);
    expect(units).toBe(15_000);
    expect(unitsToLots(units, LOT_SIZES.mini)).toBe(1.5);
  });

  it('estimates USD notional across quote/base currency cases', () => {
    expect(toAccountUsdNotional(100_000, 1.1, 'EUR', 'USD', {})).toBeCloseTo(110_000, 4);
    expect(toAccountUsdNotional(100_000, 149.2, 'USD', 'JPY', { JPY: 149.2 })).toBe(100_000);
    expect(toAccountUsdNotional(100_000, 161.4, 'EUR', 'JPY', { JPY: 150 })).toBeCloseTo(107_600, 2);
  });
});
