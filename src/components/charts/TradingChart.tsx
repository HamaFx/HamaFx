import { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, SeriesType, CandlestickData, LineData, HistogramData, Time } from 'lightweight-charts';
import type { OHLCV } from '@/types';
import { calculateSMA, calculateEMA, calculateBollingerBands } from '@/services/indicators';
import { cn } from '@/utils/cn';

interface OrderLine {
  price: number;
  label: string;
  color: string;
  lineStyle?: number;
}

interface TradingChartProps {
  data: OHLCV[];
  chartType?: 'candlestick' | 'line' | 'area';
  indicators?: string[];
  height?: number;
  showVolume?: boolean;
  orderLines?: OrderLine[];
  currentPrice?: number;
  symbol?: string;
}

interface CrosshairData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

export default function TradingChart({
  data,
  chartType = 'candlestick',
  indicators = [],
  height = 400,
  showVolume = true,
  orderLines = [],
  currentPrice,
  symbol,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<SeriesType>[]>([]);
  const [crosshairInfo, setCrosshairInfo] = useState<CrosshairData | null>(null);

  const buildChart = useCallback(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRefs.current = [];
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(45, 49, 72, 0.2)' },
        horzLines: { color: 'rgba(45, 49, 72, 0.2)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(45, 49, 72, 0.5)',
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(45, 49, 72, 0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const sortedData = [...data].sort((a, b) => a.time - b.time);

    // Main series
    let mainSeries: ISeriesApi<SeriesType>;

    if (chartType === 'candlestick') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      const candleData: CandlestickData[] = sortedData.map(d => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      series.setData(candleData);
      mainSeries = series;
      seriesRefs.current.push(series);
    } else if (chartType === 'line') {
      const series = chart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
      });
      const lineData: LineData[] = sortedData.map(d => ({
        time: d.time as Time,
        value: d.close,
      }));
      series.setData(lineData);
      mainSeries = series;
      seriesRefs.current.push(series);
    } else {
      const series = chart.addSeries(AreaSeries, {
        topColor: 'rgba(99, 102, 241, 0.3)',
        bottomColor: 'rgba(99, 102, 241, 0.02)',
        lineColor: '#6366f1',
        lineWidth: 2,
      });
      const lineData: LineData[] = sortedData.map(d => ({
        time: d.time as Time,
        value: d.close,
      }));
      series.setData(lineData);
      mainSeries = series;
      seriesRefs.current.push(series);
    }

    // Current price line
    if (currentPrice && mainSeries) {
      mainSeries.createPriceLine({
        price: currentPrice,
        color: '#6366f1',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Current',
      });
    }

    // Order lines (entry, SL, TP)
    if (orderLines.length > 0 && mainSeries) {
      orderLines.forEach(line => {
        mainSeries.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: line.lineStyle ?? 2,
          axisLabelVisible: true,
          title: line.label,
        });
      });
    }

    // Volume
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      const volumeData: HistogramData[] = sortedData.map(d => ({
        time: d.time as Time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
      }));
      volumeSeries.setData(volumeData);
      seriesRefs.current.push(volumeSeries);
    }

    // Indicators
    const closes = sortedData.map(d => d.close);
    const times = sortedData.map(d => d.time as Time);

    function addLineIndicator(values: (number | null)[], color: string, _lineWidth: 1 | 2 | 3 | 4 = 1) {
      const lineData: LineData[] = [];
      values.forEach((v, i) => {
        if (v !== null) lineData.push({ time: times[i], value: v });
      });
      if (lineData.length === 0) return;
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: _lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(lineData);
      seriesRefs.current.push(s);
    }

    if (indicators.includes('SMA20')) {
      addLineIndicator(calculateSMA(closes, 20), '#f59e0b', 1);
    }
    if (indicators.includes('SMA50')) {
      addLineIndicator(calculateSMA(closes, Math.min(50, closes.length)), '#3b82f6', 1);
    }
    if (indicators.includes('EMA20')) {
      addLineIndicator(calculateEMA(closes, 20), '#a855f7', 1);
    }
    if (indicators.includes('BB')) {
      const bb = calculateBollingerBands(closes, 20, 2);
      addLineIndicator(bb.upper, 'rgba(139, 92, 246, 0.5)');
      addLineIndicator(bb.lower, 'rgba(139, 92, 246, 0.5)');
    }

    // Crosshair move handler for data tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.seriesData.size === 0) {
        setCrosshairInfo(null);
        return;
      }

      const timeStr = typeof param.time === 'object'
        ? `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`
        : new Date(Number(param.time) * 1000).toLocaleDateString();

      const matchingCandle = sortedData.find(d => {
        const dTime = d.time as number;
        return dTime === param.time;
      });

      if (matchingCandle) {
        const change = matchingCandle.close - matchingCandle.open;
        const changePercent = (change / matchingCandle.open) * 100;
        setCrosshairInfo({
          time: timeStr,
          open: matchingCandle.open,
          high: matchingCandle.high,
          low: matchingCandle.low,
          close: matchingCandle.close,
          volume: matchingCandle.volume ?? 0,
          change,
          changePercent,
        });
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, chartType, indicators, height, showVolume, currentPrice, orderLines]);

  useEffect(() => {
    const cleanup = buildChart();
    return () => {
      cleanup?.();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  // Double-click to reset zoom
  const handleDoubleClick = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  const formatNum = (n: number) => {
    if (n < 0.01) return n.toFixed(6);
    if (n < 1) return n.toFixed(4);
    if (n > 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  };

  const formatVol = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-nexus-elevated rounded-xl border border-nexus-border"
        style={{ height }}
      >
        <p className="text-sm text-slate-500">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* OHLCV Data Tooltip */}
      <div className={cn(
        'absolute top-1 left-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono transition-opacity duration-150',
        crosshairInfo ? 'opacity-100' : 'opacity-50'
      )}>
        {symbol && (
          <span className="font-semibold text-slate-300 mr-1">{symbol}</span>
        )}
        {crosshairInfo ? (
          <>
            <span className="text-slate-500">{crosshairInfo.time}</span>
            <span className="text-slate-400">O <span className="text-slate-200">{formatNum(crosshairInfo.open)}</span></span>
            <span className="text-slate-400">H <span className="text-emerald-400">{formatNum(crosshairInfo.high)}</span></span>
            <span className="text-slate-400">L <span className="text-red-400">{formatNum(crosshairInfo.low)}</span></span>
            <span className="text-slate-400">C <span className={crosshairInfo.change >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatNum(crosshairInfo.close)}</span></span>
            <span className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              crosshairInfo.change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            )}>
              {crosshairInfo.change >= 0 ? '+' : ''}{crosshairInfo.changePercent.toFixed(2)}%
            </span>
            {crosshairInfo.volume > 0 && (
              <span className="text-slate-400">Vol <span className="text-slate-300">{formatVol(crosshairInfo.volume)}</span></span>
            )}
          </>
        ) : (
          <span className="text-slate-500">Hover chart for details</span>
        )}
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden cursor-crosshair"
        onDoubleClick={handleDoubleClick}
        title="Double-click to reset zoom"
      />

      {/* Chart controls hint */}
      <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-600">
        <span>Scroll to zoom</span>
        <span>•</span>
        <span>Drag to pan</span>
        <span>•</span>
        <span>Double-click to reset</span>
      </div>
    </div>
  );
}
