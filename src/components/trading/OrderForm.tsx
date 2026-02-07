import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Info, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isGeminiAvailable } from '@/services/gemini';
import { evaluateOrderRisk, formatGuardrailError } from '@/services/riskGuardrails';
import { isBackendOn } from '@/services/backend/config';
import { apiFetchPortfolio, apiPlaceOrder } from '@/services/backend/tradingApi';
import toast from 'react-hot-toast';
import type { OrderSide, OrderType, AssetType, TradeEvalResult } from '@/types';

interface OrderFormProps {
  symbol: string;
  name: string;
  assetType: AssetType;
  currentPrice: number;
  onTradeComplete?: () => void;
}

export default function OrderForm({ symbol, name, assetType, currentPrice, onTradeComplete }: OrderFormProps) {
  const { virtualBalance, totalDeposited, placeOrder, positions, tradeHistory } = usePortfolioStore();
  const { settings } = useSettingsStore();

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>(settings.trading.defaultOrderType);
  const [amountMode, setAmountMode] = useState<'usd' | 'qty'>('usd');
  const [amountUSD, setAmountUSD] = useState('');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aiEval, setAiEval] = useState<TradeEvalResult | null>(null);
  const [aiEvalLoading, setAiEvalLoading] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const limitPriceInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const riskAcknowledgeRef = useRef<HTMLInputElement>(null);

  const scrollIntoViewOnMobile = (target: EventTarget | null) => {
    if (window.innerWidth >= 768 || !(target instanceof HTMLElement)) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const existingPosition = positions.find(p => p.symbol === symbol);

  // Calculate quantity from USD or vice versa
  const effectivePrice = orderType === 'market' ? currentPrice : (parseFloat(limitPrice) || currentPrice);
  const calcQuantity = amountMode === 'usd'
    ? (parseFloat(amountUSD) || 0) / effectivePrice
    : (parseFloat(quantity) || 0);
  const calcTotal = calcQuantity * effectivePrice;
  const feeRate = assetType === 'crypto' ? 0.001 : 0.0001;
  const fee = calcTotal * feeRate;

  const riskResult = useMemo(() => evaluateOrderRisk({
    symbol,
    side,
    quantity: calcQuantity,
    price: effectivePrice,
    virtualBalance,
    totalDeposited,
    positions,
    tradeHistory,
    settings: settings.trading,
  }), [
    symbol,
    side,
    calcQuantity,
    effectivePrice,
    virtualBalance,
    totalDeposited,
    positions,
    tradeHistory,
    settings.trading,
  ]);

  useEffect(() => {
    setRiskAcknowledged(false);
  }, [symbol, side, orderType, calcQuantity, effectivePrice]);

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 5000];

  useEffect(() => {
    if (settings.trading.defaultStopLossPercent > 0 && !stopLoss) {
      const slPrice = side === 'buy'
        ? currentPrice * (1 - settings.trading.defaultStopLossPercent / 100)
        : currentPrice * (1 + settings.trading.defaultStopLossPercent / 100);
      setStopLoss(slPrice.toFixed(assetType === 'forex' ? 4 : 2));
    }
    if (settings.trading.defaultTakeProfitPercent > 0 && !takeProfit) {
      const tpPrice = side === 'buy'
        ? currentPrice * (1 + settings.trading.defaultTakeProfitPercent / 100)
        : currentPrice * (1 - settings.trading.defaultTakeProfitPercent / 100);
      setTakeProfit(tpPrice.toFixed(assetType === 'forex' ? 4 : 2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (calcQuantity <= 0) {
      amountInputRef.current?.focus();
      return;
    }

    if (orderType !== 'market' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      limitPriceInputRef.current?.focus();
      return;
    }

    if (side === 'buy' && calcTotal + fee > virtualBalance) {
      amountInputRef.current?.focus();
      return;
    }

    if (riskResult.hardBlock) {
      amountInputRef.current?.focus();
      return;
    }

    if (riskResult.warnings.length > 0 && !riskAcknowledged) {
      riskAcknowledgeRef.current?.focus();
      return;
    }

    if (settings.trading.confirmBeforeTrade && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    try {
      if (isBackendOn()) {
        const response = await apiPlaceOrder({
          symbol,
          name,
          assetType,
          side,
          type: orderType,
          quantity: calcQuantity,
          price: effectivePrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        });

        const snapshot = await apiFetchPortfolio();
        usePortfolioStore.setState({
          virtualBalance: snapshot.virtualBalance,
          totalDeposited: snapshot.totalDeposited,
          positions: snapshot.positions as never,
          orders: snapshot.orders as never,
          tradeHistory: snapshot.tradeHistory as never,
          balanceHistory: snapshot.balanceHistory as never,
        });

        const warnings = response.warnings ?? [];
        if (warnings.length > 0) {
          toast((t) => (
            <div className="text-xs">
              <p className="font-semibold mb-1">Risk warning</p>
              <p>{warnings.join(' ')}</p>
              <button className="mt-2 underline" onClick={() => toast.dismiss(t.id)}>Dismiss</button>
            </div>
          ), { duration: 5000 });
        }
      } else {
        const result = placeOrder({
          symbol,
          name,
          assetType,
          side,
          type: orderType,
          quantity: calcQuantity,
          price: effectivePrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        });

        if (!result.success) {
          toast.error(result.error || 'Trade failed');
          return;
        }
      }

      toast.success(
        `${side === 'buy' ? '🟢' : '🔴'} ${side.toUpperCase()} ${calcQuantity.toFixed(assetType === 'crypto' ? 6 : 2)} ${symbol} @ $${effectivePrice.toFixed(2)}`,
        { duration: 4000 }
      );
      setAmountUSD('');
      setQuantity('');
      setShowConfirm(false);
      onTradeComplete?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trade failed');
    }
  };

  const runAiEvaluation = useCallback(async () => {
    setAiEvalLoading(true);
    try {
      const { callGeminiForTradeEval } = await import('@/services/gemini');
      const result = await callGeminiForTradeEval({
        side,
        symbol,
        quantity: calcQuantity,
        price: effectivePrice,
        portfolioValue: virtualBalance,
        assetType,
      });
      setAiEval(result);
    } catch {
      toast.error('AI evaluation unavailable');
    }
    setAiEvalLoading(false);
  }, [side, symbol, calcQuantity, effectivePrice, virtualBalance, assetType]);

  const hardBlockMessage = riskResult.hardBlock ? formatGuardrailError(riskResult.reasonCodes) : null;
  const requiresWarningAcknowledgement = riskResult.warnings.length > 0 && !riskResult.hardBlock;

  const validationError =
    calcQuantity <= 0
      ? 'Enter a valid amount to continue.'
      : orderType !== 'market' && (!limitPrice || parseFloat(limitPrice) <= 0)
      ? `Enter a valid ${orderType === 'limit' ? 'limit' : 'stop'} price.`
      : side === 'buy' && calcTotal + fee > virtualBalance
      ? `Insufficient balance for this order total ($${(calcTotal + fee).toFixed(2)}).`
      : hardBlockMessage
      ? hardBlockMessage
      : null;

  const canTrade = !validationError && (!requiresWarningAcknowledgement || riskAcknowledged);

  return (
    <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
      <div className="px-4 py-3 border-b border-nexus-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-indigo-400" />
          Paper Trade — {symbol}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Buy/Sell Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setSide('buy'); setShowConfirm(false); }}
            className={cn(
              'py-2.5 min-h-11 rounded-lg text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 flex items-center justify-center gap-1.5',
              side === 'buy'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-nexus-elevated text-slate-400 hover:text-slate-200'
            )}
          >
            <TrendingUp className="w-4 h-4" /> BUY
          </button>
          <button
            onClick={() => { setSide('sell'); setShowConfirm(false); }}
            className={cn(
              'py-2.5 min-h-11 rounded-lg text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 flex items-center justify-center gap-1.5',
              side === 'sell'
                ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                : 'bg-nexus-elevated text-slate-400 hover:text-slate-200'
            )}
          >
            <TrendingDown className="w-4 h-4" /> SELL
          </button>
        </div>

        {/* Existing Position Note */}
        {existingPosition && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-indigo-300">
            <Info className="w-3 h-3 inline mr-1" />
            You have a {existingPosition.side} position: {existingPosition.quantity.toFixed(4)} {symbol} @ ${existingPosition.entryPrice.toFixed(2)}
            {existingPosition.unrealizedPnL !== 0 && (
              <span className={cn('ml-1', existingPosition.unrealizedPnL > 0 ? 'text-emerald-400' : 'text-red-400')}>
                ({existingPosition.unrealizedPnL > 0 ? '+' : ''}${existingPosition.unrealizedPnL.toFixed(2)})
              </span>
            )}
          </div>
        )}

        {/* Order Type */}
        <div className="flex gap-1 bg-nexus-elevated rounded-lg p-0.5">
          {(['market', 'limit', 'stop'] as OrderType[]).map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                'flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                orderType === type ? 'bg-nexus-card text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Limit/Stop Price */}
        {orderType !== 'market' && (
          <div>
            <label htmlFor="order-limit-price" className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">
              {orderType === 'limit' ? 'Limit' : 'Stop'} Price
            </label>
            <input
              id="order-limit-price"
              ref={limitPriceInputRef}
              name="limitPrice"
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              onFocus={(e) => scrollIntoViewOnMobile(e.target)}
              placeholder={currentPrice.toFixed(2)}
              step="any"
              inputMode="decimal"
              enterKeyHint="next"
              aria-invalid={!limitPrice || parseFloat(limitPrice) <= 0}
              className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="order-amount" className="text-xs text-slate-500 uppercase tracking-wider">Amount</label>
            <div className="flex gap-1">
              <button
                onClick={() => setAmountMode('usd')}
                className={cn('text-xs px-2 py-0.5 rounded', amountMode === 'usd' ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-500')}
              >
                USD
              </button>
              <button
                onClick={() => setAmountMode('qty')}
                className={cn('text-xs px-2 py-0.5 rounded', amountMode === 'qty' ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-500')}
              >
                QTY
              </button>
            </div>
          </div>
          <input
            id="order-amount"
            ref={amountInputRef}
            name="amount"
            type="number"
            value={amountMode === 'usd' ? amountUSD : quantity}
            onChange={e => amountMode === 'usd' ? setAmountUSD(e.target.value) : setQuantity(e.target.value)}
            onFocus={(e) => scrollIntoViewOnMobile(e.target)}
            placeholder={amountMode === 'usd' ? '1000.00' : `0.00 ${symbol}`}
            step="any"
            min="0"
            inputMode="decimal"
            enterKeyHint={showAdvanced ? 'next' : 'done'}
            aria-invalid={calcQuantity <= 0}
            aria-describedby="order-amount-help"
            className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
          />
          <p id="order-amount-help" className="mt-1 text-xs text-slate-500">
            {amountMode === 'usd' ? 'Enter your position size in USD.' : `Enter units of ${symbol}.`}
          </p>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-1.5">
          {quickAmounts.map(amt => (
            <button
              key={amt}
              onClick={() => { setAmountMode('usd'); setAmountUSD(amt.toString()); }}
              className="flex-1 py-1.5 rounded-md bg-nexus-elevated text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              ${amt >= 1000 ? `${amt / 1000}K` : amt}
            </button>
          ))}
          <button
            onClick={() => { setAmountMode('usd'); setAmountUSD(Math.floor(virtualBalance).toString()); }}
            className="flex-1 py-1.5 rounded-md bg-nexus-elevated text-xs font-medium text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          >
            MAX
          </button>
        </div>

        {/* Advanced: SL/TP */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showAdvanced ? '▼' : '▶'} Stop Loss / Take Profit
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="order-stop-loss" className="text-xs text-slate-500 mb-1 block">Stop Loss</label>
              <input
                id="order-stop-loss"
                name="stopLoss"
                type="number"
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value)}
                onFocus={(e) => scrollIntoViewOnMobile(e.target)}
                placeholder="SL Price"
                step="any"
                inputMode="decimal"
                enterKeyHint="next"
                className="w-full px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label htmlFor="order-take-profit" className="text-xs text-slate-500 mb-1 block">Take Profit</label>
              <input
                id="order-take-profit"
                name="takeProfit"
                type="number"
                value={takeProfit}
                onChange={e => setTakeProfit(e.target.value)}
                onFocus={(e) => scrollIntoViewOnMobile(e.target)}
                placeholder="TP Price"
                step="any"
                inputMode="decimal"
                enterKeyHint="done"
                className="w-full px-3 py-2 rounded-lg bg-nexus-elevated border border-nexus-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 placeholder:text-slate-600"
              />
            </div>
          </div>
        )}

        {/* Order Summary */}
        {calcQuantity > 0 && (
          <div className="bg-nexus-elevated rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Quantity</span>
              <span className="font-mono">{calcQuantity.toFixed(assetType === 'crypto' ? 6 : 2)} {symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price</span>
              <span className="font-mono">${effectivePrice.toFixed(assetType === 'forex' ? 4 : 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-mono">${calcTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fee ({(feeRate * 100).toFixed(2)}%)</span>
              <span className="font-mono">${fee.toFixed(2)}</span>
            </div>
            <div className="border-t border-nexus-border pt-1.5 flex justify-between font-medium">
              <span className="text-slate-300">Total</span>
              <span className="font-mono">${(calcTotal + fee).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Available Balance</span>
          <span className={cn('font-mono', side === 'buy' && calcTotal + fee > virtualBalance ? 'text-red-400' : 'text-slate-300')}>
            ${virtualBalance.toFixed(2)}
          </span>
        </div>

        {/* Confirmation dialog */}
        {showConfirm && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2 animate-fade-in">
            <p className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Confirm Paper Trade
            </p>
            <p className="text-xs text-slate-400">
              {side === 'buy' ? 'Buy' : 'Sell'} {calcQuantity.toFixed(4)} {symbol} at ${effectivePrice.toFixed(2)} for ${calcTotal.toFixed(2)}?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className={cn(
                  'flex-1 py-2 min-h-11 rounded-lg text-sm font-semibold text-white',
                  side === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                )}
              >
                Confirm {side === 'buy' ? 'Buy' : 'Sell'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 min-h-11 rounded-lg text-sm font-medium bg-nexus-elevated text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* AI Pre-Trade Analysis */}
        {isGeminiAvailable() && calcQuantity > 0 && !aiEval && !showConfirm && (
          <button
            onClick={runAiEvaluation}
            disabled={aiEvalLoading}
            className="w-full py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 hover:bg-violet-500/15 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {aiEvalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
            {aiEvalLoading ? 'Evaluating...' : 'Ask AI Before Trading'}
          </button>
        )}

        {/* AI Evaluation Result */}
        {aiEval && (
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-violet-400 flex items-center gap-1">
                <Bot className="w-3 h-3" /> AI Risk Assessment
              </span>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                aiEval.riskRating === 'low' ? 'bg-emerald-500/10 text-emerald-400' :
                aiEval.riskRating === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              )}>
                {aiEval.riskRating} risk
              </span>
            </div>
            <p className="text-xs text-slate-400">Size: {aiEval.positionSizeAssessment.replace('_', ' ')}</p>
            <p className="text-xs text-slate-400">{aiEval.diversificationImpact}</p>
            {aiEval.suggestions.map((s, i) => (
              <p key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                <span className="text-violet-400">•</span> {s}
              </p>
            ))}
            {aiEval.warning && (
              <p className="text-xs text-amber-400 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {aiEval.warning}
              </p>
            )}
            <p className="text-xs text-slate-600">⚠️ AI advisory only. Not financial advice.</p>
          </div>
        )}

        {/* Execute Button */}
        {!showConfirm && (
          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-0 bg-nexus-card/95 backdrop-blur-sm -mx-4 px-4 py-2 border-t border-nexus-border/60 md:mx-0 md:px-0 md:py-0 md:border-none">
            {validationError && (
            <p className="text-xs text-amber-400 mb-2">{validationError}</p>
            )}
            {requiresWarningAcknowledgement && (
              <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                <p className="text-xs text-amber-300 mb-1.5">Risk warning:</p>
                {riskResult.warnings.map((warning, index) => (
                  <p key={index} className="text-xs text-amber-200/90">{warning}</p>
                ))}
                <label htmlFor="risk-acknowledgement" className="mt-2 flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    ref={riskAcknowledgeRef}
                    id="risk-acknowledgement"
                    type="checkbox"
                    checked={riskAcknowledged}
                    onChange={(e) => setRiskAcknowledged(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I understand the risk and want to proceed.</span>
                </label>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canTrade}
              className={cn(
                'w-full min-h-11 py-3 rounded-lg text-sm font-semibold text-white transition-[background-color,box-shadow,opacity,transform] duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
                side === 'buy'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/10'
              )}
            >
              {orderType === 'market' ? 'Execute' : 'Place'} {side === 'buy' ? 'Buy' : 'Sell'} Order
            </button>
          </div>
        )}

        {/* Risk Disclaimer */}
        <p className="text-xs text-slate-600 text-center leading-relaxed">
          ⚠️ Paper trading only. Simulated execution with virtual funds. Not financial advice.
        </p>
      </div>
    </div>
  );
}
