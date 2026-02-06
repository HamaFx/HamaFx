import { useEffect, useState } from 'react';
import {
  Bell, Plus, Trash2, X, AlertTriangle,
  TrendingUp, TrendingDown, Percent, CheckCircle2,
  Clock, ToggleLeft, ToggleRight, BellOff, Volume2
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAlertStore } from '@/stores/alertStore';
import { useMarketStore } from '@/stores/marketStore';
import type { AssetType } from '@/types';
import toast from 'react-hot-toast';

type AlertTypeOption = 'price_above' | 'price_below' | 'percent_change';

export default function AlertsPage() {
  const { alerts, createAlert, deleteAlert, toggleAlert, clearTriggered, checkAlerts } = useAlertStore();
  const { cryptoAssets, forexPairs } = useMarketStore();
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('BTC');
  const [assetType, setAssetType] = useState<AssetType>('crypto');
  const [alertType, setAlertType] = useState<AlertTypeOption>('price_above');
  const [targetValue, setTargetValue] = useState('');
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all');

  const scrollIntoViewOnMobile = (target: EventTarget | null) => {
    if (window.innerWidth >= 768 || !(target instanceof HTMLElement)) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  useEffect(() => {
    document.title = 'Alerts — NexusTrade';
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check alerts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const prices: Record<string, number> = {};
      cryptoAssets.forEach(a => { prices[a.symbol] = a.price; prices[a.id] = a.price; });
      forexPairs.forEach(p => { prices[p.symbol] = p.rate; prices[p.id] = p.rate; });
      if (Object.keys(prices).length > 0) checkAlerts(prices);
    }, 5000);
    return () => clearInterval(interval);
  }, [cryptoAssets, forexPairs, checkAlerts]);

  const handleCreate = () => {
    if (!targetValue || parseFloat(targetValue) <= 0) {
      setFormError('Target value must be greater than 0.');
      toast.error('Please enter a valid target value');
      return;
    }
    setFormError('');
    const currentAsset = cryptoAssets.find(a => a.symbol === symbol) || forexPairs.find(p => p.symbol === symbol);
    const currentPrice = currentAsset ? ('price' in currentAsset ? currentAsset.price : currentAsset.rate) : undefined;

    createAlert({
      symbol,
      assetType,
      type: alertType,
      targetValue: parseFloat(targetValue),
      currentValue: currentPrice,
    });
    toast.success(`Alert created for ${symbol}`);
    setShowForm(false);
    setTargetValue('');
  };

  const activeAlerts = alerts.filter(a => a.isActive && !a.isTriggered);
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const filtered = filter === 'active' ? activeAlerts :
                   filter === 'triggered' ? triggeredAlerts :
                   alerts;

  const allSymbols = [
    ...cryptoAssets.map(a => ({ symbol: a.symbol, type: 'crypto' as AssetType, price: a.price })),
    ...forexPairs.map(p => ({ symbol: p.symbol, type: 'forex' as AssetType, price: p.rate })),
  ];

  const notifPermission = 'Notification' in window ? Notification.permission : 'denied';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold">Alerts</h1>
            <p className="text-xs text-slate-500">
              {activeAlerts.length} active · {triggeredAlerts.length} triggered
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {/* Notification Status */}
      <div className={cn(
        'rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs',
        notifPermission === 'granted' ? 'bg-emerald-500/10 text-emerald-400' :
        'bg-amber-500/10 text-amber-400'
      )}>
        {notifPermission === 'granted' ? (
          <><Volume2 className="w-3.5 h-3.5" /> Browser notifications enabled</>
        ) : (
          <>
            <BellOff className="w-3.5 h-3.5" /> Browser notifications {notifPermission === 'denied' ? 'blocked' : 'not enabled'}
            {notifPermission === 'default' && (
              <button
                onClick={() => Notification.requestPermission()}
                className="ml-auto text-amber-300 underline"
              >
                Enable
              </button>
            )}
          </>
        )}
      </div>

      {/* Create Alert Form */}
      {showForm && (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-5 animate-slide-up space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Create Alert</h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/5 rounded">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Asset Selection */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Asset</label>
            <select
              value={symbol}
              onChange={e => {
                setSymbol(e.target.value);
                const found = allSymbols.find(s => s.symbol === e.target.value);
                if (found) setAssetType(found.type);
              }}
              className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <optgroup label="Crypto">
                {cryptoAssets.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol} — ${a.price.toFixed(2)}</option>
                ))}
              </optgroup>
              <optgroup label="Forex">
                {forexPairs.map(p => (
                  <option key={p.symbol} value={p.symbol}>{p.symbol} — {p.rate.toFixed(4)}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Alert Type */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Condition</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { type: 'price_above' as const, icon: TrendingUp, label: 'Price Above' },
                { type: 'price_below' as const, icon: TrendingDown, label: 'Price Below' },
                { type: 'percent_change' as const, icon: Percent, label: '% Change' },
              ]).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setAlertType(type)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 min-h-11 rounded-lg text-xs font-medium border transition-colors',
                    alertType === type
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-nexus-elevated text-slate-400 border-nexus-border hover:text-slate-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Value */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
              {alertType === 'percent_change' ? 'Percent Change (%)' : 'Target Price ($)'}
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={e => { setTargetValue(e.target.value); if (formError) setFormError(''); }}
              onFocus={(e) => scrollIntoViewOnMobile(e.target)}
              placeholder={alertType === 'percent_change' ? 'e.g., 5' : 'e.g., 45000'}
              step="any"
              min="0"
              inputMode="decimal"
              enterKeyHint="done"
              className="w-full px-3 py-2.5 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-slate-600"
            />
            {formError && (
              <p className="text-[11px] text-amber-400 mt-1">{formError}</p>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={!targetValue || parseFloat(targetValue) <= 0}
            className="w-full py-2.5 min-h-11 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Alert
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'active', 'triggered'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-2 min-h-11 rounded-lg text-xs font-medium capitalize transition-colors',
              filter === f
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-nexus-elevated text-slate-400 border border-nexus-border'
            )}
          >
            {f} {f === 'active' ? `(${activeAlerts.length})` : f === 'triggered' ? `(${triggeredAlerts.length})` : `(${alerts.length})`}
          </button>
        ))}
        {triggeredAlerts.length > 0 && (
          <button
            onClick={clearTriggered}
            className="px-3 py-2 min-h-11 rounded-lg text-xs text-red-400 hover:text-red-300 bg-nexus-elevated border border-nexus-border ml-auto"
          >
            Clear Triggered
          </button>
        )}
      </div>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {filter === 'all' ? 'No alerts yet' : `No ${filter} alerts`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Create alerts to get notified when prices hit your targets</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => (
            <div
              key={alert.id}
              className={cn(
                'bg-nexus-card rounded-xl border p-4 transition-all',
                alert.isTriggered ? 'border-amber-500/30 bg-amber-500/5' :
                alert.isActive ? 'border-nexus-border' :
                'border-nexus-border opacity-60'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    alert.isTriggered ? 'bg-amber-500/15' :
                    alert.type === 'price_above' ? 'bg-emerald-500/15' :
                    alert.type === 'price_below' ? 'bg-red-500/15' :
                    'bg-blue-500/15'
                  )}>
                    {alert.isTriggered ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    ) : alert.type === 'price_above' ? (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    ) : alert.type === 'price_below' ? (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    ) : (
                      <Percent className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{alert.symbol}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        alert.isTriggered ? 'bg-amber-500/15 text-amber-400' :
                        alert.isActive ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-500/10 text-slate-500'
                      )}>
                        {alert.isTriggered ? 'Triggered' : alert.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {alert.type === 'price_above' ? 'Price goes above' :
                       alert.type === 'price_below' ? 'Price goes below' :
                       'Changes by'} <span className="font-mono text-slate-300">
                        {alert.type === 'percent_change' ? `${alert.targetValue}%` : `$${alert.targetValue.toLocaleString()}`}
                      </span>
                    </p>
                    {alert.currentValue && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Current: ${alert.currentValue.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {alert.triggeredAt && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(alert.triggeredAt).toLocaleString()}
                    </span>
                  )}
                  {!alert.isTriggered && (
                    <button
                      onClick={() => toggleAlert(alert.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500"
                      title={alert.isActive ? 'Pause' : 'Resume'}
                    >
                      {alert.isActive ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Alerts are checked client-side while the app is open. They will not trigger when the browser is closed. Paper trading only.
          </p>
        </div>
      </div>
    </div>
  );
}
