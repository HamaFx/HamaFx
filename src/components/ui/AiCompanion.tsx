import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAlertStore } from '@/stores/alertStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/utils/cn';

type Mood = 'neutral' | 'sleep' | 'thinking' | 'talking' | 'angry' | 'dizzy' | 'happy' | 'sad' | 'love' | 'scared';

export function AiCompanion() {
  const { isLoading } = useChatStore();
  const { alerts } = useAlertStore();
  const { getTotalPnL, tradeHistory } = usePortfolioStore();
  const { cryptoAssets } = useMarketStore();

  const triggeredAlerts = alerts.filter(a => a.isTriggered);
  const hasAlert = triggeredAlerts.length > 0;
  
  // PnL Logic
  const { percent: pnlPercent } = getTotalPnL();
  const isProfitable = pnlPercent >= 0.5; // +0.5% happy
  const isLosing = pnlPercent <= -0.5; // -0.5% sad

  // Market Logic
  const btc = cryptoAssets.find(a => a.symbol === 'BTC');
  const isMarketCrash = (btc?.changePercent24h ?? 0) <= -4; // BTC down 4% = Scared

  // Trade Logic (Love/Celebrate)
  const [loveMode, setLoveMode] = useState(false);
  const prevTradesLen = useRef(tradeHistory.length);

  useEffect(() => {
    if (tradeHistory.length > prevTradesLen.current) {
      setLoveMode(true);
      setTimeout(() => setLoveMode(false), 3000); // 3s Love
    }
    prevTradesLen.current = tradeHistory.length;
  }, [tradeHistory.length]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [userActive, setUserActive] = useState(true);
  const [poked, setPoked] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sleepTimeout = useRef<number>(0);

  // Derived Mood Priority
  let mood: Mood = 'neutral';
  
  if (poked) mood = 'dizzy';
  else if (loveMode) mood = 'love'; // Trade = Love
  else if (hasAlert) mood = 'angry';
  else if (isLoading) mood = 'talking';
  else if (isMarketCrash) mood = 'scared';
  else if (isProfitable) mood = 'happy';
  else if (isLosing) mood = 'sad';
  else if (!userActive) mood = 'sleep';

  // Activity Tracking
  useEffect(() => {
    const resetSleepTimer = () => {
      setUserActive(true);
      window.clearTimeout(sleepTimeout.current);
      sleepTimeout.current = window.setTimeout(() => setUserActive(false), 30000);
    };

    const handleActivity = (e: MouseEvent | TouchEvent) => {
      resetSleepTimer();
      // Mouse Tracking
      if (e instanceof MouseEvent && containerRef.current && (mood === 'neutral' || mood === 'happy' || mood === 'sad')) {
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
    
    resetSleepTimer(); 

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', resetSleepTimer);
      window.clearTimeout(sleepTimeout.current);
    };
  }, [mood]);

  // Blink
  useEffect(() => {
    const blinkLoop = () => {
      if (['neutral', 'happy', 'sad', 'talking'].includes(mood)) {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      }
      setTimeout(blinkLoop, Math.random() * 3000 + 2000);
    };
    const timer = setTimeout(blinkLoop, 2000);
    return () => clearTimeout(timer);
  }, [mood]);

  const handlePoke = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPoked(true);
    setTimeout(() => setPoked(false), 2000);
  };

  return (
    <div 
      ref={containerRef}
      onClick={handlePoke}
      className={cn(
        "relative w-12 h-7 rounded-full flex items-center justify-center gap-1.5 transition-all duration-500 border shadow-lg overflow-hidden cursor-pointer",
        // Neutral
        mood === 'neutral' && "bg-[#09090b] border-[#27272a] shadow-indigo-500/10",
        // Sleep
        mood === 'sleep' && "bg-[#050505] border-[#1a1a1a] opacity-70 scale-95",
        // Talking
        mood === 'talking' && "bg-indigo-950 border-indigo-500/50 w-14 shadow-indigo-500/30",
        // Angry (Alert)
        mood === 'angry' && "bg-red-950 border-red-500/50 shadow-red-500/20",
        // Dizzy (Poke)
        mood === 'dizzy' && "bg-purple-950 border-purple-500/50 animate-shake",
        // Happy (Profit)
        mood === 'happy' && "bg-emerald-950 border-emerald-500/50 shadow-emerald-500/20",
        // Sad (Loss)
        mood === 'sad' && "bg-rose-950 border-rose-500/50 shadow-rose-500/10",
        // Love (Trade)
        mood === 'love' && "bg-pink-950 border-pink-500/50 shadow-pink-500/30 animate-[bounce_0.5s_infinite]",
        // Scared (Crash)
        mood === 'scared' && "bg-amber-950 border-amber-500/50 animate-shake shadow-amber-500/20"
      )}
      title={`AI Status: ${mood.toUpperCase()}`}
    >
      {/* Eyes */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn(
            "bg-white transition-all duration-300 ease-out will-change-transform",
            "w-1.5 h-1.5 rounded-full",
            
            // Sleep
            mood === 'sleep' && "h-[1px] w-2 opacity-50",

            // Talking
            mood === 'talking' && ["w-1.5 h-3 rounded-full animate-[bounce_0.4s_infinite]", i === 1 && "animation-delay-100"],

            // Angry
            mood === 'angry' && (i === 0 ? "rotate-12 h-2 w-1 rounded-sm bg-red-200" : "-rotate-12 h-2 w-1 rounded-sm bg-red-200"),

            // Dizzy
            mood === 'dizzy' && "w-2 h-2 bg-pink-300 rounded-none animate-spin",

            // Happy (Inverted U)
            mood === 'happy' && "h-1 w-2 rounded-t-full bg-emerald-200 translate-y-[-1px]",

            // Sad (Slanted lines / \)
            mood === 'sad' && (i === 0 ? "-rotate-12 h-[2px] w-2 bg-rose-200" : "rotate-12 h-[2px] w-2 bg-rose-200"),

            // Love (Hearts or Pink)
            mood === 'love' && "w-2 h-2 bg-pink-300 rounded-full scale-125",

            // Scared (Tall Ovals)
            mood === 'scared' && "h-3 w-1.5 rounded-full bg-amber-200",

            // Blink
            blink && mood !== 'sleep' && "scale-y-[0.1]"
          )}
          style={{
            transform: (['neutral', 'happy', 'sad'].includes(mood))
              ? `translate(${mousePos.x}px, ${mousePos.y}px) scaleY(${blink ? 0.1 : 1})`
              : undefined
          }}
        />
      ))}
    </div>
  );
}