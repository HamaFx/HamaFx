import { getForexCatalogPair } from './forex/catalog.js';
import { roundForexPrice, toAccountUsdNotional } from './forex/math.js';
import { evaluateOrderRisk, formatGuardrailError } from './risk.js';

type AssetType = 'crypto' | 'forex';
type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop';

type Position = {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: string;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
};

type Order = {
  id: string;
  symbol: string;
  assetType: AssetType;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  statusReason?: string;
  createdAt: string;
  filledAt?: string;
  filledPrice?: number;
};

type TradeRecord = {
  id: string;
  userId: string;
  symbol: string;
  assetType: AssetType;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  pnl?: number;
  pnlPercent?: number;
  executedAt: string;
};

type BalanceSnapshot = {
  timestamp: string;
  totalValue: number;
  cashBalance: number;
};

type TradingSettings = {
  enableRiskGuardrails: boolean;
  maxPositionSizePercent: number;
  maxDailyLossPercent: number;
  maxOpenPositions: number;
  warnOnConcentration: boolean;
};

export type PortfolioState = {
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  orders: Order[];
  tradeHistory: TradeRecord[];
  balanceHistory: BalanceSnapshot[];
};

function cloneState(state: PortfolioState): PortfolioState {
  return {
    ...state,
    positions: [...state.positions],
    orders: [...state.orders],
    tradeHistory: [...state.tradeHistory],
    balanceHistory: [...state.balanceHistory],
  };
}

function getForexPair(symbol: string, assetType: AssetType) {
  if (assetType !== 'forex') return undefined;
  return getForexCatalogPair(symbol);
}

function normalizePrice(price: number, symbol: string, assetType: AssetType): number {
  const pair = getForexPair(symbol, assetType);
  if (!pair) return price;
  return roundForexPrice(price, pair);
}

function normalizeQuantity(quantity: number, assetType: AssetType): number {
  if (assetType === 'forex') {
    return Math.max(0, Math.round(quantity));
  }
  return quantity;
}

function calculateUsdNotional(
  quantity: number,
  price: number,
  symbol: string,
  assetType: AssetType,
  usdRates: Record<string, number>
): number {
  const pair = getForexPair(symbol, assetType);
  if (!pair) return Math.abs(quantity) * price;
  return toAccountUsdNotional(quantity, price, pair.base, pair.quote, usdRates);
}

function calculatePnlUsd(
  quantity: number,
  entryPrice: number,
  exitPrice: number,
  symbol: string,
  assetType: AssetType,
  side: 'long' | 'short',
  usdRates: Record<string, number>
): number {
  const entryNotional = calculateUsdNotional(quantity, entryPrice, symbol, assetType, usdRates);
  const exitNotional = calculateUsdNotional(quantity, exitPrice, symbol, assetType, usdRates);
  const delta = exitNotional - entryNotional;
  return side === 'long' ? delta : -delta;
}

export function calculateTotalValue(state: PortfolioState, usdRates: Record<string, number> = {}): number {
  const exposure = state.positions.reduce((sum, pos) => {
    const notional = calculateUsdNotional(
      pos.quantity,
      pos.currentPrice,
      pos.symbol,
      pos.assetType,
      usdRates
    );
    return sum + (pos.side === 'long' ? notional : -notional);
  }, 0);
  return state.virtualBalance + exposure;
}

function calculateFee(total: number, assetType: AssetType): number {
  const feeRate = assetType === 'crypto' ? 0.001 : 0.0001;
  return Math.round(total * feeRate * 100) / 100;
}

function applySlippage(price: number, side: OrderSide, symbol: string, assetType: AssetType): number {
  const slippagePercent = Math.random() * 0.0004 + 0.0001;
  const slippage = price * slippagePercent;
  const slippagePrice = side === 'buy' ? price + slippage : price - slippage;
  return normalizePrice(slippagePrice, symbol, assetType);
}

function updatePositionPnL(position: Position, usdRates: Record<string, number>): Position {
  const pnl = calculatePnlUsd(
    position.quantity,
    position.entryPrice,
    position.currentPrice,
    position.symbol,
    position.assetType,
    position.side,
    usdRates
  );

  const entryNotional = calculateUsdNotional(
    position.quantity,
    position.entryPrice,
    position.symbol,
    position.assetType,
    usdRates
  );
  const pnlPercent = entryNotional === 0 ? 0 : (pnl / entryNotional) * 100;

  return { ...position, unrealizedPnL: pnl, unrealizedPnLPercent: pnlPercent };
}

