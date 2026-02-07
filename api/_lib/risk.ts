type Position = {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  currentPrice: number;
};

type TradeRecord = {
  executedAt: string;
  pnl?: number;
};

type Settings = {
  enableRiskGuardrails: boolean;
  maxPositionSizePercent: number;
  maxDailyLossPercent: number;
  maxOpenPositions: number;
  warnOnConcentration: boolean;
};

export function evaluateOrderRisk(params: {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  virtualBalance: number;
  totalDeposited: number;
  positions: Position[];
  tradeHistory: TradeRecord[];
  settings: Settings;
}) {
  const { settings } = params;
  const warnings: string[] = [];
  const reasonCodes: string[] = [];

  const totalValue = Math.max(
    params.virtualBalance +
      params.positions.reduce((sum, pos) => {
        const notional = pos.currentPrice * pos.quantity;
        return sum + (pos.side === 'long' ? notional : -notional);
      }, 0),
    1
  );

  const today = new Date().toISOString().slice(0, 10);
  const dailyLoss = params.tradeHistory.reduce((sum, trade) => {
    if (!trade.executedAt.startsWith(today)) return sum;
    const pnl = trade.pnl ?? 0;
    return pnl < 0 ? sum + Math.abs(pnl) : sum;
  }, 0);
  const dailyLossPercent = (dailyLoss / Math.max(params.totalDeposited, 1)) * 100;

  const existingLong = params.positions.find((p) => p.symbol === params.symbol && p.side === 'long');
  const riskIncreasing = params.side === 'buy' || !existingLong || params.quantity > existingLong.quantity;

  const notional = params.quantity * params.price;
  const currentExposure = params.positions.reduce((sum, pos) => sum + pos.currentPrice * pos.quantity, 0);
  const projectedExposure = riskIncreasing ? currentExposure + notional : currentExposure;
  const exposurePercent = (projectedExposure / totalValue) * 100;

  const projectedOpenPositions = params.side === 'buy'
    ? params.positions.some((p) => p.symbol === params.symbol && p.side === 'long')
      ? params.positions.length
      : params.positions.length + 1
    : params.positions.some((p) => p.symbol === params.symbol && p.side === 'long')
      ? params.positions.length
      : params.positions.length + 1;

  let positionSizePercent = 0;
  if (params.side === 'buy') {
    const current = existingLong ? existingLong.currentPrice * existingLong.quantity : 0;
    positionSizePercent = ((current + notional) / totalValue) * 100;
  } else {
    const short = params.positions.find((p) => p.symbol === params.symbol && p.side === 'short');
    const current = short ? short.currentPrice * short.quantity : 0;
    positionSizePercent = ((current + notional) / totalValue) * 100;
  }

  if (settings.enableRiskGuardrails) {
    if (params.quantity <= 0 || params.price <= 0) reasonCodes.push('INVALID_ORDER_INPUT');
    if (riskIncreasing && projectedOpenPositions > settings.maxOpenPositions) reasonCodes.push('MAX_OPEN_POSITIONS_EXCEEDED');
    if (riskIncreasing && positionSizePercent > settings.maxPositionSizePercent) reasonCodes.push('MAX_POSITION_SIZE_EXCEEDED');
    if (riskIncreasing && dailyLossPercent >= settings.maxDailyLossPercent) reasonCodes.push('MAX_DAILY_LOSS_EXCEEDED');

    if (riskIncreasing && settings.warnOnConcentration) {
      if (positionSizePercent >= settings.maxPositionSizePercent * 0.8) {
        warnings.push(`Position concentration is high (${positionSizePercent.toFixed(1)}% of equity).`);
      }
      if (exposurePercent >= 75) {
        warnings.push(`Total exposure is elevated (${exposurePercent.toFixed(1)}% of equity).`);
      }
    }
  }

  return {
    hardBlock: reasonCodes.some((c) =>
      ['INVALID_ORDER_INPUT', 'MAX_OPEN_POSITIONS_EXCEEDED', 'MAX_POSITION_SIZE_EXCEEDED', 'MAX_DAILY_LOSS_EXCEEDED'].includes(c)
    ),
    warnings,
    reasonCodes,
    projectedMetrics: {
      openPositions: projectedOpenPositions,
      dailyLossPercent,
      positionSizePercent,
      exposurePercent,
    },
  };
}

export function formatGuardrailError(reasonCodes: string[]) {
  if (reasonCodes.includes('MAX_DAILY_LOSS_EXCEEDED')) return 'Risk guardrail blocked this order: daily loss limit reached.';
  if (reasonCodes.includes('MAX_POSITION_SIZE_EXCEEDED')) return 'Risk guardrail blocked this order: max position size exceeded.';
  if (reasonCodes.includes('MAX_OPEN_POSITIONS_EXCEEDED')) return 'Risk guardrail blocked this order: max open positions exceeded.';
  if (reasonCodes.includes('INVALID_ORDER_INPUT')) return 'Risk guardrail blocked this order: invalid input.';
  return 'Risk guardrail blocked this order.';
}
