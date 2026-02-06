import { useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a fade-up entrance animation
 * that triggers on route changes.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Remove class to reset, then add to replay animation
    el.classList.remove('page-enter');
    // Force reflow
    void el.offsetHeight;
    el.classList.add('page-enter');
  }, [location.pathname]);

  return (
    <div ref={containerRef} className={`page-enter ${className}`}>
      {children}
    </div>
  );
}

/**
 * Wraps a list container so children animate in with stagger delays.
 * Just add this as a wrapper — CSS handles the animation via .stagger-children
 */
export function StaggerContainer({
  children,
  className = '',
  fast = false,
}: {
  children: ReactNode;
  className?: string;
  fast?: boolean;
}) {
  return (
    <div className={`${fast ? 'stagger-fast' : 'stagger-children'} ${className}`}>
      {children}
    </div>
  );
}
