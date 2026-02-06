import { create } from 'zustand';
import type { Watchlist, WatchlistItem, AssetType } from '@/types';
import { useAuthStore } from '@/stores/authStore';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const WATCHLISTS_KEY = 'nexus_watchlists';

function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id || 'demo';
}

function loadAllWatchlists(): Watchlist[] {
  try {
    const stored = localStorage.getItem(WATCHLISTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function loadWatchlistsForUser(userId: string): Watchlist[] {
  return loadAllWatchlists().filter(w => w.userId === userId);
}

function saveWatchlistsForUser(userId: string, watchlists: Watchlist[]) {
  const all = loadAllWatchlists();
  const otherUsers = all.filter(w => w.userId !== userId);
  localStorage.setItem(WATCHLISTS_KEY, JSON.stringify([...otherUsers, ...watchlists]));
}

interface WatchlistState {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;

  loadWatchlists: () => void;
  createWatchlist: (name: string) => Watchlist;
  deleteWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  addSymbol: (watchlistId: string, symbol: string, assetType: AssetType) => void;
  removeSymbol: (watchlistId: string, symbol: string) => void;
  isInWatchlist: (symbol: string, watchlistId?: string) => boolean;
  toggleSymbol: (symbol: string, assetType: AssetType) => void;
  reorderSymbols: (watchlistId: string, symbols: WatchlistItem[]) => void;
  setActiveWatchlist: (id: string | null) => void;
  getDefaultWatchlist: () => Watchlist;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  watchlists: loadWatchlistsForUser(getCurrentUserId()),
  activeWatchlistId: null,

  loadWatchlists: () => {
    const userId = getCurrentUserId();
    const watchlists = loadWatchlistsForUser(userId);
    const activeWatchlistId = watchlists.some(w => w.id === get().activeWatchlistId) ? get().activeWatchlistId : null;
    set({ watchlists, activeWatchlistId });
  },

  createWatchlist: (name: string) => {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();
    const watchlist: Watchlist = {
      id: generateId(),
      userId,
      name,
      symbols: [],
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...get().watchlists, watchlist];
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
    useAuthStore.getState().addAuditEntry('WATCHLIST_MODIFIED', `Created watchlist "${name}"`);
    return watchlist;
  },

  deleteWatchlist: (id: string) => {
    const userId = getCurrentUserId();
    const updated = get().watchlists.filter(w => w.id !== id);
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
    useAuthStore.getState().addAuditEntry('WATCHLIST_MODIFIED', `Deleted watchlist`);
  },

  renameWatchlist: (id: string, name: string) => {
    const userId = getCurrentUserId();
    const updated = get().watchlists.map(w =>
      w.id === id ? { ...w, name, updatedAt: new Date().toISOString() } : w
    );
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
  },

  addSymbol: (watchlistId: string, symbol: string, assetType: AssetType) => {
    const userId = getCurrentUserId();
    const updated = get().watchlists.map(w => {
      if (w.id !== watchlistId) return w;
      if (w.symbols.some(s => s.symbol === symbol)) return w;
      return {
        ...w,
        symbols: [
          ...w.symbols,
          {
            symbol,
            assetType,
            addedAt: new Date().toISOString(),
            sortOrder: w.symbols.length,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
    useAuthStore.getState().addAuditEntry('WATCHLIST_MODIFIED', `Added ${symbol} to watchlist`);
  },

  removeSymbol: (watchlistId: string, symbol: string) => {
    const userId = getCurrentUserId();
    const updated = get().watchlists.map(w => {
      if (w.id !== watchlistId) return w;
      return {
        ...w,
        symbols: w.symbols.filter(s => s.symbol !== symbol),
        updatedAt: new Date().toISOString(),
      };
    });
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
    useAuthStore.getState().addAuditEntry('WATCHLIST_MODIFIED', `Removed ${symbol} from watchlist`);
  },

  isInWatchlist: (symbol: string, watchlistId?: string) => {
    const { watchlists } = get();
    if (watchlistId) {
      const wl = watchlists.find(w => w.id === watchlistId);
      return wl?.symbols.some(s => s.symbol === symbol) || false;
    }
    return watchlists.some(w => w.symbols.some(s => s.symbol === symbol));
  },

  toggleSymbol: (symbol: string, assetType: AssetType) => {
    const state = get();
    let defaultWl = state.getDefaultWatchlist();
    if (defaultWl.symbols.some(s => s.symbol === symbol)) {
      state.removeSymbol(defaultWl.id, symbol);
    } else {
      state.addSymbol(defaultWl.id, symbol, assetType);
    }
  },

  reorderSymbols: (watchlistId: string, symbols: WatchlistItem[]) => {
    const userId = getCurrentUserId();
    const updated = get().watchlists.map(w =>
      w.id === watchlistId ? { ...w, symbols, updatedAt: new Date().toISOString() } : w
    );
    saveWatchlistsForUser(userId, updated);
    set({ watchlists: updated });
  },

  setActiveWatchlist: (id: string | null) => {
    set({ activeWatchlistId: id });
  },

  getDefaultWatchlist: () => {
    const { watchlists, createWatchlist } = get();
    if (watchlists.length === 0) {
      return createWatchlist('My Watchlist');
    }
    return watchlists[0];
  },
}));
