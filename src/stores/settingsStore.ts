import { create } from 'zustand';
import type { AppSettings, ApiKeyConfig } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { getItemWithMigration } from '@/utils/storageMigration';

const SETTINGS_KEY_PREFIX = 'hamafx_settings_';
const LEGACY_SETTINGS_KEY_PREFIX = 'nexus_settings_';
const LEGACY_SETTINGS_KEY = 'nexus_settings';
const DEMO_USER_ID = 'demo';

const defaultSettings: AppSettings = {
  theme: 'dark',
  apiKeys: {},
  chartPreferences: {
    type: 'candlestick',
    indicators: ['RSI', 'MACD'],
    timeframe: '1D',
    showVolume: true,
  },
  notifications: {
    priceAlerts: true,
    signalAlerts: true,
    soundEnabled: false,
    browserNotifications: false,
  },
  trading: {
    defaultOrderType: 'market',
    confirmBeforeTrade: true,
    defaultStopLossPercent: 5,
    defaultTakeProfitPercent: 10,
    enableRiskGuardrails: true,
    maxPositionSizePercent: 25,
    maxDailyLossPercent: 5,
    maxOpenPositions: 8,
    warnOnConcentration: true,
  },
  ai: {
    enableAiAnalysis: true,
    autoAnalyzeOnView: false,
    showAiDisclaimer: true,
  },
};

export function getSettingsStorageKey(userId: string): string {
  return `${SETTINGS_KEY_PREFIX}${userId}`;
}

function getLegacyScopedSettingsStorageKey(userId: string): string {
  return `${LEGACY_SETTINGS_KEY_PREFIX}${userId}`;
}

function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id || DEMO_USER_ID;
}

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') return null;
  return localStorage;
}

function mergeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  return {
    ...defaultSettings,
    ...settings,
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...(settings?.apiKeys ?? {}),
    },
    chartPreferences: {
      ...defaultSettings.chartPreferences,
      ...(settings?.chartPreferences ?? {}),
    },
    notifications: {
      ...defaultSettings.notifications,
      ...(settings?.notifications ?? {}),
    },
    trading: {
      ...defaultSettings.trading,
      ...(settings?.trading ?? {}),
    },
    ai: {
      ...defaultSettings.ai,
      ...(settings?.ai ?? {}),
    },
  };
}

function parseStoredSettings(raw: string | null): Partial<AppSettings> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch { /* ignore */ }
  return null;
}

function loadSettingsForUser(userId: string = getCurrentUserId()): AppSettings {
  const storage = getStorage();
  if (!storage) return mergeSettings();

  const scopedSettings = parseStoredSettings(
    getItemWithMigration(
      getSettingsStorageKey(userId),
      [getLegacyScopedSettingsStorageKey(userId), LEGACY_SETTINGS_KEY],
      storage
    )
  );
  if (scopedSettings) {
    const merged = mergeSettings(scopedSettings);
    if (JSON.stringify(scopedSettings) !== JSON.stringify(merged)) {
      saveSettings(merged, userId);
    }
    return merged;
  }

  return mergeSettings();
}

function saveSettings(settings: AppSettings, userId: string = getCurrentUserId()) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(getSettingsStorageKey(userId), JSON.stringify(settings));
}

function mergePartialSettings(current: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...partial,
    apiKeys: {
      ...current.apiKeys,
      ...(partial.apiKeys ?? {}),
    },
    chartPreferences: {
      ...current.chartPreferences,
      ...(partial.chartPreferences ?? {}),
    },
    notifications: {
      ...current.notifications,
      ...(partial.notifications ?? {}),
    },
    trading: {
      ...current.trading,
      ...(partial.trading ?? {}),
    },
    ai: {
      ...current.ai,
      ...(partial.ai ?? {}),
    },
  };
}

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }
}

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setApiKey: (provider: 'gemini' | 'newsdata', config: ApiKeyConfig) => void;
  removeApiKey: (provider: 'gemini' | 'newsdata') => void;
  getGeminiKey: () => string | null;
  getNewsApiKey: () => string | null;
  hasGeminiKey: () => boolean;
  initTheme: () => void;
  loadUserSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettingsForUser(),

  updateSettings: (partial) => {
    const updated = mergePartialSettings(get().settings, partial);
    saveSettings(updated);
    set({ settings: updated });
  },

  setTheme: (theme) => {
    const updated = { ...get().settings, theme };
    saveSettings(updated);
    applyTheme(theme);
    set({ settings: updated });
  },

  setApiKey: (provider, config) => {
    const settings = get().settings;
    const updated = {
      ...settings,
      apiKeys: { ...settings.apiKeys, [provider]: config },
    };
    saveSettings(updated);
    set({ settings: updated });
  },

  removeApiKey: (provider) => {
    const settings = get().settings;
    const apiKeys = { ...settings.apiKeys };
    delete apiKeys[provider];
    const updated = { ...settings, apiKeys };
    saveSettings(updated);
    set({ settings: updated });
  },

  getGeminiKey: () => get().settings.apiKeys.gemini?.key || null,
  getNewsApiKey: () => get().settings.apiKeys.newsdata?.key || null,
  hasGeminiKey: () => !!get().settings.apiKeys.gemini?.key && get().settings.apiKeys.gemini?.isValid !== false,

  initTheme: () => {
    applyTheme(get().settings.theme);
  },

  loadUserSettings: () => {
    const settings = loadSettingsForUser();
    set({ settings });
    applyTheme(settings.theme);
  },
}));