export function placeOrder(params: {
  userId: string;
  state: PortfolioState;
  settings: TradingSettings;
  usdRates?: Record<string, number>;
  order: {
    symbol: string;
    name: string;
    assetType: AssetType;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  };
}) {
  const { state } = params;
  const usdRates = params.usdRates ?? {};

  const normalizedOrder = {
    ...params.order,
    quantity: normalizeQuantity(params.order.quantity, params.order.assetType),
    price: normalizePrice(params.order.price, params.order.symbol, params.order.assetType),
    stopLoss: params.order.stopLoss !== undefined
      ? normalizePrice(params.order.stopLoss, params.order.symbol, params.order.assetType)
      : undefined,
    takeProfit: params.order.takeProfit !== undefined
      ? normalizePrice(params.order.takeProfit, params.order.symbol, params.order.assetType)
      : undefined,
  };

  if (normalizedOrder.quantity <= 0) return { success: false as const, error: 'Quantity must be greater than 0' };
  if (normalizedOrder.price <= 0) return { success: false as const, error: 'Invalid price' };

  const risk = evaluateOrderRisk({
    symbol: normalizedOrder.symbol,
    side: normalizedOrder.side,
    quantity: normalizedOrder.quantity,
    price: normalizedOrder.price,
    virtualBalance: state.virtualBalance,
    totalDeposited: state.totalDeposited,
    positions: state.positions,
    tradeHistory: state.tradeHistory,
    settings: params.settings,
  });

  if (risk.hardBlock) {
    return {
      success: false as const,
      error: formatGuardrailError(risk.reasonCodes),
      risk,
    };
  }

  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const nextState = cloneState(state);

  if (normalizedOrder.type === 'market') {
    const filledPrice = applySlippage(
      normalizedOrder.price,
      normalizedOrder.side,
      normalizedOrder.symbol,
      normalizedOrder.assetType
    );
    const filledTotal = calculateUsdNotional(
      normalizedOrder.quantity,
      filledPrice,
      normalizedOrder.symbol,
      normalizedOrder.assetType,
      usdRates
    );
    const filledFee = calculateFee(filledTotal, normalizedOrder.assetType);

    const executedOrder: Order = {
      id: orderId,
      symbol: normalizedOrder.symbol,
      assetType: normalizedOrder.assetType,
      type: 'market',
      side: normalizedOrder.side,
      quantity: normalizedOrder.quantity,
      price: filledPrice,
      status: 'filled',
      createdAt: now,
      filledAt: now,
      filledPrice,
    };

    if (normalizedOrder.side === 'buy') {
      if (filledTotal + filledFee > nextState.virtualBalance) {
        return { success: false as const, error: 'Insufficient balance' };
      }

      const existingIndex = nextState.positions.findIndex((p) => p.symbol === normalizedOrder.symbol && p.side === 'long');
      if (existingIndex >= 0) {
        const existing = nextState.positions[existingIndex];
        const totalQty = existing.quantity + normalizedOrder.quantity;
        const avgPrice = (existing.entryPrice * existing.quantity + filledPrice * normalizedOrder.quantity) / totalQty;
        nextState.positions[existingIndex] = updatePositionPnL({
          ...existing,
          quantity: totalQty,
          entryPrice: normalizePrice(avgPrice, normalizedOrder.symbol, normalizedOrder.assetType),
          currentPrice: filledPrice,
        }, usdRates);
      } else {
        nextState.positions.push(
          updatePositionPnL({
            id: crypto.randomUUID(),
            symbol: normalizedOrder.symbol,
            name: normalizedOrder.name,
            assetType: normalizedOrder.assetType,
            side: 'long',
            quantity: normalizedOrder.quantity,
            entryPrice: filledPrice,
            currentPrice: filledPrice,
            openedAt: now,
            stopLoss: normalizedOrder.stopLoss,
            takeProfit: normalizedOrder.takeProfit,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          }, usdRates)
        );
      }

      nextState.virtualBalance -= filledTotal + filledFee;
      nextState.tradeHistory.unshift({
        id: crypto.randomUUID(),
        userId: params.userId,
        symbol: normalizedOrder.symbol,
        assetType: normalizedOrder.assetType,
        side: 'buy',
        type: 'market',
        quantity: normalizedOrder.quantity,
        price: filledPrice,
        total: filledTotal,
        fee: filledFee,
        executedAt: now,
      });
    } else {
      const longIndex = nextState.positions.findIndex((p) => p.symbol === normalizedOrder.symbol && p.side === 'long');
      if (longIndex >= 0) {
        const existing = nextState.positions[longIndex];
        const sellQty = Math.min(normalizedOrder.quantity, existing.quantity);
        const sellTotal = calculateUsdNotional(
          sellQty,
          filledPrice,
          normalizedOrder.symbol,
          normalizedOrder.assetType,
          usdRates
        );
        const sellFee = calculateFee(sellTotal, normalizedOrder.assetType);
        const pnl = calculatePnlUsd(
          sellQty,
          existing.entryPrice,
          filledPrice,
          normalizedOrder.symbol,
          normalizedOrder.assetType,
          'long',
          usdRates
        );

        if (sellQty >= existing.quantity) {
          nextState.positions.splice(longIndex, 1);
        } else {
          nextState.positions[longIndex] = updatePositionPnL({
            ...existing,
            quantity: existing.quantity - sellQty,
            currentPrice: filledPrice,
          }, usdRates);
        }

        nextState.virtualBalance += sellTotal - sellFee;
        nextState.tradeHistory.unshift({
          id: crypto.randomUUID(),
          userId: params.userId,
          symbol: normalizedOrder.symbol,
          assetType: normalizedOrder.assetType,
          side: 'sell',
          type: 'market',
          quantity: sellQty,
          price: filledPrice,
          total: sellTotal,
          fee: sellFee,
          pnl,
          pnlPercent: existing.entryPrice === 0 ? 0 : ((filledPrice - existing.entryPrice) / existing.entryPrice) * 100,
          executedAt: now,
        });
      } else {
        nextState.positions.push(
          updatePositionPnL({
            id: crypto.randomUUID(),
            symbol: normalizedOrder.symbol,
            name: normalizedOrder.name,
            assetType: normalizedOrder.assetType,
            side: 'short',
            quantity: normalizedOrder.quantity,
            entryPrice: filledPrice,
            currentPrice: filledPrice,
            openedAt: now,
            stopLoss: normalizedOrder.stopLoss,
            takeProfit: normalizedOrder.takeProfit,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          }, usdRates)
        );

        nextState.virtualBalance += filledTotal - filledFee;
        nextState.tradeHistory.unshift({
          id: crypto.randomUUID(),
          userId: params.userId,
          symbol: normalizedOrder.symbol,
          assetType: normalizedOrder.assetType,
          side: 'sell',
          type: 'market',
          quantity: normalizedOrder.quantity,
          price: filledPrice,
          total: filledTotal,
          fee: filledFee,
          executedAt: now,
        });
      }
    }

    nextState.balanceHistory.push({
      timestamp: now,
      totalValue: calculateTotalValue(nextState, usdRates),
      cashBalance: nextState.virtualBalance,
    });

    return {
      success: true as const,
      nextState,
      order: executedOrder,
      warnings: risk.warnings,
      risk,
    };
  }

  const pendingOrder: Order = {
    id: orderId,
    symbol: normalizedOrder.symbol,
    assetType: normalizedOrder.assetType,
    type: normalizedOrder.type,
    side: normalizedOrder.side,
    quantity: normalizedOrder.quantity,
    price: normalizedOrder.price,
    status: 'pending',
    createdAt: now,
  };
  nextState.orders.unshift(pendingOrder);

  return {
    success: true as const,
    nextState,
    order: pendingOrder,
    warnings: risk.warnings,
    risk,
  };
}

