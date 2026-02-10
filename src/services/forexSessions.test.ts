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

  it('handles session boundary timestamps around rollover and weekend reopen', () => {
    const cases = [
      { at: '2026-02-06T19:59:59.000Z', expected: 'open' },
      { at: '2026-02-06T20:00:00.000Z', expected: 'thin_liquidity' },
      { at: '2026-02-06T21:30:00.000Z', expected: 'rollover' },
      { at: '2026-02-06T21:59:59.000Z', expected: 'rollover' },
      { at: '2026-02-06T22:00:00.000Z', expected: 'weekend_closed' },
      { at: '2026-02-08T21:59:59.000Z', expected: 'weekend_closed' },
      { at: '2026-02-08T22:00:00.000Z', expected: 'rollover' },
      { at: '2026-02-09T00:29:59.000Z', expected: 'rollover' },
      { at: '2026-02-09T00:30:00.000Z', expected: 'thin_liquidity' },
    ] as const;

    for (const item of cases) {
      const snapshot = getForexSessionSnapshot(new Date(item.at));
      expect(snapshot.state, item.at).toBe(item.expected);
    }
  });
});
