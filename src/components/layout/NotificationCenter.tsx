import { useState } from 'react';
import { Bell, X, Trash2, CheckCircle2, TrendingUp, TrendingDown, Percent, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAlertStore } from '@/stores/alertStore';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { alerts, clearTriggered, deleteAlert } = useAlertStore();
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const activeAlerts = alerts.filter(a => a.isActive && !a.isTriggered);
  const hasUnread = triggeredAlerts.some(a => a.triggeredAt && Date.now() - new Date(a.triggeredAt).getTime() < 3600000);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {(triggeredAlerts.length > 0 || hasUnread) && (
          <span className={cn(
            'absolute top-1 right-1 w-2 h-2 rounded-full',
            hasUnread ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
          )} />
        )}
        {triggeredAlerts.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center px-1">
            {triggeredAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications panel" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notifications panel"
            className="absolute right-0 top-full mt-2 z-50 bg-nexus-card border border-nexus-border rounded-xl shadow-2xl w-80 max-h-[70vh] flex flex-col animate-fade-in modal-scroll-contain"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Notifications
              </h3>
              <div className="flex items-center gap-1">
                {triggeredAlerts.length > 0 && (
                  <button
                    onClick={clearTriggered}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-white/5"
                    aria-label="Clear all triggered alerts"
                  >
                    Clear all
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications panel" className="p-1 hover:bg-white/5 rounded">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Triggered Alerts */}
              {triggeredAlerts.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-nexus-elevated/50">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Triggered</span>
                  </div>
                  {triggeredAlerts.map(alert => (
                    <div key={alert.id} className="px-4 py-3 border-b border-nexus-border hover:bg-white/[0.02]">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5 shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{alert.symbol}</p>
                            <p className="text-xs text-slate-400">
                              {alert.type === 'price_above' ? 'Price rose above' :
                               alert.type === 'price_below' ? 'Price dropped below' :
                               'Changed by'}{' '}
                              <span className="font-mono">
                                {alert.type === 'percent_change' ? `${alert.targetValue}%` : `$${alert.targetValue.toLocaleString()}`}
                              </span>
                            </p>
                            {alert.triggeredAt && (
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {timeAgo(alert.triggeredAt)}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          aria-label={`Delete alert for ${alert.symbol}`}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Alerts */}
              {activeAlerts.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-nexus-elevated/50">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Watching</span>
                  </div>
                  {activeAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="px-4 py-2.5 border-b border-nexus-border/50 hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-6 h-6 rounded flex items-center justify-center',
                          alert.type === 'price_above' ? 'bg-emerald-500/10' :
                          alert.type === 'price_below' ? 'bg-red-500/10' : 'bg-blue-500/10'
                        )}>
                          {alert.type === 'price_above' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> :
                           alert.type === 'price_below' ? <TrendingDown className="w-3 h-3 text-red-400" /> :
                           <Percent className="w-3 h-3 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{alert.symbol}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {alert.type.replace('_', ' ')} <span className="font-mono">
                              {alert.type === 'percent_change' ? `${alert.targetValue}%` : `$${alert.targetValue}`}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty */}
              {triggeredAlerts.length === 0 && activeAlerts.length === 0 && (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No notifications</p>
                  <p className="text-xs text-slate-600 mt-0.5">Set up alerts to get notified</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
