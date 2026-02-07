const portfolioTabs = ['positions', 'orders', 'history'] as const;
const marketsViews = ['list', 'grid'] as const;
const marketsAssets = ['all', 'crypto', 'forex'] as const;
const marketsSortFields = ['name', 'price', 'change', 'volume', 'marketCap'] as const;
const sortOrders = ['asc', 'desc'] as const;
const settingsTabs = ['apikeys', 'profile', 'preferences', 'notifications', 'data', 'audit'] as const;

export type PortfolioTab = (typeof portfolioTabs)[number];
export type MarketsView = (typeof marketsViews)[number];
export type MarketsAsset = (typeof marketsAssets)[number];
export type MarketsSortField = (typeof marketsSortFields)[number];
export type SortOrder = (typeof sortOrders)[number];
export type SettingsTabId = (typeof settingsTabs)[number];

export interface MarketsUrlState {
  view: MarketsView;
  asset: MarketsAsset;
  sort: MarketsSortField;
  order: SortOrder;
  q: string;
}

function readEnumValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function readPortfolioUrlState(searchParams: URLSearchParams): PortfolioTab {
  return readEnumValue(searchParams.get('portfolioTab'), portfolioTabs, 'positions');
}

export function writePortfolioUrlState(searchParams: URLSearchParams, tab: PortfolioTab): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set('portfolioTab', tab);
  return next;
}

export function readMarketsUrlState(searchParams: URLSearchParams): MarketsUrlState {
  return {
    view: readEnumValue(searchParams.get('marketsView'), marketsViews, 'list'),
    asset: readEnumValue(searchParams.get('marketsAsset'), marketsAssets, 'all'),
    sort: readEnumValue(searchParams.get('marketsSort'), marketsSortFields, 'marketCap'),
    order: readEnumValue(searchParams.get('marketsOrder'), sortOrders, 'desc'),
    q: searchParams.get('marketsQ') ?? '',
  };
}

export function writeMarketsUrlState(searchParams: URLSearchParams, state: MarketsUrlState): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set('marketsView', state.view);
  next.set('marketsAsset', state.asset);
  next.set('marketsSort', state.sort);
  next.set('marketsOrder', state.order);
  if (state.q.trim()) next.set('marketsQ', state.q.trim());
  else next.delete('marketsQ');
  return next;
}

export function readSettingsUrlState(searchParams: URLSearchParams): SettingsTabId {
  return readEnumValue(searchParams.get('settingsTab'), settingsTabs, 'apikeys');
}

export function writeSettingsUrlState(searchParams: URLSearchParams, tab: SettingsTabId): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set('settingsTab', tab);
  return next;
}
