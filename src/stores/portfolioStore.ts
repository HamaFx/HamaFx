import { create } from 'zustand';
import type { Position, Order, TradeRecord, BalanceSnapshot, OrderSide, OrderType, AssetType } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { showToast } from '@/components/ui/ToastContainer';
import { evaluateOrderRisk, formatGuardrailError } from '@/services/riskGuardrails';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const PORTFOLIO_KEY_PREFIX = 'nexus_portfolio_';
const TRADES_KEY_PREFIX = 'nexus_trades_';
const LEGACY_PORTFOLIO_KEY = 'nexus_portfolio';
const LEGACY_TRADES_KEY = 'nexus_trades';

function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id || 'demo';
}

function getPortfolioKey(userId: string): string {
  return `${PORTFOLIO_KEY_PREFIX}${userId}`;
}

function getTradesKey(userId: string): string {
  return `${TRADES_KEY_PREFIX}${userId}`;
}

interface PortfolioState {
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  orders: Order[];
  tradeHistory: TradeRecord[];
  balanceHistory: BalanceSnapshot[];
  isLoading: boolean;

  // Actions
  loadPortfolio: () => void;
  placeOrder: (params: {
    symbol: string;
    name: string;
    assetType: AssetType;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => { success: boolean; error?: string; order?: Order };
  closePosition: (positionId: string, currentPrice: number) => { success: boolean; trade?: TradeRecord };
  cancelOrder: (orderId: string) => void;
  updatePositionPrices: (prices: Record<string, number>) => void;
  checkPendingOrders: (prices: Record<string, number>) => void;
  resetPortfolio: () => void;
  getTotalValue: () => number;
  getTotalPnL: () => { amount: number; percent: number };
  getInvestedAmount: () => number;
  snapshotBalance: () => void;
}

function loadFromStorage(userId: string = getCurrentUserId()): {
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  orders: Order[];
  balanceHistory: BalanceSnapshot[];
} {
  try {
    const stored = localStorage.getItem(getPortfolioKey(userId));
    const legacyStored = localStorage.getItem(LEGACY_PORTFOLIO_KEY);
    const raw = stored || legacyStored;
    if (raw) {
      const data = JSON.parse(raw);
      return {
        virtualBalance: data.virtualBalance ?? 100000,
        totalDeposited: data.totalDeposited ?? 100000,
        positions: data.positions ?? [],
        orders: data.orders ?? [],
        balanceHistory: data.balanceHistory ?? [],
      };
    }
  } catch { /* ignore */ }
  return {
    virtualBalance: 100000,
    totalDeposited: 100000,
    positions: [],
    orders: [],
    balanceHistory: [{ timestamp: new Date().toISOString(), totalValue: 100000, cashBalance: 100000 }],
  };
}

function loadTrades(userId: string = getCurrentUserId()): TradeRecord[] {
  try {
    const stored = localStorage.getItem(getTradesKey(userId));
    const legacyStored = localStorage.getItem(LEGACY_TRADES_KEY);
    const raw = stored || legacyStored;
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePortfolio(
  state: Pick<PortfolioState, 'virtualBalance' | 'totalDeposited' | 'positions' | 'orders' | 'balanceHistory'>,
  userId: string = getCurrentUserId()
) {
  localStorage.setItem(getPortfolioKey(userId), JSON.stringify({
    virtualBalance: state.virtualBalance,
    totalDeposited: state.totalDeposited,
    positions: state.positions,
    orders: state.orders,
    balanceHistory: state.balanceHistory,
  }));
}

function saveTrades(trades: TradeRecord[], userId: string = getCurrentUserId()) {
  localStorage.setItem(getTradesKey(userId), JSON.stringify(trades));
}

// Fee structure: 0.1% crypto, 0.01% forex
function calculateFee(total: number, assetType: AssetType): number {
  const feeRate = assetType === 'crypto' ? 0.001 : 0.0001;
  return Math.round(total * feeRate * 100) / 100;
}

// Simulated slippage: ±0.01-0.05%
function applySlippage(price: number, side: OrderSide): number {
  const slippagePercent = (Math.random() * 0.0004 + 0.0001);
  const slippage = price * slippagePercent;
  return side === 'buy' ? price + slippage : price - slippage;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  const initialUserId = getCurrentUserId();
  const initial = loadFromStorage(initialUserId);
  const initialTrades = loadTrades(initialUserId);

  return {
    ...initial,
    tradeHistory: initialTrades,
    isLoading: false,

    loadPortfolio: () => {
      const userId = getCurrentUserId();
      const data = loadFromStorage(userId);
      const trades = loadTrades(userId);
      set({ ...data, tradeHistory: trades, isLoading: false });
    },

    placeOrder: (params) => {
      const state = get();
      const { symbol, name, assetType, side, type, quantity, price, stopLoss, takeProfit } = params;

      // Validate
      if (quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' };
      if (price <= 0) return { success: false, error: 'Invalid price' };

      const riskResult = evaluateOrderRisk({
        symbol,
        side,
        quantity,
        price,
        virtualBalance: state.virtualBalance,
        totalDeposited: state.totalDeposited,
        positions: state.positions,
        tradeHistory: state.tradeHistory,
        settings: useSettingsStore.getState().settings.trading,
      });

      if (riskResult.hardBlock) {
        const message = formatGuardrailError(riskResult.reasonCodes);
        useAuthStore.getState().addAuditEntry(
          'RISK_GUARDRAIL_BLOCKED',
          `${side.toUpperCase()} ${quantity} ${symbol} blocked (${riskResult.reasonCodes.join(', ')})`
        );
        showToast('warning', 'Order Blocked', message);
        return { success: false, error: message };
      }

      if (riskResult.warnings.length > 0) {
        useAuthStore.getState().addAuditEntry(
          'RISK_GUARDRAIL_WARNING',
          `${side.toUpperCase()} ${quantity} ${symbol}: ${riskResult.warnings.join(' ')}`
        );
      }

      const total = quantity * price;
      const fee = calculateFee(total, assetType);

      // Check balance for buy orders
      if (side === 'buy' && total + fee > state.virtualBalance) {
        return { success: false, error: `Insufficient balance. Need $${(total + fee).toFixed(2)}, have $${state.virtualBalance.toFixed(2)}` };
      }

      const orderId = generateId();
      const now = new Date().toISOString();

      if (type === 'market') {
        // Execute immediately
        const filledPrice = applySlippage(price, side);
        const filledTotal = quantity * filledPrice;
        const filledFee = calculateFee(filledTotal, assetType);

        const order: Order = {
          id: orderId,
          symbol,
          assetType,
          type: 'market',
          side,
          quantity,
          price: filledPrice,
          status: 'filled',
          createdAt: now,
          filledAt: now,
          filledPrice,
        };

        // Create or update position
        let newPositions = [...state.positions];
        let newBalance = state.virtualBalance;

        if (side === 'buy') {
          // Check for existing position
          const existingIdx = newPositions.findIndex(p => p.symbol === symbol && p.side === 'long');
          if (existingIdx >= 0) {
            // Average in
            const existing = newPositions[existingIdx];
            const totalQty = existing.quantity + quantity;
            const avgPrice = (existing.entryPrice * existing.quantity + filledPrice * quantity) / totalQty;
            newPositions[existingIdx] = {
              ...existing,
              quantity: totalQty,
              entryPrice: avgPrice,
              currentPrice: filledPrice,
              unrealizedPnL: (filledPrice - avgPrice) * totalQty,
              unrealizedPnLPercent: ((filledPrice - avgPrice) / avgPrice) * 100,
            };
          } else {
            // New position
            newPositions.push({
              id: generateId(),
              symbol,
              name,
              assetType,
              side: 'long',
              quantity,
              entryPrice: filledPrice,
              currentPrice: filledPrice,
              openedAt: now,
              stopLoss,
              takeProfit,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
            });
          }
          newBalance -= (filledTotal + filledFee);
        } else {
          // Sell — check if we have a position to sell
          const existingIdx = newPositions.findIndex(p => p.symbol === symbol && p.side === 'long');
          if (existingIdx >= 0) {
            const existing = newPositions[existingIdx];
            const sellQty = Math.min(quantity, existing.quantity);
            const sellTotal = sellQty * filledPrice;
            const sellFee = calculateFee(sellTotal, assetType);
            const pnl = (filledPrice - existing.entryPrice) * sellQty;

            if (sellQty >= existing.quantity) {
              newPositions.splice(existingIdx, 1);
            } else {
              newPositions[existingIdx] = {
                ...existing,
                quantity: existing.quantity - sellQty,
              };
            }
            newBalance += (sellTotal - sellFee);

            // Record trade with P&L
            const tradeRecord: TradeRecord = {
              id: generateId(),
              userId: useAuthStore.getState().user?.id || 'demo',
              symbol,
              assetType,
              side: 'sell',
              type: 'market',
              quantity: sellQty,
              price: filledPrice,
              total: sellTotal,
              fee: sellFee,
              pnl,
              pnlPercent: ((filledPrice - existing.entryPrice) / existing.entryPrice) * 100,
              executedAt: now,
            };
            const newTrades = [tradeRecord, ...state.tradeHistory].slice(0, 500);
            saveTrades(newTrades);
            set({ tradeHistory: newTrades });
          } else {
            // Short sell (open short position)
            newPositions.push({
              id: generateId(),
              symbol,
              name,
              assetType,
              side: 'short',
              quantity,
              entryPrice: filledPrice,
              currentPrice: filledPrice,
              openedAt: now,
              stopLoss,
              takeProfit,
              unrealizedPnL: 0,
              unrealizedPnLPercent: 0,
            });
            newBalance += (filledTotal - filledFee);
          }
        }

        // Record buy trade
        if (side === 'buy') {
          const tradeRecord: TradeRecord = {
            id: generateId(),
            userId: useAuthStore.getState().user?.id || 'demo',
            symbol,
            assetType,
            side: 'buy',
            type: 'market',
            quantity,
            price: filledPrice,
            total: filledTotal,
            fee: filledFee,
            executedAt: now,
          };
          const newTrades = [tradeRecord, ...state.tradeHistory].slice(0, 500);
          saveTrades(newTrades);
          set({ tradeHistory: newTrades });
        }

        const newState = {
          virtualBalance: Math.round(newBalance * 100) / 100,
          positions: newPositions,
        };

        set(newState);
        savePortfolio({ ...state, ...newState });

        // Audit
        useAuthStore.getState().addAuditEntry('TRADE_EXECUTED', `${side.toUpperCase()} ${quantity} ${symbol} @ $${filledPrice.toFixed(2)}`);
        showToast('success', `${side.toUpperCase()} Order Filled`, `${quantity} ${symbol} @ $${filledPrice.toFixed(2)}`);

        return { success: true, order };
      } else {
        // Limit/Stop order — add to pending
        const order: Order = {
          id: orderId,
          symbol,
          assetType,
          type,
          side,
          quantity,
          price,
          status: 'pending',
          createdAt: now,
        };

        const newOrders = [order, ...state.orders];
        set({ orders: newOrders });
        savePortfolio({ ...state, orders: newOrders });

        useAuthStore.getState().addAuditEntry('ORDER_PLACED', `${type.toUpperCase()} ${side.toUpperCase()} ${quantity} ${symbol} @ $${price.toFixed(2)}`);

        return { success: true, order };
      }
    },

    closePosition: (positionId, currentPrice) => {
      const state = get();
      const position = state.positions.find(p => p.id === positionId);
      if (!position) return { success: false };

      const now = new Date().toISOString();
      const filledPrice = applySlippage(currentPrice, position.side === 'long' ? 'sell' : 'buy');
      const total = position.quantity * filledPrice;
      const fee = calculateFee(total, position.assetType);

      let pnl: number;
      if (position.side === 'long') {
        pnl = (filledPrice - position.entryPrice) * position.quantity;
      } else {
        pnl = (position.entryPrice - filledPrice) * position.quantity;
      }
      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

      const trade: TradeRecord = {
        id: generateId(),
        userId: useAuthStore.getState().user?.id || 'demo',
        symbol: position.symbol,
        assetType: position.assetType,
        side: position.side === 'long' ? 'sell' : 'buy',
        type: 'market',
        quantity: position.quantity,
        price: filledPrice,
        total,
        fee,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        executedAt: now,
      };

      const newPositions = state.positions.filter(p => p.id !== positionId);
      const newBalance = position.side === 'long'
        ? state.virtualBalance + total - fee
        : state.virtualBalance - total - fee;
      const newTrades = [trade, ...state.tradeHistory].slice(0, 500);

      saveTrades(newTrades);
      const newState = {
        virtualBalance: Math.round(newBalance * 100) / 100,
        positions: newPositions,
        tradeHistory: newTrades,
      };
      set(newState);
      savePortfolio({ ...state, ...newState });

      useAuthStore.getState().addAuditEntry('TRADE_EXECUTED', `Closed ${position.side} ${position.quantity} ${position.symbol} @ $${filledPrice.toFixed(2)} | P&L: $${pnl.toFixed(2)}`);
      showToast(pnl >= 0 ? 'success' : 'warning', `Position Closed`, `${position.symbol} P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%)`);

      return { success: true, trade };
    },

    cancelOrder: (orderId) => {
      const state = get();
      const newOrders = state.orders.map(o =>
        o.id === orderId ? { ...o, status: 'cancelled' as const } : o
      );
      set({ orders: newOrders });
      savePortfolio({ ...state, orders: newOrders });
      useAuthStore.getState().addAuditEntry('ORDER_CANCELLED', `Order ${orderId.slice(0, 8)} cancelled`);
    },

    updatePositionPrices: (prices) => {
      const state = get();
      let changed = false;
      const newPositions = state.positions.map(pos => {
        const newPrice = prices[pos.symbol.toLowerCase()] || prices[pos.symbol];
        if (newPrice && newPrice !== pos.currentPrice) {
          changed = true;
          const pnl = pos.side === 'long'
            ? (newPrice - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - newPrice) * pos.quantity;
          return {
            ...pos,
            currentPrice: newPrice,
            unrealizedPnL: Math.round(pnl * 100) / 100,
            unrealizedPnLPercent: Math.round((pnl / (pos.entryPrice * pos.quantity)) * 10000) / 100,
          };
        }
        return pos;
      });
      if (changed) {
        set({ positions: newPositions });
        savePortfolio({ ...state, positions: newPositions });
      }
    },

    checkPendingOrders: (prices) => {
      const state = get();
      const pending = state.orders.filter(o => o.status === 'pending');
      if (pending.length === 0) return;

      pending.forEach(order => {
        const currentPrice = prices[order.symbol.toLowerCase()] || prices[order.symbol];
        if (!currentPrice || !order.price) return;

        let shouldFill = false;
        if (order.type === 'limit') {
          if (order.side === 'buy' && currentPrice <= order.price) shouldFill = true;
          if (order.side === 'sell' && currentPrice >= order.price) shouldFill = true;
        } else if (order.type === 'stop') {
          if (order.side === 'buy' && currentPrice >= order.price) shouldFill = true;
          if (order.side === 'sell' && currentPrice <= order.price) shouldFill = true;
        }

        if (shouldFill) {
          // Execute the order
          const result = get().placeOrder({
            symbol: order.symbol,
            name: order.symbol,
            assetType: order.assetType,
            side: order.side,
            type: 'market',
            quantity: order.quantity,
            price: currentPrice,
          });
          // Mark as filled or expired if blocked by guardrails/balance/etc.
          const newOrders = get().orders.map(o => {
            if (o.id !== order.id) return o;
            if (result.success) {
              return { ...o, status: 'filled' as const, filledAt: new Date().toISOString(), filledPrice: currentPrice };
            }
            return {
              ...o,
              status: 'expired' as const,
              statusReason: result.error || 'Order not fillable under current risk constraints',
            };
          });
          set({ orders: newOrders });
          savePortfolio({ ...get(), orders: newOrders });
        }
      });
    },

    resetPortfolio: () => {
      const now = new Date().toISOString();
      const newState = {
        virtualBalance: 100000,
        totalDeposited: 100000,
        positions: [],
        orders: [],
        tradeHistory: [],
        balanceHistory: [{ timestamp: now, totalValue: 100000, cashBalance: 100000 }],
      };
      set(newState);
      savePortfolio(newState);
      saveTrades([]);
      useAuthStore.getState().addAuditEntry('PORTFOLIO_RESET', 'Portfolio reset to $100,000');
    },

    getTotalValue: () => {
      const { virtualBalance, positions } = get();
      const posValue = positions.reduce((sum, pos) => {
        const notional = pos.currentPrice * pos.quantity;
        return sum + (pos.side === 'long' ? notional : -notional);
      }, 0);
      return Math.round((virtualBalance + posValue) * 100) / 100;
    },

    getTotalPnL: () => {
      const state = get();
      const totalValue = get().getTotalValue();
      const amount = totalValue - state.totalDeposited;
      const percent = (amount / state.totalDeposited) * 100;
      return {
        amount: Math.round(amount * 100) / 100,
        percent: Math.round(percent * 100) / 100,
      };
    },

    getInvestedAmount: () => {
      return get().positions.reduce((sum, pos) => sum + pos.entryPrice * pos.quantity, 0);
    },

    snapshotBalance: () => {
      const state = get();
      const totalValue = get().getTotalValue();
      const snapshot: BalanceSnapshot = {
        timestamp: new Date().toISOString(),
        totalValue,
        cashBalance: state.virtualBalance,
      };
      const newHistory = [...state.balanceHistory, snapshot].slice(-365);
      set({ balanceHistory: newHistory });
      savePortfolio({ ...state, balanceHistory: newHistory });
    },
  };
});
