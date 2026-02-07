import { create } from 'zustand';
import type { User, AuditEntry, AuditAction } from '@/types';
import { getItemWithMigration } from '@/utils/storageMigration';
import { apiLogin, apiLogout, apiMe, apiRegister } from '@/services/backend/authApi';
import { isBackendEnabled, isBackendOn } from '@/services/backend/config';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function hashPasswordFallback(password: string): string {
  // Deterministic non-cryptographic fallback for insecure contexts (LAN HTTP on iOS).
  let hash = 0x811c9dc5;
  for (let i = 0; i < password.length; i += 1) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fallback_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function hashPassword(password: string): Promise<string> {
  if (!crypto?.subtle?.digest) {
    return hashPasswordFallback(password);
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return hashPasswordFallback(password);
  }
}

interface StoredUser extends User {
  passwordHash: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  auditLog: AuditEntry[];
  register: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  restoreSession: () => void;
  addAuditEntry: (action: AuditAction, details: string, metadata?: Record<string, unknown>) => void;
}

const USERS_KEY = 'hamafx_users';
const LEGACY_USERS_KEY = 'nexus_users';
const SESSION_KEY = 'hamafx_auth';
const LEGACY_SESSION_KEY = 'nexus_auth';
const AUDIT_KEY = 'hamafx_audit';
const LEGACY_AUDIT_KEY = 'nexus_audit';
const PORTFOLIO_KEY_PREFIX = 'hamafx_portfolio_';
const TRADES_KEY_PREFIX = 'hamafx_trades_';

function getPortfolioKey(userId: string): string {
  return `${PORTFOLIO_KEY_PREFIX}${userId}`;
}

function getTradesKey(userId: string): string {
  return `${TRADES_KEY_PREFIX}${userId}`;
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(getItemWithMigration(USERS_KEY, [LEGACY_USERS_KEY]) || '[]');
  } catch { return []; }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getAuditLog(): AuditEntry[] {
  try {
    return JSON.parse(getItemWithMigration(AUDIT_KEY, [LEGACY_AUDIT_KEY]) || '[]');
  } catch { return []; }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  auditLog: getAuditLog(),

  register: async (email, password, username) => {
    if (isBackendEnabled()) {
      try {
        const result = await apiRegister(email, password, username);
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
        set({ user: result.user, isAuthenticated: true });
        get().addAuditEntry('REGISTER', `User ${result.user.username} registered (backend)`);
        return { success: true };
      } catch (error) {
        if (isBackendOn()) {
          const message = error instanceof Error ? error.message : 'Backend registration failed';
          return { success: false, error: message };
        }
      }
    }

    try {
      const users = getUsers();
      if (users.find(u => u.email === email)) {
        return { success: false, error: 'Email already registered' };
      }
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();
      const newUser: StoredUser = {
        id: generateId(),
        email,
        username,
        passwordHash,
        createdAt: now,
        lastLoginAt: now,
      };
      users.push(newUser);
      saveUsers(users);
      const sessionUser: User = { ...newUser };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      set({ user: sessionUser, isAuthenticated: true });
      get().addAuditEntry('REGISTER', `User ${username} registered`);
      // Initialize portfolio
      localStorage.setItem(getPortfolioKey(newUser.id), JSON.stringify({
        userId: newUser.id,
        virtualBalance: 100000,
        totalDeposited: 100000,
        positions: [],
        orders: [],
        balanceHistory: [{ timestamp: now, totalValue: 100000, cashBalance: 100000 }],
      }));
      localStorage.setItem(getTradesKey(newUser.id), JSON.stringify([]));
      return { success: true };
    } catch {
      return { success: false, error: 'Registration failed on this browser. Please try again.' };
    }
  },

  login: async (email, password) => {
    if (isBackendEnabled()) {
      try {
        const result = await apiLogin(email, password);
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
        set({ user: result.user, isAuthenticated: true });
        get().addAuditEntry('LOGIN', `User ${result.user.username} logged in (backend)`);
        return { success: true };
      } catch (error) {
        if (isBackendOn()) {
          const message = error instanceof Error ? error.message : 'Backend login failed';
          return { success: false, error: message };
        }
      }
    }

    try {
      const users = getUsers();
      const user = users.find(u => u.email === email);
      if (!user) return { success: false, error: 'User not found' };
      const hash = await hashPassword(password);
      if (hash !== user.passwordHash) return { success: false, error: 'Invalid password' };
      user.lastLoginAt = new Date().toISOString();
      saveUsers(users);
      const sessionUser: User = { ...user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      set({ user: sessionUser, isAuthenticated: true });
      get().addAuditEntry('LOGIN', `User ${user.username} logged in`);
      return { success: true };
    } catch {
      return { success: false, error: 'Login failed on this browser. Please try again.' };
    }
  },

  logout: () => {
    if (isBackendEnabled()) {
      void apiLogout();
    }
    get().addAuditEntry('LOGOUT', 'User logged out');
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: () => {
    if (isBackendEnabled()) {
      const stored = getItemWithMigration(SESSION_KEY, [LEGACY_SESSION_KEY]);
      if (stored) {
        try {
          const cachedUser = JSON.parse(stored) as User;
          set({ user: cachedUser, isAuthenticated: true });
        } catch {
          // Ignore parse errors and continue with live check.
        }
      }

      void (async () => {
        try {
          const user = await apiMe();
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          set({ user, isAuthenticated: true });
        } catch {
          if (isBackendOn()) {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(LEGACY_SESSION_KEY);
            set({ user: null, isAuthenticated: false });
          }
        }
      })();
      return;
    }

    try {
      const stored = getItemWithMigration(SESSION_KEY, [LEGACY_SESSION_KEY]);
      if (stored) {
        const user = JSON.parse(stored) as User;
        set({ user, isAuthenticated: true });
      }
    } catch { /* ignore */ }
  },

  addAuditEntry: (action, details, metadata) => {
    const { user, auditLog } = get();
    const entry: AuditEntry = {
      id: generateId(),
      userId: user?.id || 'anonymous',
      action,
      details,
      metadata,
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...auditLog].slice(0, 1000);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(updated));
    set({ auditLog: updated });
  },
}));
