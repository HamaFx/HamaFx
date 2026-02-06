import { create } from 'zustand';
import type { Alert, AssetType } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { showToast } from '@/components/ui/ToastContainer';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const ALERTS_KEY = 'nexus_alerts';

function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id || 'demo';
}

function loadAllAlerts(): Alert[] {
  try {
    const stored = localStorage.getItem(ALERTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function loadAlertsForUser(userId: string): Alert[] {
  return loadAllAlerts().filter(a => a.userId === userId);
}

function saveAlertsForUser(userId: string, alerts: Alert[]) {
  const all = loadAllAlerts();
  const otherUsers = all.filter(a => a.userId !== userId);
  localStorage.setItem(ALERTS_KEY, JSON.stringify([...otherUsers, ...alerts]));
}

interface AlertState {
  alerts: Alert[];
  loadAlerts: () => void;
  createAlert: (params: {
    symbol: string;
    assetType: AssetType;
    type: Alert['type'];
    targetValue: number;
    currentValue?: number;
  }) => Alert;
  deleteAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  checkAlerts: (prices: Record<string, number>) => void;
  getActiveAlerts: () => Alert[];
  getTriggeredAlerts: () => Alert[];
  clearTriggered: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: loadAlertsForUser(getCurrentUserId()),

  loadAlerts: () => {
    const userId = getCurrentUserId();
    set({ alerts: loadAlertsForUser(userId) });
  },

  createAlert: (params) => {
    const userId = getCurrentUserId();
    const alert: Alert = {
      id: generateId(),
      userId,
      symbol: params.symbol,
      assetType: params.assetType,
      type: params.type,
      targetValue: params.targetValue,
      currentValue: params.currentValue,
      isTriggered: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      notificationSent: false,
    };
    const updated = [alert, ...get().alerts];
    saveAlertsForUser(userId, updated);
    set({ alerts: updated });
    useAuthStore.getState().addAuditEntry('ALERT_CREATED', `Alert: ${params.symbol} ${params.type} ${params.targetValue}`);
    return alert;
  },

  deleteAlert: (id: string) => {
    const userId = getCurrentUserId();
    const updated = get().alerts.filter(a => a.id !== id);
    saveAlertsForUser(userId, updated);
    set({ alerts: updated });
  },

  toggleAlert: (id: string) => {
    const userId = getCurrentUserId();
    const updated = get().alerts.map(a =>
      a.id === id ? { ...a, isActive: !a.isActive } : a
    );
    saveAlertsForUser(userId, updated);
    set({ alerts: updated });
  },

  checkAlerts: (prices: Record<string, number>) => {
    const notificationSettings = useSettingsStore.getState().settings.notifications;
    if (!notificationSettings.priceAlerts) return;

    const { alerts } = get();
    let changed = false;
    const updated = alerts.map(alert => {
      if (!alert.isActive || alert.isTriggered) return alert;

      const currentPrice = prices[alert.symbol.toLowerCase()] || prices[alert.symbol];
      if (!currentPrice) return { ...alert, currentValue: alert.currentValue };

      let triggered = false;
      switch (alert.type) {
        case 'price_above':
          triggered = currentPrice >= alert.targetValue;
          break;
        case 'price_below':
          triggered = currentPrice <= alert.targetValue;
          break;
        case 'percent_change':
          if (alert.currentValue) {
            const pctChange = Math.abs((currentPrice - alert.currentValue) / alert.currentValue * 100);
            triggered = pctChange >= alert.targetValue;
          }
          break;
      }

      if (triggered) {
        changed = true;
        if (notificationSettings.signalAlerts) {
          showToast('warning', `🔔 Alert Triggered`, `${alert.symbol} ${alert.type.replace('_', ' ')} $${alert.targetValue}`, 6000);
        }

        // Browser notification
        if (
          notificationSettings.browserNotifications &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(`NexusTrade Alert`, {
            body: `${alert.symbol} has ${alert.type.replace('_', ' ')} $${alert.targetValue}`,
            icon: '/favicon.ico',
          });
        }

        useAuthStore.getState().addAuditEntry('ALERT_TRIGGERED', `${alert.symbol} ${alert.type} $${alert.targetValue} triggered at $${currentPrice.toFixed(2)}`);

        return {
          ...alert,
          isTriggered: true,
          triggeredAt: new Date().toISOString(),
          notificationSent: true,
          currentValue: currentPrice,
        };
      }

      return { ...alert, currentValue: currentPrice };
    });

    if (changed) {
      saveAlertsForUser(getCurrentUserId(), updated);
      set({ alerts: updated });
    }
  },

  getActiveAlerts: () => get().alerts.filter(a => a.isActive && !a.isTriggered),
  getTriggeredAlerts: () => get().alerts.filter(a => a.isTriggered),

  clearTriggered: () => {
    const userId = getCurrentUserId();
    const updated = get().alerts.filter(a => !a.isTriggered);
    saveAlertsForUser(userId, updated);
    set({ alerts: updated });
  },
}));
