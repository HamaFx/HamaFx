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
    <div className="relative w-8 h-8 flex items-center justify-center group cursor-pointer" title="AI System Online">
      
      {/* Outer Ring (Orbit) */}
      <div className={cn(
        "absolute inset-0 rounded-full border border-dashed transition-all duration-500",
        state === 'idle' && "border-indigo-500/30 w-full h-full animate-[spin_10s_linear_infinite]",
        state === 'thinking' && "border-purple-500/50 w-full h-full animate-[spin_2s_linear_infinite]",
        state === 'alert' && "border-red-500/50 w-full h-full animate-none"
      )} />

      {/* Inner Glow (Aura) */}
      <div className={cn(
        "absolute w-4 h-4 rounded-full blur-md transition-colors duration-500",
        state === 'idle' && "bg-indigo-500/60 animate-pulse",
        state === 'thinking' && "bg-purple-500/80 animate-pulse",
        state === 'alert' && "bg-red-500/80 animate-pulse"
      )} />

      {/* Core (The Eye) */}
      <div className={cn(
        "relative w-2 h-2 rounded-full transition-all duration-300 shadow-sm",
        state === 'idle' && "bg-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.8)]",
        state === 'thinking' && "bg-purple-300 shadow-[0_0_12px_rgba(168,85,247,1)] scale-110",
        state === 'alert' && "bg-red-400 shadow-[0_0_12px_rgba(239,68,68,1)]",
        blinking && "scale-y-0" // Blink effect
      )} />

      {/* Tiny Scanline (Horizontal) - Optional Detail */}
      {state === 'thinking' && (
        <div className="absolute w-full h-[1px] bg-purple-400/50 animate-[scan_1s_ease-in-out_infinite] top-0" />
      )}
    </div>
  );
}
