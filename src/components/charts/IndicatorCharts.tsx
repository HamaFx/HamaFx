import type { OHLCV } from '@/types';
import { calculateRSI, calculateMACD, calculateStochastic } from '@/services/indicators';
import { cn } from '@/utils/cn';

interface IndicatorChartsProps {
  data: OHLCV[];
  activeIndicators: string[];
}

function MiniBarChart({ values, colors, height = 60 }: { values: (number | null)[]; colors: { positive: string; negative: string }; height?: number }) {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length < 5) return null;
  const recent = validValues.slice(-40);
  const max = Math.max(...recent.map(Math.abs));
  const width = 100;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full">
      {recent.map((v, i) => {
        const barH = max === 0 ? 0 : (Math.abs(v) / max) * (height / 2 - 2);
        const y = v >= 0 ? height / 2 - barH : height / 2;
        return (
          <rect
            key={i}
            x={(i / recent.length) * width}
            y={y}
            width={Math.max(1, width / recent.length - 0.5)}
            height={barH}
            fill={v >= 0 ? colors.positive : colors.negative}
            opacity={0.8}
          />
        );
      })}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#2d3148" strokeWidth={0.5} />
    </svg>
  );
}

function MiniLineChart({ values, color, zones, height = 60 }: {
  values: (number | null)[];
  color: string;
  zones?: { value: number; color: string }[];
  height?: number;
}) {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length < 5) return null;
  const recent = validValues.slice(-40);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const width = 100;

  const pathData = recent
    .map((v, i) => {
      const x = (i / (recent.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full">
      {zones?.map((z, i) => {
        const y = height - ((z.value - min) / range) * (height - 4) - 2;
        return (
          <line key={i} x1={0} y1={y} x2={width} y2={y} stroke={z.color} strokeWidth={0.5} strokeDasharray="2,2" />
        );
      })}
      <path d={pathData} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export default function IndicatorCharts({ data, activeIndicators }: IndicatorChartsProps) {
  if (data.length < 20) return null;

  const closes = data.map(c => c.close);
  const showRSI = activeIndicators.includes('RSI');
  const showMACD = activeIndicators.includes('MACD');
  const showStoch = activeIndicators.includes('STOCH');

  if (!showRSI && !showMACD && !showStoch) return null;

  const rsi = showRSI ? calculateRSI(closes, 14) : null;
  const macd = showMACD ? calculateMACD(closes) : null;
  const stoch = showStoch ? calculateStochastic(data) : null;

  const lastRSI = rsi?.values.filter(v => v !== null).pop();
  const lastMACD = macd?.macd.filter(v => v !== null).pop();
  const lastSignal = macd?.signal.filter(v => v !== null).pop();
  const lastStochK = stoch?.k.filter(v => v !== null).pop();
  const lastStochD = stoch?.d.filter(v => v !== null).pop();

  return (
    <div className="space-y-3 mt-3">
      {/* RSI */}
      {showRSI && rsi && (
        <div className="bg-nexus-elevated rounded-lg p-3 border border-nexus-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">RSI (14)</span>
            <span className={cn(
              'text-xs font-mono font-medium',
              lastRSI && lastRSI > 70 ? 'text-red-400' :
              lastRSI && lastRSI < 30 ? 'text-emerald-400' :
              'text-slate-300'
            )}>
              {lastRSI?.toFixed(1) ?? '—'}
              {lastRSI && lastRSI > 70 && ' (Overbought)'}
              {lastRSI && lastRSI < 30 && ' (Oversold)'}
            </span>
          </div>
          <MiniLineChart
            values={rsi.values}
            color="#f59e0b"
            zones={[
              { value: 70, color: 'rgba(239, 68, 68, 0.4)' },
              { value: 30, color: 'rgba(16, 185, 129, 0.4)' },
              { value: 50, color: 'rgba(100, 116, 139, 0.3)' },
            ]}
          />
        </div>
      )}

      {/* MACD */}
      {showMACD && macd && (
        <div className="bg-nexus-elevated rounded-lg p-3 border border-nexus-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">MACD (12,26,9)</span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className={cn(
                lastMACD && lastMACD > 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                M: {lastMACD?.toFixed(2) ?? '—'}
              </span>
              <span className="text-slate-400">S: {lastSignal?.toFixed(2) ?? '—'}</span>
            </div>
          </div>
          <MiniBarChart
            values={macd.histogram}
            colors={{ positive: '#10b981', negative: '#ef4444' }}
          />
        </div>
      )}

      {/* Stochastic */}
      {showStoch && stoch && (
        <div className="bg-nexus-elevated rounded-lg p-3 border border-nexus-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Stochastic (14,3)</span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-blue-400">%K: {lastStochK?.toFixed(1) ?? '—'}</span>
              <span className="text-amber-400">%D: {lastStochD?.toFixed(1) ?? '—'}</span>
            </div>
          </div>
          <MiniLineChart
            values={stoch.k}
            color="#3b82f6"
            zones={[
              { value: 80, color: 'rgba(239, 68, 68, 0.4)' },
              { value: 20, color: 'rgba(16, 185, 129, 0.4)' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
