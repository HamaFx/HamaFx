import type { OrderSide, Position, TradeRecord } from '@/types';

export interface RiskGuardrailSettings {
  enableRiskGuardrails: boolean;
  maxPositionSizePercent: number;
  maxDailyLossPercent: number;
  maxOpenPositions: number;
  warnOnConcentration: boolean;
}

export interface EvaluateOrderRiskParams {
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  tradeHistory: TradeRecord[];
  settings: RiskGuardrailSettings;
}

export interface EvaluateOrderRiskResult {
  hardBlock: boolean;
  warnings: string[];
  reasonCodes: string[];
  projectedMetrics: {
    openPositions: number;
    dailyLossPercent: number;
    positionSizePercent: number;
    exposurePercent: number;
  };
}

function calculateTotalValue(virtualBalance: number, positions: Position[]): number {
  const exposure = positions.reduce((sum, pos) => {
    const notional = pos.currentPrice * pos.quantity;
    return sum + (pos.side === 'long' ? notional : -notional);
  }, 0);
  return Math.max(virtualBalance + exposure, 1);
}

function getTodayLossPercent(tradeHistory: TradeRecord[], totalDeposited: number): number {
  const today = new Date().toISOString().slice(0, 10);
  const losses = tradeHistory.reduce((sum, trade) => {
    if (!trade.executedAt.startsWith(today)) return sum;
    const pnl = trade.pnl ?? 0;
    return pnl < 0 ? sum + Math.abs(pnl) : sum;
  }, 0);
  const base = Math.max(totalDeposited, 1);
  return (losses / base) * 100;
}

function isRiskIncreasingOrder(side: OrderSide, symbol: string, quantity: number, positions: Position[]): boolean {
  if (quantity <= 0) return false;
  if (side === 'buy') return true;
  const longPosition = positions.find((pos) => pos.symbol === symbol && pos.side === 'long');
  if (!longPosition) return true;
  return quantity > longPosition.quantity;
}

function calculateProjectedPositionSizePercent(params: EvaluateOrderRiskParams, totalValue: number): number {
  const { symbol, side, quantity, price, positions } = params;
  const notional = quantity * price;

  if (side === 'buy') {
    const long = positions.find((pos) => pos.symbol === symbol && pos.side === 'long');
    const current = long ? long.currentPrice * long.quantity : 0;
    return ((current + notional) / totalValue) * 100;
  }

  const long = positions.find((pos) => pos.symbol === symbol && pos.side === 'long');
  if (long) {
    const remainingQty = Math.max(long.quantity - quantity, 0);
    const remainingNotional = remainingQty * long.currentPrice;
    return (remainingNotional / totalValue) * 100;
  }

  const short = positions.find((pos) => pos.symbol === symbol && pos.side === 'short');
  const currentShort = short ? short.currentPrice * short.quantity : 0;
  return ((currentShort + notional) / totalValue) * 100;
}

function calculateProjectedExposurePercent(params: EvaluateOrderRiskParams, riskIncreasing: boolean, totalValue: number): number {
  const currentExposure = params.positions.reduce(
    (sum, pos) => sum + pos.currentPrice * pos.quantity,
    0
  );
  const projectedExposure = riskIncreasing
    ? currentExposure + params.quantity * params.price
    : currentExposure;
  return (projectedExposure / totalValue) * 100;
}

function calculateProjectedOpenPositions(params: EvaluateOrderRiskParams): number {
  const { side, symbol, quantity, positions } = params;
  if (quantity <= 0) return positions.length;

  if (side === 'buy') {
    const hasLong = positions.some((pos) => pos.symbol === symbol && pos.side === 'long');
    return hasLong ? positions.length : positions.length + 1;
  }

  const hasLong = positions.some((pos) => pos.symbol === symbol && pos.side === 'long');
  if (hasLong) return positions.length;
  return positions.length + 1;
}

