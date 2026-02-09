import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAlertStore } from '@/stores/alertStore';
import { cn } from '@/utils/cn';

export function AiCompanion() {
  const { isLoading } = useChatStore();
  const { alerts } = useAlertStore();
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const hasAlert = triggeredAlerts.length > 0;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // State Logic
  const mood = isLoading ? 'thinking' : hasAlert ? 'angry' : 'neutral';

  // Mouse Tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      // Calculate offset (clamped)
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 100));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 100));
      
      setMousePos({ x: dx * 3, y: dy * 2 }); // Scale movement
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto Blink
  useEffect(() => {
    const blinkLoop = () => {
      if (mood === 'neutral') {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      }
      setTimeout(blinkLoop, Math.random() * 3000 + 2000);
    };
    const timer = setTimeout(blinkLoop, 2000);
    return () => clearTimeout(timer);
  }, [mood]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-12 h-7 rounded-full flex items-center justify-center gap-1.5 transition-colors duration-300 border",
        mood === 'neutral' && "bg-[#09090b] border-[#27272a]",
        mood === 'thinking' && "bg-indigo-950 border-indigo-500/50",
        mood === 'angry' && "bg-red-950 border-red-500/50"
      )}
      title={mood === 'thinking' ? "Thinking..." : mood === 'angry' ? "Alert Triggered!" : "AI Online"}
    >
      {/* Eyes */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-white transition-all duration-300 ease-out will-change-transform",
            // Base Shape
            "w-1.5 h-1.5 rounded-full",
            // Mood: Neutral (Circle)
            mood === 'neutral' && "w-1.5 h-1.5",
            // Mood: Thinking (Squint/Happy ^ ^)
            mood === 'thinking' && "w-2 h-1 rounded-full translate-y-[-1px]", 
            // Mood: Angry (Slanted > <)
            mood === 'angry' && (i === 0 ? "rotate-12 h-2 w-1 rounded-sm" : "-rotate-12 h-2 w-1 rounded-sm"),
            // Blink Override
            blink && "scale-y-[0.1]"
          )}
          style={{
            transform: mood === 'neutral' 
              ? `translate(${mousePos.x}px, ${mousePos.y}px) scaleY(${blink ? 0.1 : 1})`
              : undefined // Disable tracking for expressive moods to keep shape integrity
          }}
        />
      ))}
    </div>
  );
}