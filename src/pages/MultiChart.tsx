import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, LineData, Time } from 'lightweight-charts';
import { useMarketStore, fetchOHLCVData } from '@/stores/marketStore';
import { Columns2, Grid2X2, Square, Settings2, X } from 'lucide-react';
import { cn } from '@/utils/cn';

type LayoutMode = '1x1' | '1x2' | '2x2';
type ChartType = 'candlestick' | 'line' | 'area';
type Timeframe = '1' | '7' | '30' | '90' | '365';
type ChartSeries = ISeriesApi<'Candlestick' | 'Line' | 'Area', Time>;

interface PanelConfig {
  id: string;
  assetId: string;
  assetName: string;
  timeframe: Timeframe;
  chartType: ChartType;
}

const CRYPTO_OPTIONS = [
  { id: 'bitcoin', name: 'Bitcoin (BTC)' },
  { id: 'ethereum', name: 'Ethereum (ETH)' },
  { id: 'solana', name: 'Solana (SOL)' },
  { id: 'cardano', name: 'Cardano (ADA)' },
  { id: 'dogecoin', name: 'Dogecoin (DOGE)' },
  { id: 'polkadot', name: 'Polkadot (DOT)' },
  { id: 'ripple', name: 'XRP' },
  { id: 'avalanche-2', name: 'Avalanche (AVAX)' },
  { id: 'chainlink', name: 'Chainlink (LINK)' },
  { id: 'polygon', name: 'Polygon (MATIC)' },
];

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1', label: '1D' },
  { value: '7', label: '7D' },
  { value: '30', label: '1M' },
  { value: '90', label: '3M' },
  { value: '365', label: '1Y' },
];

const defaultPanels: PanelConfig[] = [
  { id: 'p1', assetId: 'bitcoin', assetName: 'Bitcoin (BTC)', timeframe: '30', chartType: 'candlestick' },
  { id: 'p2', assetId: 'ethereum', assetName: 'Ethereum (ETH)', timeframe: '30', chartType: 'candlestick' },
  { id: 'p3', assetId: 'solana', assetName: 'Solana (SOL)', timeframe: '30', chartType: 'line' },
  { id: 'p4', assetId: 'cardano', assetName: 'Cardano (ADA)', timeframe: '30', chartType: 'area' },
];