export function evaluateOrderRisk(params: EvaluateOrderRiskParams): EvaluateOrderRiskResult {
  const { settings, quantity, price } = params;
  const warnings: string[] = [];
  const reasonCodes: string[] = [];

  const totalValue = calculateTotalValue(params.virtualBalance, params.positions);
  const riskIncreasing = isRiskIncreasingOrder(params.side, params.symbol, quantity, params.positions);
  const projectedPositionSizePercent = calculateProjectedPositionSizePercent(params, totalValue);
  const projectedExposurePercent = calculateProjectedExposurePercent(params, riskIncreasing, totalValue);
  const projectedOpenPositions = calculateProjectedOpenPositions(params);
  const dailyLossPercent = getTodayLossPercent(params.tradeHistory, params.totalDeposited);

  if (!settings.enableRiskGuardrails) {
    return {
      hardBlock: false,
      warnings,
      reasonCodes,
      projectedMetrics: {
        openPositions: projectedOpenPositions,
        dailyLossPercent,
        positionSizePercent: projectedPositionSizePercent,
        exposurePercent: projectedExposurePercent,
      },
    };
  }

  if (quantity <= 0 || price <= 0) {
    return {
      hardBlock: true,
      warnings,
      reasonCodes: ['INVALID_ORDER_INPUT'],
      projectedMetrics: {
        openPositions: projectedOpenPositions,
        dailyLossPercent,
        positionSizePercent: projectedPositionSizePercent,
        exposurePercent: projectedExposurePercent,
      },
    };
  }

  if (riskIncreasing && projectedOpenPositions > settings.maxOpenPositions) {
    reasonCodes.push('MAX_OPEN_POSITIONS_EXCEEDED');
  }

  if (riskIncreasing && projectedPositionSizePercent > settings.maxPositionSizePercent) {
    reasonCodes.push('MAX_POSITION_SIZE_EXCEEDED');
  }

  if (riskIncreasing && dailyLossPercent >= settings.maxDailyLossPercent) {
    reasonCodes.push('MAX_DAILY_LOSS_EXCEEDED');
  }

  if (riskIncreasing && settings.warnOnConcentration) {
    if (projectedPositionSizePercent >= settings.maxPositionSizePercent * 0.8) {
      warnings.push(
        `Position concentration is high (${projectedPositionSizePercent.toFixed(1)}% of equity).`
      );
      reasonCodes.push('HIGH_POSITION_CONCENTRATION_WARNING');
    }
    if (projectedExposurePercent >= 75) {
      warnings.push(
        `Total exposure is elevated (${projectedExposurePercent.toFixed(1)}% of equity).`
      );
      reasonCodes.push('HIGH_EXPOSURE_WARNING');
    }
  }

  return {
    hardBlock: reasonCodes.some((code) =>
      ['INVALID_ORDER_INPUT', 'MAX_OPEN_POSITIONS_EXCEEDED', 'MAX_POSITION_SIZE_EXCEEDED', 'MAX_DAILY_LOSS_EXCEEDED'].includes(code)
    ),
    warnings,
    reasonCodes,
    projectedMetrics: {
      openPositions: projectedOpenPositions,
      dailyLossPercent,
      positionSizePercent: projectedPositionSizePercent,
      exposurePercent: projectedExposurePercent,
    },
  };
}

export function formatGuardrailError(reasonCodes: string[]): string {
  if (reasonCodes.includes('MAX_DAILY_LOSS_EXCEEDED')) {
    return 'Risk guardrail blocked this order: daily loss limit reached.';
  }
  if (reasonCodes.includes('MAX_POSITION_SIZE_EXCEEDED')) {
    return 'Risk guardrail blocked this order: max position size exceeded.';
  }
  if (reasonCodes.includes('MAX_OPEN_POSITIONS_EXCEEDED')) {
    return 'Risk guardrail blocked this order: max open positions exceeded.';
  }
  if (reasonCodes.includes('INVALID_ORDER_INPUT')) {
    return 'Risk guardrail blocked this order: invalid input.';
  }
  return 'Risk guardrail blocked this order.';
}
