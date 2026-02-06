import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from its previous value to the new value
 * using requestAnimationFrame for smooth 60fps transitions.
 */
export function useAnimatedNumber(
  targetValue: number,
  duration: number = 600,
  enabled: boolean = true
): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevValue = useRef(targetValue);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setDisplayValue(targetValue);
      prevValue.current = targetValue;
      return;
    }

    const startValue = prevValue.current;
    const diff = targetValue - startValue;

    if (Math.abs(diff) < 0.001) {
      setDisplayValue(targetValue);
      prevValue.current = targetValue;
      return;
    }

    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        prevValue.current = targetValue;
      }
    }

    cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [targetValue, duration, enabled]);

  // Update ref when animation completes
  useEffect(() => {
    return () => {
      prevValue.current = displayValue;
    };
  }, [displayValue]);

  return displayValue;
}

/**
 * Tracks whether a number went up or down from its previous value
 * and provides a CSS class + direction for flash animations.
 */
export function usePriceFlash(value: number): {
  direction: 'up' | 'down' | null;
  flashClass: string;
  bgFlashClass: string;
} {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const timeoutRef = useRef(0);

  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== 0) {
      const dir = value > prevValue.current ? 'up' : 'down';
      setDirection(dir);

      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setDirection(null), 800);
    }
    prevValue.current = value;

    return () => window.clearTimeout(timeoutRef.current);
  }, [value]);

  const flashClass = direction === 'up'
    ? 'price-tick-up'
    : direction === 'down'
      ? 'price-tick-down'
      : '';

  const bgFlashClass = direction === 'up'
    ? 'price-bg-up'
    : direction === 'down'
      ? 'price-bg-down'
      : '';

  return { direction, flashClass, bgFlashClass };
}

/**
 * Returns a formatted animated number as a string
 */
export function useFormattedAnimatedNumber(
  value: number,
  formatter: (n: number) => string,
  duration: number = 600
): string {
  const animated = useAnimatedNumber(value, duration);
  return formatter(animated);
}
