import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Briefcase, Newspaper, Star,
  Calendar, FlaskConical, Settings, LogOut, Menu, X,
  Bot, Sun, Moon, ChevronRight, Grid3X3, Bell, Shield, Columns2
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/utils/cn';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';
import AIChatDrawer from '../AIChatDrawer';
import { AiCompanion } from '@/components/ui/AiCompanion';
import { MiniTicker } from '@/components/ui/MiniTicker';
import { useChatStore } from '@/stores/chatStore';
import { MessageCircle } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { isBackendEnabled } from '@/services/backend/config';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets', icon: TrendingUp, label: 'Markets' },
  { to: '/heatmap', icon: Grid3X3, label: 'Heatmap' },
  { to: '/terminal', icon: Columns2, label: 'Terminal' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/watchlist', icon: Star, label: 'Watchlist' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/news', icon: Newspaper, label: 'News' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/risk', icon: Shield, label: 'Risk' },
  { to: '/backtest', icon: FlaskConical, label: 'Backtest' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const mobileNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/markets', icon: TrendingUp, label: 'Markets' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/watchlist', icon: Star, label: 'Watch' },
  { to: '/settings', icon: Menu, label: 'More' },
];

function NavItem({ to, icon: Icon, label, collapsed, onClick }: {
  to: string; icon: React.ComponentType<{ className?: string }>; label: string; collapsed?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-nexus-accent/15 text-indigo-400'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { settings, setTheme, hasGeminiKey } = useSettingsStore();
  const { isOpen: chatOpen, toggleChat } = useChatStore();
  const navigate = useNavigate();
  const aiConnected = hasGeminiKey() || isBackendEnabled();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const riskPosture = (() => {
    if (!settings.trading.enableRiskGuardrails) {
      return { label: 'Risk Off', tone: 'bg-red-500/15 text-red-300' };
    }
    const conservative = settings.trading.maxPositionSizePercent <= 15
      && settings.trading.maxDailyLossPercent <= 3
      && settings.trading.maxOpenPositions <= 5;
    const aggressive = settings.trading.maxPositionSizePercent >= 40
      || settings.trading.maxDailyLossPercent >= 10
      || settings.trading.maxOpenPositions >= 15;
    if (conservative) return { label: 'Risk Low', tone: 'bg-emerald-500/15 text-emerald-300' };
    if (aggressive) return { label: 'Risk High', tone: 'bg-amber-500/15 text-amber-300' };
    return { label: 'Risk Med', tone: 'bg-blue-500/15 text-blue-300' };
  })();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-nexus-border bg-nexus-card shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-nexus-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">HamaFX</h1>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* AI Status */}
        <div className="px-3 py-2">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
            aiConnected ? 'bg-violet-500/10 text-violet-400' : 'bg-slate-500/10 text-slate-500'
          )}>
            <Bot className="w-4 h-4" />
            <span>{aiConnected ? 'AI Connected' : 'AI Not Configured'}</span>
            {!aiConnected && (
              <button type="button" aria-label="Open settings to configure AI" onClick={() => navigate('/settings')} className="ml-auto">
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t border-nexus-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
            </div>
            <button type="button" onClick={handleLogout} aria-label="Log out" className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button type="button" aria-label="Close navigation menu" className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 bg-nexus-card flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 h-16 border-b border-nexus-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <TrendingUp className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">HamaFX</span>
              </div>
              <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu" className="p-2 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-nexus-border">
              <button type="button" onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-red-400 hover:bg-red-500/10">
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 md:h-16 border-b border-nexus-border bg-nexus-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-white/5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">HamaFX</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Status Badge */}
            <div className={cn(
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              aiConnected ? 'bg-violet-500/15 text-violet-400' : 'bg-slate-500/10 text-slate-500'
            )}>
              <div className={cn('w-1.5 h-1.5 rounded-full', aiConnected ? 'bg-violet-400' : 'bg-slate-500')} />
              AI
            </div>

            {/* Global Search */}
            <GlobalSearch />

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* AI Chat Toggle */}
            <button
              type="button"
              onClick={toggleChat}
              className={cn(
                'flex items-center gap-2 pr-3 pl-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors border group',
                chatOpen 
                  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' 
                  : 'bg-white/5 text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/10'
              )}
              aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
              data-testid="desktop-ai-chat-toggle"
            >
              <AiCompanion />
              <span className="hidden sm:inline group-hover:text-white transition-colors">AI Copilot</span>
            </button>

            <div className={cn('hidden sm:flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', riskPosture.tone)}>
              {riskPosture.label}
            </div>

            {/* Notification Center */}
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-nexus-card border-t border-nexus-border flex items-center justify-around px-2 z-40">
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to + label}
            to={to}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[60px]',
              isActive ? 'text-indigo-400' : 'text-slate-500'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* AI Chat Drawer */}
      <AIChatDrawer />

      {/* Floating Chat Button (mobile) */}
      {!chatOpen && (
        <button
          type="button"
          onClick={toggleChat}
          className="md:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
          aria-label="Open AI Chat"
          data-testid="mobile-ai-chat-toggle"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Risk Disclaimer Footer */}
      <div className="hidden md:block fixed bottom-0 left-60 right-0 px-4 py-1.5 bg-nexus-card/80 backdrop-blur border-t border-nexus-border z-30">
        <p className="text-xs text-slate-600 text-center">
          ⚠️ Paper trading only. Not financial advice. AI signals are for educational purposes. Past performance ≠ future results.
        </p>
      </div>
      </div>
    </>
  );
}
