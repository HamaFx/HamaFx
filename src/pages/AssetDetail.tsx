import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, Bot, BarChart3,
  AlertTriangle, RefreshCw, Clock, DollarSign,
  Activity, Layers, Star, Bell, ChevronDown
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore, fetchOHLCVData } from '@/stores/marketStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { buildIndicatorContext, generateRuleBasedSignal } from '@/services/indicators';
import { getMarketAnalysis, isGeminiAvailable } from '@/services/gemini';
import type { OHLCV, AiAnalysisResult, Asset } from '@/types';
import TradingChart from '@/components/charts/TradingChart';
import IndicatorCharts from '@/components/charts/IndicatorCharts';
import OrderForm from '@/components/trading/OrderForm';

type Timeframe = { label: string; days: number };
const TIMEFRAMES: Timeframe[] = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
];

type ChartType = 'candlestick' | 'line' | 'area';

function formatPrice(price: number, assetType: string) {
  if (assetType === 'forex') return price.toFixed(4);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price > 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function formatVolume(vol: number) {
  if (vol <= 0) return '—';
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}T`;
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  return `$${vol.toLocaleString()}`;
}

function formatMarketCap(mc: number) {
  if (mc <= 0) return '—';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  return `$${(mc / 1e6).toFixed(0)}M`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-lg', className)} />;
}

function AiShimmer({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer-ai rounded-lg', className)} />;
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cryptoAssets, forexPairs, fetchCrypto, fetchForex } = useMarketStore();
  const { hasGeminiKey } = useSettingsStore();
  const { isInWatchlist, toggleSymbol } = useWatchlistStore();

  // Find asset
  const cryptoAsset = cryptoAssets.find(a => a.id === id);
  const forexPair = forexPairs.find(p => p.id === id);
  const asset: (Asset & { assetType: string }) | null = useMemo(() => (
    cryptoAsset
      ? { ...cryptoAsset, assetType: 'crypto' }
      : forexPair
      ? {
          id: forexPair.id,
          symbol: forexPair.symbol,
          name: forexPair.name,
          assetType: 'forex',
          price: forexPair.rate,
          change24h: forexPair.change24h,
          changePercent24h: forexPair.changePercent24h,
          high24h: forexPair.rate * 1.002,
          low24h: forexPair.rate * 0.998,
          volume24h: 0,
          lastUpdated: new Date().toISOString(),
        }
      : null
  ), [cryptoAsset, forexPair]);

  const [timeframe, setTimeframe] = useState<Timeframe>(TIMEFRAMES[2]); // 1M default
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [overlayIndicators, setOverlayIndicators] = useState<string[]>(['SMA20']);
  const [subIndicators, setSubIndicators] = useState<string[]>(['RSI']);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      document.title = `${asset.symbol} — HamaFX`;
    }
    if (cryptoAssets.length === 0) fetchCrypto();
    if (forexPairs.length === 0) fetchForex();
  }, [asset, cryptoAssets.length, forexPairs.length, fetchCrypto, fetchForex]);

  // Fetch OHLCV when timeframe or asset changes
  useEffect(() => {
    if (!id || !asset) return;
    setLoadingChart(true);
    fetchOHLCVData(id, asset.assetType as 'crypto' | 'forex', timeframe.days)
      .then(data => {
        setOhlcv(data);
        setLoadingChart(false);
      })
      .catch(() => setLoadingChart(false));
  }, [id, asset, timeframe.days]);

  // Run AI analysis
  const runAnalysis = useCallback(async () => {
    if (!asset || !id) return;
    setAiLoading(true);
    setAiError(null);

    try {
      if (isGeminiAvailable() && ohlcv.length > 20) {
        const context = buildIndicatorContext(ohlcv);
        const result = await getMarketAnalysis(asset.name, asset.symbol, {
          ...context,
          asset: `${asset.symbol}`,
          change24h: `${asset.changePercent24h >= 0 ? '+' : ''}${asset.changePercent24h.toFixed(2)}%`,
          high24h: asset.high24h,
          low24h: asset.low24h,
          volume24h: formatVolume(asset.volume24h),
        });
        setAiAnalysis(result);
      } else {
        // Rule-based fallback
        const signal = generateRuleBasedSignal(ohlcv);
        const indicatorCtx = buildIndicatorContext(ohlcv);
        setAiAnalysis({
          ...signal,
          supportLevel: (indicatorCtx.support as number) || undefined,
          resistanceLevel: (indicatorCtx.resistance as number) || undefined,
          suggestedStopLoss: asset.price * (signal.signal === 'BUY' ? 0.95 : 1.05),
          suggestedTakeProfit: asset.price * (signal.signal === 'BUY' ? 1.1 : 0.9),
          timeHorizon: 'short-term',
          summary: `${signal.signal} signal based on technical indicator confluence analysis.`,
          source: 'rule-based',
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      if (message === 'INVALID_KEY') {
        setAiError('Invalid Gemini API key. Please update in Settings.');
      } else if (message === 'RATE_LIMITED') {
        setAiError('Rate limited. Please wait a moment and try again.');
      } else {
        setAiError(message);
      }
      // Fall back to rule-based on error
      if (ohlcv.length > 20) {
        const signal = generateRuleBasedSignal(ohlcv);
        setAiAnalysis({
          ...signal,
          timeHorizon: 'short-term',
          summary: `${signal.signal} signal (fallback: AI unavailable).`,
          source: 'rule-based',
          generatedAt: new Date().toISOString(),
        });
      }
    }
    setAiLoading(false);
  }, [asset, id, ohlcv]);

  // Auto-run analysis when data loads
  useEffect(() => {
    if (ohlcv.length > 10 && !aiAnalysis && !aiLoading) {
      runAnalysis();
    }
  }, [ohlcv.length, aiAnalysis, aiLoading, runAnalysis]);

  const toggleOverlay = (ind: string) => {
    setOverlayIndicators(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  };

  const toggleSub = (ind: string) => {
    setSubIndicators(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  };

  if (!asset) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading asset data...</p>
          <div className="mt-4 space-y-3 max-w-md mx-auto">
            <Shimmer className="h-10 w-full" />
            <Shimmer className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const isPositive = asset.changePercent24h >= 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => asset && toggleSymbol(asset.symbol, asset.assetType as 'crypto' | 'forex')}
            className={cn(
              'p-2 rounded-lg hover:bg-white/5 transition-colors',
              asset && isInWatchlist(asset.symbol) ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'
            )}
            title={asset && isInWatchlist(asset.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            <Star className={cn('w-4 h-4', asset && isInWatchlist(asset.symbol) && 'fill-current')} />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-blue-400" title="Set Alert">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Price Header */}
      <div className="bg-nexus-card rounded-xl border border-nexus-border p-5">
        <div className="flex items-center gap-4 mb-3">
          {'image' in asset && asset.image ? (
            <img src={asset.image} alt={asset.symbol} className="w-12 h-12 rounded-full" />
          ) : (
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
              asset.assetType === 'crypto' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
            )}>
              {asset.symbol.substring(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{asset.symbol}</h1>
            <p className="text-sm text-slate-400">{asset.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl md:text-3xl font-bold font-mono">${formatPrice(asset.price, asset.assetType)}</p>
            <p className={cn(
              'text-sm font-mono flex items-center gap-1 justify-end',
              isPositive ? 'text-emerald-400' : 'text-red-400'
            )}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
              <span className="text-slate-500 ml-1">
                ({isPositive ? '+' : ''}${Math.abs(asset.change24h).toFixed(2)})
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '24h High', value: `$${formatPrice(asset.high24h, asset.assetType)}`, icon: TrendingUp },
            { label: '24h Low', value: `$${formatPrice(asset.low24h, asset.assetType)}`, icon: TrendingDown },
            { label: 'Volume', value: formatVolume(asset.volume24h), icon: BarChart3 },
            { label: 'Market Cap', value: 'marketCap' in asset ? formatMarketCap((asset as Asset).marketCap || 0) : '—', icon: DollarSign },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-nexus-elevated rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] text-slate-500 uppercase">{label}</span>
              </div>
              <span className="text-sm font-semibold font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Chart + Indicators */}
        <div className="lg:col-span-2 space-y-3">
          {/* Chart Controls */}
          <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-nexus-border">
              {/* Timeframes */}
              <div className="flex items-center gap-1">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf.label}
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      timeframe.label === tf.label
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Chart type + indicator toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-nexus-elevated rounded-md p-0.5">
                  {(['candlestick', 'line', 'area'] as ChartType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-medium capitalize',
                        chartType === type ? 'bg-nexus-card text-white' : 'text-slate-500'
                      )}
                    >
                      {type === 'candlestick' ? '🕯️' : type === 'line' ? '📈' : '📊'}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 bg-nexus-elevated"
                  >
                    <Layers className="w-3 h-3" /> Indicators <ChevronDown className="w-3 h-3" />
                  </button>
                  {showIndicatorMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowIndicatorMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 bg-nexus-card border border-nexus-border rounded-lg shadow-xl p-3 min-w-[180px] animate-fade-in">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Overlays</p>
                        {['SMA20', 'SMA50', 'EMA20', 'BB'].map(ind => (
                          <label key={ind} className="flex items-center gap-2 py-1 text-sm text-slate-300 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={overlayIndicators.includes(ind)}
                              onChange={() => toggleOverlay(ind)}
                              className="rounded border-slate-600 bg-nexus-elevated text-indigo-500 focus:ring-indigo-500"
                            />
                            {ind === 'BB' ? 'Bollinger Bands' : ind}
                          </label>
                        ))}
                        <div className="border-t border-nexus-border my-2" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sub Charts</p>
                        {['RSI', 'MACD', 'STOCH'].map(ind => (
                          <label key={ind} className="flex items-center gap-2 py-1 text-sm text-slate-300 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={subIndicators.includes(ind)}
                              onChange={() => toggleSub(ind)}
                              className="rounded border-slate-600 bg-nexus-elevated text-indigo-500 focus:ring-indigo-500"
                            />
                            {ind === 'STOCH' ? 'Stochastic' : ind}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="p-2">
              {loadingChart ? (
                <Shimmer className="w-full h-[400px]" />
              ) : (
                <TradingChart
                  data={ohlcv}
                  chartType={chartType}
                  indicators={overlayIndicators}
                  height={Math.min(400, window.innerWidth < 768 ? 300 : 400)}
                  showVolume={true}
                />
              )}
            </div>
          </div>

          {/* Sub-chart indicators (RSI, MACD, Stochastic) */}
          <IndicatorCharts data={ohlcv} activeIndicators={subIndicators} />
        </div>

        {/* Right: AI Analysis + Info */}
        <div className="space-y-4">
          {/* AI Analysis Card */}
          <div className="bg-nexus-card rounded-xl border border-nexus-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                {aiAnalysis?.source === 'gemini' ? (
                  <Bot className="w-4 h-4 text-violet-400" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                )}
                Analysis
              </h2>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  aiAnalysis?.source === 'gemini'
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'bg-blue-500/10 text-blue-400'
                )}>
                  {aiAnalysis?.source === 'gemini' ? '🤖 AI' : '📊 Algorithm'}
                </span>
                <button
                  onClick={runAnalysis}
                  disabled={aiLoading}
                  className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300"
                  title="Refresh analysis"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', aiLoading && 'animate-spin')} />
                </button>
              </div>
            </div>

            <div className="p-4">
              {aiLoading && !aiAnalysis ? (
                <div className="space-y-3">
                  <AiShimmer className="h-12 w-full" />
                  <AiShimmer className="h-4 w-3/4" />
                  <AiShimmer className="h-4 w-full" />
                  <AiShimmer className="h-4 w-2/3" />
                  <p className="text-xs text-violet-400 animate-pulse mt-2">
                    {isGeminiAvailable() ? '🤖 Gemini is analyzing...' : '📊 Computing indicators...'}
                  </p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  {/* Signal */}
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-bold',
                      aiAnalysis.signal === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' :
                      aiAnalysis.signal === 'SELL' ? 'bg-red-500/15 text-red-400' :
                      'bg-amber-500/15 text-amber-400'
                    )}>
                      {aiAnalysis.signal === 'BUY' ? '🟢' : aiAnalysis.signal === 'SELL' ? '🔴' : '🟡'} {aiAnalysis.signal}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono">{aiAnalysis.confidence.toFixed(0)}%</p>
                      <p className="text-[10px] text-slate-500">confidence</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="w-full bg-nexus-elevated rounded-full h-1.5">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        aiAnalysis.signal === 'BUY' ? 'bg-emerald-500' :
                        aiAnalysis.signal === 'SELL' ? 'bg-red-500' :
                        'bg-amber-500'
                      )}
                      style={{ width: `${aiAnalysis.confidence}%` }}
                    />
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-300 leading-relaxed">{aiAnalysis.summary}</p>

                  {/* Reasoning */}
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-2">Analysis</p>
                    <ul className="space-y-1.5">
                      {aiAnalysis.reasoning.map((r, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Factors */}
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-2">Risk Factors</p>
                    <ul className="space-y-1.5">
                      {aiAnalysis.riskFactors.map((r, i) => (
                        <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Levels */}
                  {(aiAnalysis.supportLevel || aiAnalysis.resistanceLevel) && (
                    <div className="grid grid-cols-2 gap-2">
                      {aiAnalysis.supportLevel && (
                        <div className="bg-nexus-elevated rounded-lg p-2.5">
                          <p className="text-[10px] text-slate-500">Support</p>
                          <p className="text-sm font-mono text-emerald-400">${formatPrice(aiAnalysis.supportLevel, asset.assetType)}</p>
                        </div>
                      )}
                      {aiAnalysis.resistanceLevel && (
                        <div className="bg-nexus-elevated rounded-lg p-2.5">
                          <p className="text-[10px] text-slate-500">Resistance</p>
                          <p className="text-sm font-mono text-red-400">${formatPrice(aiAnalysis.resistanceLevel, asset.assetType)}</p>
                        </div>
                      )}
                      {aiAnalysis.suggestedStopLoss && (
                        <div className="bg-nexus-elevated rounded-lg p-2.5">
                          <p className="text-[10px] text-slate-500">Stop Loss</p>
                          <p className="text-sm font-mono text-red-400">${formatPrice(aiAnalysis.suggestedStopLoss, asset.assetType)}</p>
                        </div>
                      )}
                      {aiAnalysis.suggestedTakeProfit && (
                        <div className="bg-nexus-elevated rounded-lg p-2.5">
                          <p className="text-[10px] text-slate-500">Take Profit</p>
                          <p className="text-sm font-mono text-emerald-400">${formatPrice(aiAnalysis.suggestedTakeProfit, asset.assetType)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Time horizon */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    Horizon: <span className="text-slate-300 capitalize">{aiAnalysis.timeHorizon}</span>
                  </div>

                  {/* AI disclaimer */}
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
                    <p className="text-[10px] text-amber-400/70 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      {aiAnalysis.source === 'gemini'
                        ? 'AI-generated analysis (Gemini). Not financial advice. Past performance ≠ future results.'
                        : 'Algorithm-based analysis. Not financial advice. Add Gemini API key for AI-powered insights.'}
                    </p>
                  </div>

                  {/* AI Error */}
                  {aiError && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
                      <p className="text-[10px] text-red-400">{aiError}</p>
                    </div>
                  )}

                  {/* Updated time */}
                  <p className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Updated {new Date(aiAnalysis.generatedAt).toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Analysis will appear when chart data loads</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Setup Prompt */}
          {!hasGeminiKey() && (
            <button
              onClick={() => navigate('/settings')}
              className="w-full bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center gap-3 hover:bg-violet-500/15 transition-colors text-left"
            >
              <Bot className="w-8 h-8 text-violet-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-violet-300">Upgrade to AI Analysis</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Add your free Gemini API key for LLM-powered insights</p>
              </div>
            </button>
          )}

          {/* Paper Trading Form */}
          <OrderForm
            symbol={asset.symbol}
            name={asset.name}
            assetType={asset.assetType as 'crypto' | 'forex'}
            currentPrice={asset.price}
          />

          {/* Risk Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Paper trading only. Signals are for educational purposes. Not financial advice. Past performance does not guarantee future results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
