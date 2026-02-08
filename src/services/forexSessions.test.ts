import { describe, expect, it } from 'vitest';
import { getForexSessionSnapshot, isForexMarketTradable } from './forexSessions';

describe('forexSessions', () => {
  it('marks weekend market as closed', () => {
    const snapshot = getForexSessionSnapshot(new Date('2026-02-07T12:00:00.000Z'));
    expect(snapshot.state).toBe('weekend_closed');
    expect(isForexMarketTradable(new Date('2026-02-07T12:00:00.000Z'))).toBe(false);
  });

  it('marks rollover window correctly', () => {
    const snapshot = getForexSessionSnapshot(new Date('2026-02-09T21:45:00.000Z'));
    expect(snapshot.state).toBe('rollover');
    expect(snapshot.label).toBe('Rollover');
  });

  it('marks thin-liquidity and open sessions', () => {
    const thin = getForexSessionSnapshot(new Date('2026-02-09T03:00:00.000Z'));
    const open = getForexSessionSnapshot(new Date('2026-02-10T10:00:00.000Z'));

    expect(thin.state).toBe('thin_liquidity');
    expect(open.state).toBe('open');
    expect(isForexMarketTradable(new Date('2026-02-10T10:00:00.000Z'))).toBe(true);
  });
});
