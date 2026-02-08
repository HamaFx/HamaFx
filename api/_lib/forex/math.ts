import type { ForexCatalogPair } from './catalog.js';

export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function roundForexPrice(value: number, pair: Pick<ForexCatalogPair, 'displayPrecision' | 'priceStep'>): number {
  const stepped = roundToStep(value, pair.priceStep);
  return Number(stepped.toFixed(pair.displayPrecision));
}

export function pipsToPrice(pips: number, pair: Pick<ForexCatalogPair, 'pipSize'>): number {
  return pips * pair.pipSize;
}

export function priceToPips(delta: number, pair: Pick<ForexCatalogPair, 'pipSize'>): number {
  if (!pair.pipSize) return 0;
  return delta / pair.pipSize;
}

export function toAccountUsdNotional(
  quantityUnits: number,
  price: number,
  base: string,
  quote: string,
  usdRates: Record<string, number>
): number {
  const units = Math.abs(quantityUnits);

  if (quote === 'USD') {
    return units * price;
  }

  if (base === 'USD') {
    return units;
  }

  const usdToQuote = usdRates[quote];
  if (!usdToQuote || usdToQuote <= 0) {
    return units * price;
  }

  const quoteToUsd = 1 / usdToQuote;
  return units * price * quoteToUsd;
}
