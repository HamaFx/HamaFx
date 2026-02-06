import { useEffect, useState } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration: number;
  createdAt: number;
}

const toasts: Toast[] = [];
let listeners: (() => void)[] = [];
function notify() { listeners.forEach(l => l()); }

export function showToast(type: Toast['type'], title: string, message?: string, duration = 4000) {
  const t: Toast = { id: Math.random().toString(36).slice(2), type, title, message, duration, createdAt: Date.now() };
  toasts.unshift(t);
  if (toasts.length > 5) toasts.pop();
  notify();
  setTimeout(() => { removeToast(t.id); }, duration);
}

function removeToast(id: string) {
  const i = toasts.findIndex(t => t.id === id);
  if (i !== -1) { toasts.splice(i, 1); notify(); }
}

const icons: Record<string, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
const colors: Record<string, string> = {
  success: 'border-emerald-500 bg-emerald-500/10',
  error: 'border-red-500 bg-red-500/10',
  warning: 'border-amber-500 bg-amber-500/10',
  info: 'border-blue-500 bg-blue-500/10',
};
const iconColors: Record<string, string> = {
  success: 'text-emerald-400 bg-emerald-500/20',
  error: 'text-red-400 bg-red-500/20',
  warning: 'text-amber-400 bg-amber-500/20',
  info: 'text-blue-400 bg-blue-500/20',
};
const barColors: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export default function ToastContainer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[90vw]">
      {toasts.map((t) => {
        const elapsed = Date.now() - t.createdAt;
        const progress = Math.max(0, 1 - elapsed / t.duration);
        return (
          <div
            key={t.id}
            className={`relative border-l-4 rounded-lg shadow-2xl backdrop-blur-xl overflow-hidden ${colors[t.type]}`}
            style={{ animation: 'toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="flex items-start gap-3 p-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${iconColors[t.type]}`}>
                {icons[t.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.message}</p>}
              </div>
              <button onClick={() => removeToast(t.id)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="h-0.5 w-full bg-gray-800">
              <div className={`h-full ${barColors[t.type]} transition-all duration-100`} style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
