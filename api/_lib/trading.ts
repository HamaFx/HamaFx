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

export function calculateTotalValue(state: PortfolioState): number {
  const exposure = state.positions.reduce((sum, pos) => {
    const notional = pos.currentPrice * pos.quantity;
    return sum + (pos.side === 'long' ? notional : -notional);
  }, 0);
  return state.virtualBalance + exposure;
}

function calculateFee(total: number, assetType: AssetType): number {
  const feeRate = assetType === 'crypto' ? 0.001 : 0.0001;
  return Math.round(total * feeRate * 100) / 100;
}

function applySlippage(price: number, side: OrderSide): number {
  const slippagePercent = Math.random() * 0.0004 + 0.0001;
  const slippage = price * slippagePercent;
  return side === 'buy' ? price + slippage : price - slippage;
}

function updatePositionPnL(position: Position): Position {
  const pnl = position.side === 'long'
    ? (position.currentPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - position.currentPrice) * position.quantity;
  const pnlPercent = position.entryPrice === 0 ? 0 : (pnl / (position.entryPrice * position.quantity)) * 100;
  return { ...position, unrealizedPnL: pnl, unrealizedPnLPercent: pnlPercent };
}

export function placeOrder(params: {
  userId: string;
  state: PortfolioState;
  settings: TradingSettings;
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
  const { state, order } = params;

  if (order.quantity <= 0) return { success: false as const, error: 'Quantity must be greater than 0' };
  if (order.price <= 0) return { success: false as const, error: 'Invalid price' };

  const risk = evaluateOrderRisk({
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
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
  const nextState: PortfolioState = {
    ...state,
    positions: [...state.positions],
    orders: [...state.orders],
    tradeHistory: [...state.tradeHistory],
    balanceHistory: [...state.balanceHistory],
  };

  if (order.type === 'market') {
    const filledPrice = applySlippage(order.price, order.side);
    const filledTotal = order.quantity * filledPrice;
    const filledFee = calculateFee(filledTotal, order.assetType);

    const executedOrder: Order = {
      id: orderId,
      symbol: order.symbol,
      assetType: order.assetType,
      type: 'market',
      side: order.side,
      quantity: order.quantity,
      price: filledPrice,
      status: 'filled',
      createdAt: now,
      filledAt: now,
      filledPrice,
    };

    if (order.side === 'buy') {
      if (filledTotal + filledFee > nextState.virtualBalance) {
        return { success: false as const, error: 'Insufficient balance' };
      }

      const existingIndex = nextState.positions.findIndex((p) => p.symbol === order.symbol && p.side === 'long');
      if (existingIndex >= 0) {
        const existing = nextState.positions[existingIndex];
        const totalQty = existing.quantity + order.quantity;
        const avgPrice = (existing.entryPrice * existing.quantity + filledPrice * order.quantity) / totalQty;
        nextState.positions[existingIndex] = updatePositionPnL({
          ...existing,
          quantity: totalQty,
          entryPrice: avgPrice,
          currentPrice: filledPrice,
        });
      } else {
        nextState.positions.push(
          updatePositionPnL({
            id: crypto.randomUUID(),
            symbol: order.symbol,
            name: order.name,
            assetType: order.assetType,
            side: 'long',
            quantity: order.quantity,
            entryPrice: filledPrice,
            currentPrice: filledPrice,
            openedAt: now,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          })
        );
      }

      nextState.virtualBalance -= filledTotal + filledFee;
      nextState.tradeHistory.unshift({
        id: crypto.randomUUID(),
        userId: params.userId,
        symbol: order.symbol,
        assetType: order.assetType,
        side: 'buy',
        type: 'market',
        quantity: order.quantity,
        price: filledPrice,
        total: filledTotal,
        fee: filledFee,
        executedAt: now,
      });
    } else {
      const longIndex = nextState.positions.findIndex((p) => p.symbol === order.symbol && p.side === 'long');
      if (longIndex >= 0) {
        const existing = nextState.positions[longIndex];
        const sellQty = Math.min(order.quantity, existing.quantity);
        const sellTotal = sellQty * filledPrice;
        const sellFee = calculateFee(sellTotal, order.assetType);
        const pnl = (filledPrice - existing.entryPrice) * sellQty;

        if (sellQty >= existing.quantity) {
          nextState.positions.splice(longIndex, 1);
        } else {
          nextState.positions[longIndex] = updatePositionPnL({
            ...existing,
            quantity: existing.quantity - sellQty,
            currentPrice: filledPrice,
          });
        }

        nextState.virtualBalance += sellTotal - sellFee;
        nextState.tradeHistory.unshift({
          id: crypto.randomUUID(),
          userId: params.userId,
          symbol: order.symbol,
          assetType: order.assetType,
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
            symbol: order.symbol,
            name: order.name,
            assetType: order.assetType,
            side: 'short',
            quantity: order.quantity,
            entryPrice: filledPrice,
            currentPrice: filledPrice,
            openedAt: now,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          })
        );

        nextState.virtualBalance += filledTotal - filledFee;
        nextState.tradeHistory.unshift({
          id: crypto.randomUUID(),
          userId: params.userId,
          symbol: order.symbol,
          assetType: order.assetType,
          side: 'sell',
          type: 'market',
          quantity: order.quantity,
          price: filledPrice,
          total: filledTotal,
          fee: filledFee,
          executedAt: now,
        });
      }
    }

    nextState.balanceHistory.push({
      timestamp: now,
      totalValue: calculateTotalValue(nextState),
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
    symbol: order.symbol,
    assetType: order.assetType,
    type: order.type,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
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
}) {
  const { state, positionId, currentPrice } = params;
  const idx = state.positions.findIndex((p) => p.id === positionId);
  if (idx < 0) return { success: false as const, error: 'Position not found' };

  const position = state.positions[idx];
  const now = new Date().toISOString();
  const total = position.quantity * currentPrice;
  const fee = calculateFee(total, position.assetType);

  const pnl = position.side === 'long'
    ? (currentPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - currentPrice) * position.quantity;

  const nextState: PortfolioState = {
    ...state,
    positions: [...state.positions],
    orders: [...state.orders],
    tradeHistory: [...state.tradeHistory],
    balanceHistory: [...state.balanceHistory],
  };

  nextState.positions.splice(idx, 1);
  if (position.side === 'long') {
    nextState.virtualBalance += total - fee;
  } else {
    const marginReleased = position.entryPrice * position.quantity;
    nextState.virtualBalance += marginReleased + pnl - fee;
  }

  const trade: TradeRecord = {
    id: crypto.randomUUID(),
    userId: params.userId,
    symbol: position.symbol,
    assetType: position.assetType,
    side: position.side === 'long' ? 'sell' : 'buy',
    type: 'market',
    quantity: position.quantity,
    price: currentPrice,
    total,
    fee,
    pnl,
    pnlPercent: position.entryPrice === 0 ? 0 : (pnl / (position.entryPrice * position.quantity)) * 100,
    executedAt: now,
  };

  nextState.tradeHistory.unshift(trade);
  nextState.balanceHistory.push({
    timestamp: now,
    totalValue: calculateTotalValue(nextState),
    cashBalance: nextState.virtualBalance,
  });

  return { success: true as const, nextState, trade };
}
