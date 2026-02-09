import { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAlertStore } from '@/stores/alertStore';
import { cn } from '@/utils/cn';

export function AiCompanion() {
  const { isLoading } = useChatStore();
  const { alerts } = useAlertStore();
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const hasAlert = triggeredAlerts.length > 0;

  // Random "blink" effect
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 150);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Determine State
  const state = isLoading ? 'thinking' : hasAlert ? 'alert' : 'idle';

  return (
    <div className="relative w-6 h-6 flex items-center justify-center" title="AI System Online">
      
      {/* Outer Ring (Orbit) - Brighter & Solid */}
      <div className={cn(
        "absolute inset-0 rounded-full border-2 transition-all duration-500",
        state === 'idle' && "border-indigo-400/40 border-t-indigo-400 w-full h-full animate-[spin_3s_linear_infinite]",
        state === 'thinking' && "border-purple-400/60 border-t-purple-400 border-r-purple-400 w-full h-full animate-[spin_1s_linear_infinite]",
        state === 'alert' && "border-red-500 border-dashed w-full h-full animate-none"
      )} />

      {/* Inner Glow (Aura) - Stronger */}
      <div className={cn(
        "absolute w-full h-full rounded-full blur-md transition-colors duration-500 opacity-50",
        state === 'idle' && "bg-indigo-500 animate-pulse",
        state === 'thinking' && "bg-purple-600 animate-pulse",
        state === 'alert' && "bg-red-600 animate-pulse"
      )} />

      {/* Core (The Eye) - Distinct */}
      <div className={cn(
        "relative w-2.5 h-2.5 rounded-full transition-all duration-300 z-10",
        state === 'idle' && "bg-indigo-100 shadow-[0_0_10px_rgba(99,102,241,1)]",
        state === 'thinking' && "bg-purple-100 shadow-[0_0_15px_rgba(168,85,247,1)] scale-110",
        state === 'alert' && "bg-red-100 shadow-[0_0_15px_rgba(239,68,68,1)]",
        blinking && "scale-y-0 duration-75"
      )} />
    </div>
  );
}