export function closePosition(params: {
  userId: string;
  state: PortfolioState;
  positionId: string;
  currentPrice: number;
  usdRates?: Record<string, number>;
}) {
  const { state, positionId, currentPrice } = params;
  const usdRates = params.usdRates ?? {};
  const idx = state.positions.findIndex((p) => p.id === positionId);
  if (idx < 0) return { success: false as const, error: 'Position not found' };

  const position = state.positions[idx];
  const normalizedPrice = normalizePrice(currentPrice, position.symbol, position.assetType);
  const now = new Date().toISOString();

  const total = calculateUsdNotional(
    position.quantity,
    normalizedPrice,
    position.symbol,
    position.assetType,
    usdRates
  );
  const fee = calculateFee(total, position.assetType);

  const pnl = calculatePnlUsd(
    position.quantity,
    position.entryPrice,
    normalizedPrice,
    position.symbol,
    position.assetType,
    position.side,
    usdRates
  );

  const nextState = cloneState(state);

  nextState.positions.splice(idx, 1);
  if (position.side === 'long') {
    nextState.virtualBalance += total - fee;
  } else {
    const marginReleased = calculateUsdNotional(
      position.quantity,
      position.entryPrice,
      position.symbol,
      position.assetType,
      usdRates
    );
    nextState.virtualBalance += marginReleased + pnl - fee;
  }

  const entryNotional = calculateUsdNotional(
    position.quantity,
    position.entryPrice,
    position.symbol,
    position.assetType,
    usdRates
  );

  const trade: TradeRecord = {
    id: crypto.randomUUID(),
    userId: params.userId,
    symbol: position.symbol,
    assetType: position.assetType,
    side: position.side === 'long' ? 'sell' : 'buy',
    type: 'market',
    quantity: position.quantity,
    price: normalizedPrice,
    total,
    fee,
    pnl,
    pnlPercent: entryNotional === 0 ? 0 : (pnl / entryNotional) * 100,
    executedAt: now,
  };

  nextState.tradeHistory.unshift(trade);
  nextState.balanceHistory.push({
    timestamp: now,
    totalValue: calculateTotalValue(nextState, usdRates),
    cashBalance: nextState.virtualBalance,
  });

  return { success: true as const, nextState, trade };
}
