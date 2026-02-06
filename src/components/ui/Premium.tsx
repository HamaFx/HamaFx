import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { X } from 'lucide-react';

/* ═══════════════════════════════════════════
   PREMIUM BUTTON
   ═══════════════════════════════════════════ */
interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'danger' | 'ghost' | 'glass';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  glow?: boolean;
  children?: ReactNode;
}

const btnVariants = {
  primary: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20',
  success: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500 shadow-lg shadow-emerald-500/20',
  danger: 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/20',
  ghost: 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white',
  glass: 'backdrop-blur-xl bg-white/5 text-white border border-white/10 hover:bg-white/10',
};

const btnSizes = {
  xs: 'text-xs px-2 py-1 rounded-lg gap-1',
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-6 py-3 rounded-xl gap-2.5',
};

export function PremiumButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  glow,
  children,
  className,
  disabled,
  ...props
}: PremiumButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200',
        'active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        btnVariants[variant],
        btnSizes[size],
        glow && variant === 'primary' && 'shadow-glow-indigo',
        glow && variant === 'success' && 'shadow-glow-emerald',
        glow && variant === 'danger' && 'shadow-glow-red',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

/* ═══════════════════════════════════════════
   PREMIUM CARD
   ═══════════════════════════════════════════ */
interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  glow?: 'indigo' | 'emerald' | 'red' | 'purple' | 'amber' | 'blue' | null;
  gradient?: boolean;
  onClick?: () => void;
}

const glowBorders: Record<string, string> = {
  indigo: 'hover:border-indigo-500/30 hover:shadow-glow-indigo',
  emerald: 'hover:border-emerald-500/30 hover:shadow-glow-emerald',
  red: 'hover:border-red-500/30 hover:shadow-glow-red',
  purple: 'hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]',
  amber: 'hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  blue: 'hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
};

export function PremiumCard({
  children,
  className,
  glass,
  hover,
  glow,
  gradient,
  onClick,
}: PremiumCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-nexus-border bg-nexus-card overflow-hidden transition-all duration-300',
        glass && 'glass-card',
        hover && 'card-hover cursor-pointer',
        glow && glowBorders[glow],
        gradient && 'gradient-border',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PREMIUM INPUT
   ═══════════════════════════════════════════ */
interface PremiumInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PremiumInput({
  label,
  icon,
  error,
  size = 'md',
  className,
  ...props
}: PremiumInputProps) {
  const sizes = {
    sm: 'text-xs px-3 py-2',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-4 py-3',
  };

  return (
    <div className="w-full">
      {label && <label className="text-xs text-slate-400 font-medium mb-1.5 block">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>
        )}
        <input
          className={cn(
            'w-full rounded-xl border bg-nexus-elevated/50 text-white placeholder-slate-500',
            'border-nexus-border focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20',
            'outline-none transition-all duration-200',
            sizes[size],
            icon && 'pl-10',
            error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PREMIUM BADGE
   ═══════════════════════════════════════════ */
interface PremiumBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'emerald';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const badgeVariants = {
  default: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const badgeSizes = {
  xs: 'text-[9px] px-1.5 py-0.5',
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export function PremiumBadge({
  children,
  variant = 'default',
  size = 'sm',
  dot,
  pulse,
  className,
}: PremiumBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium border',
      badgeVariants[variant],
      badgeSizes[size],
      className
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' ? 'bg-emerald-400' :
          variant === 'danger' ? 'bg-red-400' :
          variant === 'warning' ? 'bg-amber-400' :
          variant === 'info' ? 'bg-blue-400' :
          variant === 'purple' ? 'bg-purple-400' : 'bg-slate-400',
          pulse && 'pulse-dot'
        )} />
      )}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════
   PREMIUM MODAL
   ═══════════════════════════════════════════ */
interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PremiumModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
}: PremiumModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        className={cn(
          'relative w-full rounded-2xl border border-nexus-border bg-nexus-card shadow-premium animate-scale-in',
          sizeClass,
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-nexus-border">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-white/5 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PREMIUM TOGGLE
   ═══════════════════════════════════════════ */
interface PremiumToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}

export function PremiumToggle({ enabled, onChange, label, description, size = 'md' }: PremiumToggleProps) {
  const trackSize = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const knobSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      {(label || description) && (
        <div>
          {label && <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</span>}
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      )}
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex shrink-0 rounded-full transition-all duration-300',
          trackSize,
          enabled
            ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-glow-indigo'
            : 'bg-nexus-elevated border border-nexus-border'
        )}
      >
        <span className={cn(
          'inline-block rounded-full bg-white shadow-md transition-transform duration-300',
          knobSize,
          'absolute top-1/2 -translate-y-1/2 left-[3px]',
          enabled && translate
        )} />
      </button>
    </label>
  );
}

/* ═══════════════════════════════════════════
   TAB BAR
   ═══════════════════════════════════════════ */
interface TabBarProps<T extends string> {
  tabs: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  active: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function TabBar<T extends string>({ tabs, active, onChange, size = 'sm', className }: TabBarProps<T>) {
  return (
    <div className={cn(
      'inline-flex items-center rounded-xl p-0.5 bg-nexus-elevated border border-nexus-border',
      className
    )}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200',
            size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2',
            active === tab.id
              ? 'bg-nexus-card text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
              active === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-nexus-border text-slate-500'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════ */
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  change?: number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, icon, change, subtitle, className }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-nexus-border bg-nexus-card p-4 transition-all hover:border-nexus-elevated',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className="text-xl font-bold font-mono tracking-tight">{value}</p>
      {change !== undefined && (
        <p className={cn('text-xs font-mono mt-1', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </p>
      )}
      {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════ */
export function SectionHeader({
  title,
  icon,
  action,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <h2 className="text-lg font-bold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════ */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && <div className="text-slate-600 mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-400">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   GLASS DIVIDER
   ═══════════════════════════════════════════ */
export function GlassDivider({ className }: { className?: string }) {
  return (
    <div className={cn(
      'h-px bg-gradient-to-r from-transparent via-nexus-border to-transparent',
      className
    )} />
  );
}

/* ═══════════════════════════════════════════
   SKELETON LOADER
   ═══════════════════════════════════════════ */
export function Skeleton({
  className,
  variant = 'rect',
}: {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}) {
  return (
    <div className={cn(
      'animate-shimmer',
      variant === 'circle' && 'rounded-full',
      variant === 'text' && 'rounded h-4 w-3/4',
      variant === 'rect' && 'rounded-lg',
      className
    )} />
  );
}