// ── Single Chart Panel ──────────────────────────────────────────
function ChartPanel({
  config,
  onUpdate,
  compact,
}: {
  config: PanelConfig;
  onUpdate: (config: PanelConfig) => void;
  compact: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const days = parseInt(config.timeframe);
      const ohlcv = await fetchOHLCVData(config.assetId, 'crypto', days);
      if (!ohlcv || ohlcv.length === 0) throw new Error('No data');

      if (chartRef.current && containerRef.current) {
        // Clear old series
        if (seriesRef.current) {
          chartRef.current.removeSeries(seriesRef.current);
          seriesRef.current = null;
        }

        if (config.chartType === 'candlestick') {
          const candleData: CandlestickData<Time>[] = ohlcv.map((d) => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }));

          const series = chartRef.current.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
          });
          series.setData(candleData);
          seriesRef.current = series;

          const last = candleData[candleData.length - 1];
          const first = candleData[0];
          if (last && first && first.open > 0) {
            setCurrentPrice(last.close);
            setPriceChange(((last.close - first.open) / first.open) * 100);
          }
        } else {
          const lineData: LineData<Time>[] = ohlcv.map((d) => ({
            time: d.time as Time,
            value: d.close,
          }));

          if (config.chartType === 'area') {
            const series = chartRef.current.addSeries(AreaSeries, {
              lineColor: '#8b5cf6',
              topColor: 'rgba(139,92,246,0.3)',
              bottomColor: 'rgba(139,92,246,0.01)',
              lineWidth: 2,
            });
            series.setData(lineData);
            seriesRef.current = series;
          } else {
            const series = chartRef.current.addSeries(LineSeries, {
              color: '#3b82f6',
              lineWidth: 2,
            });
            series.setData(lineData);
            seriesRef.current = series;
          }

          const last = lineData[lineData.length - 1];
          const first = lineData[0];
          if (last && first && first.value > 0) {
            setCurrentPrice(last.value);
            setPriceChange(((last.value - first.value) / first.value) * 100);
          }
        }

        chartRef.current.timeScale().fitContent();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [config.assetId, config.timeframe, config.chartType]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: compact ? 9 : 11,
      },
      grid: {
        vertLines: { color: 'rgba(75,85,99,0.2)' },
        horzLines: { color: 'rgba(75,85,99,0.2)' },
      },
      timeScale: {
        borderColor: 'rgba(75,85,99,0.3)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(75,85,99,0.3)',
      },
      crosshair: {
        vertLine: { color: 'rgba(139,92,246,0.5)', labelBackgroundColor: '#8b5cf6' },
        horzLine: { color: 'rgba(139,92,246,0.5)', labelBackgroundColor: '#8b5cf6' },
      },
    });

    chartRef.current = chart;

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [compact]);

  // Fetch data when config changes
  useEffect(() => {
    if (chartRef.current) {
      fetchData();
    }
  }, [fetchData]);

  return (
    <div className="relative bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-white truncate">{config.assetName}</span>
          {currentPrice !== null && (
            <span className="text-xs text-gray-400">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          )}
          {priceChange !== null && (
            <span className={cn('text-xs font-medium', priceChange >= 0 ? 'text-green-400' : 'text-red-400')}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Timeframe buttons */}
          {!compact && TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => onUpdate({ ...config, timeframe: tf.value })}
              className={cn(
                'px-1.5 py-0.5 text-[10px] rounded transition-colors',
                config.timeframe === tf.value ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {tf.label}
            </button>
          ))}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300"
          >
            {showSettings ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="absolute top-10 right-2 z-20 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl min-w-[200px] space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Asset</label>
            <select
              value={config.assetId}
              onChange={(e) => {
                const opt = CRYPTO_OPTIONS.find(o => o.id === e.target.value);
                onUpdate({ ...config, assetId: e.target.value, assetName: opt?.name || e.target.value });
                setShowSettings(false);
              }}
              className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              {CRYPTO_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Chart Type</label>
            <div className="flex gap-1 mt-1">
              {(['candlestick', 'line', 'area'] as ChartType[]).map(ct => (
                <button
                  key={ct}
                  onClick={() => { onUpdate({ ...config, chartType: ct }); setShowSettings(false); }}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-lg capitalize transition-colors',
                    config.chartType === ct ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                  )}
                >
                  {ct === 'candlestick' ? '🕯️' : ct === 'line' ? '📈' : '📊'} {ct.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>
          {compact && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Timeframe</label>
              <div className="flex gap-1 mt-1">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf.value}
                    onClick={() => { onUpdate({ ...config, timeframe: tf.value }); setShowSettings(false); }}
                    className={cn(
                      'flex-1 px-1 py-1 text-xs rounded-lg transition-colors',
                      config.timeframe === tf.value ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80 z-10">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80 z-10">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <button onClick={fetchData} className="px-3 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
              Retry
            </button>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MultiChart() {
  const [layout, setLayout] = useState<LayoutMode>('2x2');
  const [panels, setPanels] = useState<PanelConfig[]>(defaultPanels);
  const { cryptoAssets } = useMarketStore();

  // On small screens, force single layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveLayout = isMobile ? '1x1' : layout;

  const updatePanel = (index: number, config: PanelConfig) => {
    setPanels(prev => {
      const next = [...prev];
      next[index] = config;
      return next;
    });
  };

  const visiblePanels = effectiveLayout === '1x1' ? 1 : effectiveLayout === '1x2' ? 2 : 4;

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex flex-col p-3 md:p-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            📊 Trading Terminal
          </h1>
          <p className="text-xs text-gray-500 hidden sm:block">Multi-chart workspace — compare assets side by side</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live price ticker */}
          {cryptoAssets.slice(0, 3).map(a => (
            <div key={a.id} className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <span className="text-xs text-gray-400">{a.symbol.toUpperCase()}</span>
              <span className="text-xs font-medium text-white">${a.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className={cn('text-[10px]', a.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                {a.changePercent24h >= 0 ? '+' : ''}{a.changePercent24h.toFixed(1)}%
              </span>
            </div>
          ))}

          {/* Layout Selector */}
          <div className="flex items-center bg-gray-800/50 border border-gray-700/50 rounded-lg p-0.5">
            <button
              onClick={() => setLayout('1x1')}
              className={cn('p-1.5 rounded transition-colors', layout === '1x1' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300')}
              title="Single chart"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('1x2')}
              className={cn('p-1.5 rounded transition-colors', layout === '1x2' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300')}
              title="Two charts"
            >
              <Columns2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('2x2')}
              className={cn('p-1.5 rounded transition-colors', layout === '2x2' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300')}
              title="Four charts"
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Grid */}
      <div className={cn(
        'flex-1 min-h-0 gap-2',
        effectiveLayout === '1x1' && 'grid grid-cols-1 grid-rows-1',
        effectiveLayout === '1x2' && 'grid grid-cols-2 grid-rows-1',
        effectiveLayout === '2x2' && 'grid grid-cols-2 grid-rows-2',
      )}>
        {panels.slice(0, visiblePanels).map((panel, i) => (
          <ChartPanel
            key={panel.id + panel.assetId + panel.chartType + panel.timeframe}
            config={panel}
            onUpdate={(c) => updatePanel(i, c)}
            compact={effectiveLayout === '2x2'}
          />
        ))}
      </div>
    </div>
  );
}
