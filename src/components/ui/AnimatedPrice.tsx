import { useRef, useState, useEffect, memo } from 'react';
import { cn } from '@/utils/cn';

interface AnimatedPriceProps {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
  showFlash?: boolean;
  showBgFlash?: boolean;
  prefix?: string;
  suffix?: string;
}

/**
 * Displays a price with smooth number animation and flash effects
 * on value changes (green for up, red for down).
 */
export const AnimatedPrice = memo(function AnimatedPrice({
  value,
  formatter,
  className,
  showFlash = true,
  showBgFlash = false,
  prefix = '',
  suffix = '',
}: AnimatedPriceProps) {
  const prevValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const animRef = useRef(0);
  const flashTimeout = useRef(0);

  useEffect(() => {
    const startVal = prevValue.current;
    const diff = value - startVal;

    if (Math.abs(diff) < 0.0000001) {
      prevValue.current = value;
      return;
    }

    // Trigger flash
    if (showFlash) {
      const dir = diff > 0 ? 'up' : 'down';
      setFlash(dir);
      window.clearTimeout(flashTimeout.current);
      flashTimeout.current = window.setTimeout(() => setFlash(null), 800);
    }

    // Animate number
    const startTime = performance.now();
    const duration = 400;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + diff * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValue.current = value;
      }
    }

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.clearTimeout(flashTimeout.current);
    };
  }, [value, showFlash]);

  const defaultFormatter = (n: number) => {
    if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    return n.toFixed(6);
  };

  const format = formatter || defaultFormatter;

  const textFlashClass = flash === 'up'
    ? 'price-tick-up'
    : flash === 'down'
      ? 'price-tick-down'
      : '';

  const bgFlashClass = showBgFlash
    ? flash === 'up'
      ? 'price-bg-up'
      : flash === 'down'
        ? 'price-bg-down'
        : ''
    : '';

  return (
    <span
      className={cn(
        'font-mono font-tabular inline-block transition-colors',
        textFlashClass,
        bgFlashClass,
        className
      )}
    >
      {prefix}{format(displayValue)}{suffix}
    </span>
  );
});

/**
 * Animated percentage with color coding
 */
export const AnimatedPercent = memo(function AnimatedPercent({
  value,
  className,
  showSign = true,
  decimals = 2,
}: {
  value: number;
  className?: string;
  showSign?: boolean;
  decimals?: number;
}) {
  const prevValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const animRef = useRef(0);
  const flashTimeout = useRef(0);

  useEffect(() => {
    const startVal = prevValue.current;
    const diff = value - startVal;

    if (Math.abs(diff) < 0.001) {
      prevValue.current = value;
      return;
    }

    setFlash(diff > 0 ? 'up' : 'down');
    window.clearTimeout(flashTimeout.current);
    flashTimeout.current = window.setTimeout(() => setFlash(null), 800);

    const startTime = performance.now();
    const duration = 400;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + diff * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValue.current = value;
      }
    }

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.clearTimeout(flashTimeout.current);
    };
  }, [value]);

  const flashClass = flash === 'up' ? 'price-tick-up' : flash === 'down' ? 'price-tick-down' : '';

  return (
    <span
      className={cn(
        'font-mono font-tabular inline-block',
        displayValue >= 0 ? 'text-emerald-400' : 'text-red-400',
        flashClass,
        className
      )}
    >
      {showSign && displayValue >= 0 ? '+' : ''}{displayValue.toFixed(decimals)}%
    </span>
  );
});
