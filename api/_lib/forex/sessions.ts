export type ForexSessionState = 'open' | 'thin_liquidity' | 'rollover' | 'weekend_closed';

export interface ForexSessionSnapshot {
  state: ForexSessionState;
  label: string;
  asOf: string;
  nextTransitionAt: string;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function startOfUtcHour(date: Date): Date {
  const out = new Date(date);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

function getUpcomingSundayOpen(date: Date): Date {
  const out = startOfUtcHour(date);
  const day = out.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  out.setUTCDate(out.getUTCDate() + daysUntilSunday);
  out.setUTCHours(22, 0, 0, 0);
  if (out <= date) out.setUTCDate(out.getUTCDate() + 7);
  return out;
}

function getUpcomingFridayClose(date: Date): Date {
  const out = startOfUtcHour(date);
  const day = out.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  out.setUTCDate(out.getUTCDate() + daysUntilFriday);
  out.setUTCHours(22, 0, 0, 0);
  if (out <= date) out.setUTCDate(out.getUTCDate() + 7);
  return out;
}

function getNextRolloverBoundary(date: Date): Date {
  const out = new Date(date);
  out.setUTCMinutes(0, 0, 0);
  if (out.getUTCHours() >= 22) {
    out.setUTCDate(out.getUTCDate() + 1);
  }
  out.setUTCHours(22, 0, 0, 0);
  return out;
}

export function getForexSessionSnapshot(now = new Date()): ForexSessionSnapshot {
  const day = now.getUTCDay();
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

  const isWeekendClosed =
    day === 6 ||
    (day === 5 && hour >= 22) ||
    (day === 0 && hour < 22);

  if (isWeekendClosed) {
    return {
      state: 'weekend_closed',
      label: 'Weekend Closed',
      asOf: toIso(now),
      nextTransitionAt: toIso(getUpcomingSundayOpen(now)),
    };
  }

  if (hour >= 21.5 || hour < 0.5) {
    return {
      state: 'rollover',
      label: 'Rollover',
      asOf: toIso(now),
      nextTransitionAt: toIso(getNextRolloverBoundary(now)),
    };
  }

  if (hour < 6 || hour >= 20) {
    return {
      state: 'thin_liquidity',
      label: 'Thin Liquidity',
      asOf: toIso(now),
      nextTransitionAt: toIso(getNextRolloverBoundary(now)),
    };
  }

  return {
    state: 'open',
    label: 'Open',
    asOf: toIso(now),
    nextTransitionAt: toIso(getUpcomingFridayClose(now)),
  };
}

export function isForexMarketTradable(now = new Date()): boolean {
  return getForexSessionSnapshot(now).state !== 'weekend_closed';
}
