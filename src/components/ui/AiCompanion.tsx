import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAlertStore } from '@/stores/alertStore';
import { cn } from '@/utils/cn';

type Mood = 'neutral' | 'sleep' | 'thinking' | 'talking' | 'angry' | 'dizzy';

export function AiCompanion() {
  const { isLoading } = useChatStore();
  const { alerts } = useAlertStore();
  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const hasAlert = triggeredAlerts.length > 0;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [userActive, setUserActive] = useState(true);
  const [poked, setPoked] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sleepTimeout = useRef<number>(0);

  // Derived Mood
  let mood: Mood = 'neutral';
  if (poked) mood = 'dizzy';
  else if (hasAlert) mood = 'angry';
  else if (isLoading) mood = 'talking'; // Map loading to talking/thinking
  else if (!userActive) mood = 'sleep';

  // Activity Tracking (Sleep/Wake)
  useEffect(() => {
    const resetSleepTimer = () => {
      setUserActive(true);
      window.clearTimeout(sleepTimeout.current);
      sleepTimeout.current = window.setTimeout(() => setUserActive(false), 30000); // 30s sleep
    };

    const handleActivity = (e: MouseEvent | TouchEvent) => {
      resetSleepTimer();
      
      // Mouse Tracking logic inside here to save listener count
      if (e instanceof MouseEvent && containerRef.current && mood === 'neutral') {
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 100));
        const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 100));
        setMousePos({ x: dx * 3, y: dy * 2 });
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('click', resetSleepTimer);
    window.addEventListener('keydown', resetSleepTimer);
    
    resetSleepTimer(); // Init

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', resetSleepTimer);
      window.removeEventListener('keydown', resetSleepTimer);
      window.clearTimeout(sleepTimeout.current);
    };
  }, [mood]);

  // Auto Blink (Only when neutral or talking)
  useEffect(() => {
    const blinkLoop = () => {
      if (mood === 'neutral' || mood === 'talking') {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      }
      setTimeout(blinkLoop, Math.random() * 3000 + 2000);
    };
    const timer = setTimeout(blinkLoop, 2000);
    return () => clearTimeout(timer);
  }, [mood]);

  const handlePoke = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening drawer
    setPoked(true);
    setTimeout(() => setPoked(false), 2000);
  };

  return (
    <div 
      ref={containerRef}
      onClick={handlePoke}
      className={cn(
        "relative w-12 h-7 rounded-full flex items-center justify-center gap-1.5 transition-all duration-500 border shadow-lg overflow-hidden cursor-pointer",
        // Mood Styles
        mood === 'neutral' && "bg-[#09090b] border-[#27272a] shadow-indigo-500/10",
        mood === 'sleep' && "bg-[#050505] border-[#1a1a1a] opacity-70 scale-95",
        mood === 'talking' && "bg-indigo-950 border-indigo-500/50 w-14 shadow-indigo-500/30",
        mood === 'angry' && "bg-red-950 border-red-500/50 shadow-red-500/20",
        mood === 'dizzy' && "bg-purple-950 border-purple-500/50 animate-shake"
      )}
      title={mood.toUpperCase()}
    >
      {/* Eyes */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-white transition-all duration-300 ease-out will-change-transform",
            "w-1.5 h-1.5 rounded-full",
            
            // Mood: Sleep (Line)
            mood === 'sleep' && "h-[1px] w-2 opacity-50",

            // Mood: Talking (Waveform Bars)
            mood === 'talking' && [
              "w-1.5 h-3 rounded-full animate-[bounce_0.4s_infinite]",
              i === 1 && "animation-delay-100"
            ],

            // Mood: Angry (Slanted)
            mood === 'angry' && (i === 0 ? "rotate-12 h-2 w-1 rounded-sm bg-red-200" : "-rotate-12 h-2 w-1 rounded-sm bg-red-200"),

            // Mood: Dizzy (Spinning & Different Color)
            mood === 'dizzy' && "w-2 h-2 bg-pink-300 rounded-none animate-spin",

            // Blink Override
            blink && mood !== 'sleep' && "scale-y-[0.1]"
          )}
          style={{
            transform: mood === 'neutral' 
              ? `translate(${mousePos.x}px, ${mousePos.y}px) scaleY(${blink ? 0.1 : 1})`
              : undefined
          }}
        />
      ))}
    </div>
  );
}
