import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon, Key, User, Bell, Download, Shield,
  Bot, Newspaper, ExternalLink, AlertTriangle,
  Eye, EyeOff, Trash2, Sun, Moon, Monitor, Clock, Activity
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSettingsStore, getSettingsStorageKey } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { getChatStorageKey } from '@/stores/chatStore';
import { PremiumCard, PremiumButton, PremiumBadge, PremiumInput, PremiumToggle, SectionHeader, EmptyState, GlassDivider } from '@/components/ui/Premium';
import type { Alert, Watchlist } from '@/types';
import { getStorageUsageKb, safeJsonParse } from '@/utils/storage';
import { getItemWithMigration } from '@/utils/storageMigration';
import { readSettingsUrlState, writeSettingsUrlState } from '@/utils/urlState';

type SettingsTab = 'apikeys' | 'profile' | 'preferences' | 'notifications' | 'data' | 'audit';
const STORAGE_LIMIT_KB = 5000;
const PORTFOLIO_KEY_PREFIX = 'hamafx_portfolio_';
const TRADES_KEY_PREFIX = 'hamafx_trades_';
const LEGACY_SCOPED_PORTFOLIO_KEY_PREFIX = 'nexus_portfolio_';
const LEGACY_SCOPED_TRADES_KEY_PREFIX = 'nexus_trades_';
const LEGACY_PORTFOLIO_KEY = 'nexus_portfolio';
const LEGACY_TRADES_KEY = 'nexus_trades';
const WATCHLISTS_KEY = 'hamafx_watchlists';
const ALERTS_KEY = 'hamafx_alerts';
const LEGACY_WATCHLISTS_KEY = 'nexus_watchlists';
const LEGACY_ALERTS_KEY = 'nexus_alerts';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => readSettingsUrlState(searchParams));
  const { settings, setTheme, setApiKey, removeApiKey, updateSettings } = useSettingsStore();
  const { user, auditLog } = useAuthStore();
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [newsKeyInput, setNewsKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [validatingGemini, setValidatingGemini] = useState(false);
  const [geminiError, setGeminiError] = useState('');
  const userId = user?.id || 'demo';
  const storageUsageKb = getStorageUsageKb();
  const storageUsagePercent = Math.min((storageUsageKb / STORAGE_LIMIT_KB) * 100, 100);
  const updateTradingSettings = (partial: Partial<typeof settings.trading>) =>
    updateSettings({ trading: { ...settings.trading, ...partial } });

  useEffect(() => { document.title = 'Settings — HamaFX'; }, []);

  useEffect(() => {
    const urlTab = readSettingsUrlState(searchParams);
    setActiveTab((prev) => (prev === urlTab ? prev : urlTab));
  }, [searchParams]);

  useEffect(() => {
    const next = writeSettingsUrlState(searchParams, activeTab);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  const exportUserData = () => {
    const portfolioRaw = getItemWithMigration(`${PORTFOLIO_KEY_PREFIX}${userId}`, [
      `${LEGACY_SCOPED_PORTFOLIO_KEY_PREFIX}${userId}`,
      LEGACY_PORTFOLIO_KEY,
    ]);
    const tradesRaw = getItemWithMigration(`${TRADES_KEY_PREFIX}${userId}`, [
      `${LEGACY_SCOPED_TRADES_KEY_PREFIX}${userId}`,
      LEGACY_TRADES_KEY,
    ]);
    const allWatchlists = safeJsonParse<Watchlist[]>(
      getItemWithMigration(WATCHLISTS_KEY, [LEGACY_WATCHLISTS_KEY]),
      []
    );
    const allAlerts = safeJsonParse<Alert[]>(
      getItemWithMigration(ALERTS_KEY, [LEGACY_ALERTS_KEY]),
      []
    );

    const data = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      userId,
      portfolio: safeJsonParse<Record<string, unknown>>(portfolioRaw, {}),
      trades: safeJsonParse<Record<string, unknown>[]>(tradesRaw, []),
      settings: safeJsonParse(
        getItemWithMigration(getSettingsStorageKey(userId), [`nexus_settings_${userId}`, 'nexus_settings']),
        settings
      ),
      watchlists: allWatchlists.filter((watchlist) => watchlist.userId === userId),
      alerts: allAlerts.filter((alert) => alert.userId === userId),
      chat: safeJsonParse<Record<string, unknown>[]>(localStorage.getItem(getChatStorageKey(userId)), []),
      audit: auditLog.filter((entry) => entry.userId === userId),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamafx-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateAndSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) return;
    setValidatingGemini(true);
    setGeminiError('');
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKeyInput.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with just the word "connected"' }] }] }),
        }
      );
      if (response.ok) {
        setApiKey('gemini', { key: geminiKeyInput.trim(), addedAt: new Date().toISOString(), lastValidated: new Date().toISOString(), isValid: true });
        setGeminiKeyInput('');
      } else {
        const data = await response.json().catch(() => ({}));
        setGeminiError(data?.error?.message || `Invalid key (HTTP ${response.status})`);
      }
    } catch {
      setGeminiError('Network error — check your connection');
    }
    setValidatingGemini(false);
  };

  const saveNewsKey = () => {
    if (!newsKeyInput.trim()) return;
    setApiKey('newsdata', { key: newsKeyInput.trim(), addedAt: new Date().toISOString(), lastValidated: new Date().toISOString(), isValid: true });
    setNewsKeyInput('');
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Theme', icon: Sun },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'data', label: 'Data', icon: Download },
    { id: 'audit', label: 'Audit Log', icon: Shield },
  ];

  return (
    <div className="p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] max-w-4xl mx-auto space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
          <SettingsIcon className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-xs text-slate-500">Manage your API keys, preferences, and data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1 bg-nexus-elevated/50 rounded-xl p-1 border border-nexus-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 min-h-11 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-nexus-card text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* API Keys Tab */}
      {activeTab === 'apikeys' && (
        <div className="space-y-4 stagger-children">
          {/* Gemini Card */}
          <PremiumCard className="p-5 space-y-4" glow="purple">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Google Gemini</h3>
                  <p className="text-xs text-slate-500">Powers AI analysis, signals, and chat</p>
                </div>
              </div>
              {settings.apiKeys.gemini?.isValid ? (
                <PremiumBadge variant="success" size="sm" dot pulse>Connected</PremiumBadge>
              ) : (
                <PremiumBadge variant="warning" size="sm">Not configured</PremiumBadge>
              )}
            </div>

            <GlassDivider />

            {settings.apiKeys.gemini?.isValid ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-nexus-elevated rounded-xl px-4 py-3">
                  <span className="text-sm text-slate-400 font-mono flex-1 tracking-wider">
                    {showGeminiKey ? settings.apiKeys.gemini.key : '•'.repeat(28) + settings.apiKeys.gemini.key.slice(-4)}
                  </span>
                  <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Added {new Date(settings.apiKeys.gemini.addedAt).toLocaleDateString()}</span>
                  <PremiumButton variant="ghost" size="sm" onClick={() => removeApiKey('gemini')}
                    icon={<Trash2 className="w-3 h-3" />} className="text-red-400 hover:text-red-300">
                    Remove
                  </PremiumButton>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <PremiumInput
                    type="password"
                    label="Gemini API key"
                    placeholder="Paste your Gemini API key..."
                    value={geminiKeyInput}
                    onChange={e => setGeminiKeyInput(e.target.value)}
                    icon={<Key className="w-4 h-4" />}
                    error={geminiError}
                    className="flex-1"
                  />
                  <PremiumButton variant="primary" size="md" loading={validatingGemini}
                    disabled={!geminiKeyInput.trim()} onClick={validateAndSaveGeminiKey}>
                    {validatingGemini ? 'Validating...' : 'Save'}
                  </PremiumButton>
                </div>
                <PremiumCard glass className="p-4 space-y-2">
                  <p className="font-semibold text-xs text-slate-300">How to get a free Gemini API key:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-400">
                    <li>Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Sign in with your Google account</li>
                    <li>Click &quot;Create API Key&quot;</li>
                    <li>Copy and paste the key above</li>
                  </ol>
                  <p className="text-xs text-slate-600 pt-1">Free tier: 15 requests/min, 1,500/day — plenty for personal use</p>
                </PremiumCard>
              </div>
            )}
          </PremiumCard>

          {/* NewsData Card */}
          <PremiumCard className="p-5 space-y-4" glow="indigo">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">NewsData.io</h3>
                  <p className="text-xs text-slate-500">Optional — live financial news feed</p>
                </div>
              </div>
              {settings.apiKeys.newsdata?.isValid ? (
                <PremiumBadge variant="success" size="sm" dot pulse>Connected</PremiumBadge>
              ) : (
                <PremiumBadge variant="default" size="sm">Optional</PremiumBadge>
              )}
            </div>

            <GlassDivider />

            {settings.apiKeys.newsdata?.isValid ? (
              <div className="space-y-3">
                <div className="bg-nexus-elevated rounded-xl px-4 py-3">
                  <span className="text-sm text-slate-400 font-mono tracking-wider">{'•'.repeat(24) + settings.apiKeys.newsdata.key.slice(-4)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Added {new Date(settings.apiKeys.newsdata.addedAt).toLocaleDateString()}</span>
                  <PremiumButton variant="ghost" size="sm" onClick={() => removeApiKey('newsdata')}
                    icon={<Trash2 className="w-3 h-3" />} className="text-red-400">
                    Remove
                  </PremiumButton>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <PremiumInput
                  type="password"
                  label="NewsData API key"
                  placeholder="Paste your NewsData.io API key..."
                  value={newsKeyInput}
                  onChange={e => setNewsKeyInput(e.target.value)}
                  icon={<Key className="w-4 h-4" />}
                  className="flex-1"
                />
                <PremiumButton variant="primary" size="md" disabled={!newsKeyInput.trim()} onClick={saveNewsKey}>
                  Save
                </PremiumButton>
              </div>
            )}
          </PremiumCard>

          {/* Security Info */}
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              API keys are stored locally on your device only. They are never sent to any external server other than the API provider. When a backend is added, keys will be stored securely server-side with encryption.
            </p>
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <PremiumCard className="p-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/20">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="text-xl font-bold">{user?.username || 'User'}</h3>
              <p className="text-sm text-slate-400">{user?.email || 'demo@hamafx.app'}</p>
              <div className="flex items-center gap-2 mt-2">
                <PremiumBadge variant="info" size="xs" dot>Active</PremiumBadge>
                <span className="text-xs text-slate-600">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}</span>
              </div>
            </div>
          </div>
          <GlassDivider className="my-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-nexus-elevated rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Account Type</p>
              <p className="text-sm font-semibold">Paper Trading</p>
            </div>
            <div className="bg-nexus-elevated rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">API Keys</p>
              <p className="text-sm font-semibold">{[settings.apiKeys.gemini, settings.apiKeys.newsdata].filter(k => k?.isValid).length} connected</p>
            </div>
          </div>
        </PremiumCard>
      )}

      {/* Theme Tab */}
      {activeTab === 'preferences' && (
        <PremiumCard className="p-6 space-y-5">
          <SectionHeader title="Appearance" icon={<Sun className="w-4 h-4 text-amber-400" />} />
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'dark' as const, icon: Moon, label: 'Dark', desc: 'Easy on eyes' },
              { value: 'light' as const, icon: Sun, label: 'Light', desc: 'Clean & bright' },
              { value: 'system' as const, icon: Monitor, label: 'System', desc: 'Auto-detect' },
            ]).map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-5 rounded-2xl border transition-[background-color,color,border-color,box-shadow] duration-200',
                  settings.theme === value
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/5'
                    : 'bg-nexus-elevated border-nexus-border text-slate-400 hover:text-slate-200 hover:border-slate-600'
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-slate-500">{desc}</span>
              </button>
            ))}
          </div>
          <GlassDivider />
          <SectionHeader title="Trading Preferences" />
          <div className="space-y-4">
            <PremiumToggle
              enabled={settings.trading.confirmBeforeTrade}
              onChange={(enabled) => updateTradingSettings({ confirmBeforeTrade: enabled })}
              label="Confirm before trading"
              description="Show confirmation dialog before executing orders"
            />
            <PremiumToggle
              enabled={settings.ai.showAiDisclaimer}
              onChange={(enabled) => updateSettings({ ai: { ...settings.ai, showAiDisclaimer: enabled } })}
              label="Show risk disclaimers"
              description="Display risk warnings on AI signals and trades"
            />
            <PremiumToggle
              enabled={settings.notifications.soundEnabled}
              onChange={(enabled) => updateSettings({ notifications: { ...settings.notifications, soundEnabled: enabled } })}
              label="Sound alerts"
              description="Play sound when price alerts trigger"
            />
            <PremiumToggle
              enabled={settings.trading.enableRiskGuardrails}
              onChange={(enabled) => updateTradingSettings({ enableRiskGuardrails: enabled })}
              label="Enable risk guardrails"
              description="Block high-risk orders that exceed your risk policy limits"
            />
            <PremiumToggle
              enabled={settings.trading.warnOnConcentration}
              onChange={(enabled) => updateTradingSettings({ warnOnConcentration: enabled })}
              label="Warn on concentration"
              description="Show warnings when single-asset or total exposure is elevated"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Max position size (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={settings.trading.maxPositionSizePercent}
                  onChange={(e) => updateTradingSettings({
                    maxPositionSizePercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                  })}
                  className="w-full px-3 py-2.5 min-h-11 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  inputMode="decimal"
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Max daily loss (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={settings.trading.maxDailyLossPercent}
                  onChange={(e) => updateTradingSettings({
                    maxDailyLossPercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                  })}
                  className="w-full px-3 py-2.5 min-h-11 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  inputMode="decimal"
                  enterKeyHint="next"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Max open positions</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={settings.trading.maxOpenPositions}
                  onChange={(e) => updateTradingSettings({
                    maxOpenPositions: Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                  })}
                  className="w-full px-3 py-2.5 min-h-11 rounded-lg bg-nexus-elevated border border-nexus-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  inputMode="numeric"
                  enterKeyHint="done"
                />
              </div>
            </div>
          </div>
        </PremiumCard>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <PremiumCard className="p-6">
          <SectionHeader title="Notification Preferences" icon={<Bell className="w-4 h-4 text-amber-400" />} />
          <div className="space-y-4 mt-4">
            <PremiumToggle
              enabled={settings.notifications.browserNotifications}
              onChange={async (enabled) => {
                if (enabled && 'Notification' in window && Notification.permission === 'default') {
                  await Notification.requestPermission();
                }
                updateSettings({ notifications: { ...settings.notifications, browserNotifications: enabled } });
              }}
              label="Browser notifications"
              description="Show push notifications for triggered alerts"
            />
            <PremiumToggle
              enabled={settings.notifications.signalAlerts}
              onChange={(enabled) => updateSettings({ notifications: { ...settings.notifications, signalAlerts: enabled } })}
              label="In-app toasts"
              description="Show toast messages for important events"
            />
            <PremiumToggle
              enabled={settings.notifications.soundEnabled}
              onChange={(enabled) => updateSettings({ notifications: { ...settings.notifications, soundEnabled: enabled } })}
              label="Sound notifications"
              description="Play alert sound on triggers"
            />
          </div>
        </PremiumCard>
      )}

      {/* Data Export Tab */}
      {activeTab === 'data' && (
        <PremiumCard className="p-6 space-y-5">
          <SectionHeader title="Data Management" icon={<Download className="w-4 h-4 text-blue-400" />} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumCard glass className="p-4 cursor-pointer card-hover" onClick={exportUserData}>
              <Download className="w-5 h-5 text-indigo-400 mb-2" />
              <p className="text-sm font-semibold">Export All Data</p>
              <p className="text-xs text-slate-500 mt-1">Download portfolio, trades, and settings as JSON</p>
            </PremiumCard>
            <PremiumCard glass className="p-4">
              <Activity className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold">Storage Usage</p>
              <p className="text-xs text-slate-500 mt-1">
                ~{storageUsageKb.toFixed(0)} KB used of {STORAGE_LIMIT_KB.toLocaleString()} KB
              </p>
              <div className="mt-2 h-1.5 bg-nexus-elevated rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                  style={{ width: `${storageUsagePercent}%` }} />
              </div>
            </PremiumCard>
          </div>
        </PremiumCard>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <PremiumCard>
          <div className="px-5 py-4 border-b border-nexus-border">
            <SectionHeader title={`Activity Log (${auditLog.length} events)`} icon={<Shield className="w-4 h-4 text-emerald-400" />} />
          </div>
          {auditLog.length === 0 ? (
            <EmptyState icon={<Clock className="w-8 h-8" />} title="No activity recorded" description="Actions will appear here as you use the app" />
          ) : (
            <div className="divide-y divide-nexus-border/50 max-h-[500px] overflow-y-auto">
              {auditLog.slice(0, 50).map(entry => (
                <div key={entry.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <div>
                      <p className="text-sm">{entry.details}</p>
                      <p className="text-xs text-slate-600">{entry.action}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 whitespace-nowrap ml-4 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PremiumCard>
      )}
    </div>
  );
}
