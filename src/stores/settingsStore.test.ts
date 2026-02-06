// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { getSettingsStorageKey, useSettingsStore } from '@/stores/settingsStore';

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function setTestUser(id: string | null) {
  useAuthStore.setState({
    user: id
      ? {
          id,
          email: `${id}@test.local`,
          username: id,
          passwordHash: 'hash',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: '2026-01-01T00:00:00.000Z',
        }
      : null,
    isAuthenticated: !!id,
  });
}

describe('settingsStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    setTestUser(null);
    useSettingsStore.getState().loadUserSettings();
  });

  it('loads user-scoped settings per active account', () => {
    localStorage.setItem(getSettingsStorageKey('alice'), JSON.stringify({
      theme: 'light',
      notifications: { signalAlerts: false },
    }));
    localStorage.setItem(getSettingsStorageKey('bob'), JSON.stringify({
      theme: 'dark',
      notifications: { signalAlerts: true },
    }));

    setTestUser('alice');
    useSettingsStore.getState().loadUserSettings();
    expect(useSettingsStore.getState().settings.theme).toBe('light');
    expect(useSettingsStore.getState().settings.notifications.signalAlerts).toBe(false);

    setTestUser('bob');
    useSettingsStore.getState().loadUserSettings();
    expect(useSettingsStore.getState().settings.theme).toBe('dark');
    expect(useSettingsStore.getState().settings.notifications.signalAlerts).toBe(true);
  });

  it('merges stored partial settings with defaults', () => {
    setTestUser('merge-user');
    localStorage.setItem(getSettingsStorageKey('merge-user'), JSON.stringify({
      notifications: { signalAlerts: false },
      trading: { defaultOrderType: 'limit' },
    }));

    useSettingsStore.getState().loadUserSettings();
    const settings = useSettingsStore.getState().settings;

    expect(settings.notifications.signalAlerts).toBe(false);
    expect(settings.notifications.priceAlerts).toBe(true);
    expect(settings.notifications.browserNotifications).toBe(false);
    expect(settings.trading.defaultOrderType).toBe('limit');
    expect(settings.trading.enableRiskGuardrails).toBe(true);
    expect(settings.trading.maxPositionSizePercent).toBe(25);
    expect(settings.trading.maxDailyLossPercent).toBe(5);
    expect(settings.trading.maxOpenPositions).toBe(8);
    expect(settings.trading.warnOnConcentration).toBe(true);
  });

  it('migrates legacy shared settings key into user-scoped key', () => {
    setTestUser('migrate-user');
    localStorage.setItem('nexus_settings', JSON.stringify({
      theme: 'light',
      notifications: { soundEnabled: true },
      trading: { confirmBeforeTrade: false },
    }));

    useSettingsStore.getState().loadUserSettings();
    expect(useSettingsStore.getState().settings.theme).toBe('light');

    const migrated = JSON.parse(localStorage.getItem(getSettingsStorageKey('migrate-user')) || '{}');
    expect(migrated.theme).toBe('light');
    expect(migrated.notifications.soundEnabled).toBe(true);
    expect(migrated.trading.confirmBeforeTrade).toBe(false);
    expect(migrated.trading.enableRiskGuardrails).toBe(true);
    expect(migrated.trading.maxPositionSizePercent).toBe(25);
    expect(migrated.trading.maxDailyLossPercent).toBe(5);
    expect(migrated.trading.maxOpenPositions).toBe(8);
    expect(migrated.trading.warnOnConcentration).toBe(true);
  });
});
