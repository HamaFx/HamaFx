// Two-tier cache: L1 (in-memory) → L2 (localStorage) → API call
// Backend migration: swap this for RedisCacheService

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp ms
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const STORAGE_PREFIX = 'nexus_cache_';
const MAX_STORAGE_ENTRIES = 50; // Prevent localStorage bloat

export const cacheService = {
  get<T>(key: string): T | null {
    // L1: Memory
    const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.data;
    }
    if (memEntry) memoryCache.delete(key);

    // L2: localStorage
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (entry.expiresAt > Date.now()) {
          // Promote back to L1
          memoryCache.set(key, entry);
          return entry.data;
        }
        // Expired
        localStorage.removeItem(STORAGE_PREFIX + key);
      }
    } catch {
      // Ignore storage errors
    }

    return null;
  },

  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };

    // L1: Memory (always)
    memoryCache.set(key, entry as CacheEntry<unknown>);

    // L2: localStorage (for persistence across page reloads)
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
      this.evictOldEntries();
    } catch {
      // localStorage might be full — just use memory
    }
  },

  invalidate(key: string): void {
    memoryCache.delete(key);
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Ignore
    }
  },

  invalidatePattern(pattern: string): void {
    // Memory
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) memoryCache.delete(key);
    }
    // localStorage
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX) && key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore
    }
  },

  evictOldEntries(): void {
    try {
      const cacheKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          cacheKeys.push(key);
        }
      }
      if (cacheKeys.length > MAX_STORAGE_ENTRIES) {
        // Remove oldest entries
        const entries = cacheKeys.map(k => {
          try {
            const entry = JSON.parse(localStorage.getItem(k) || '{}');
            return { key: k, expiresAt: entry.expiresAt || 0 };
          } catch {
            return { key: k, expiresAt: 0 };
          }
        });
        entries.sort((a, b) => a.expiresAt - b.expiresAt);
        const toRemove = entries.slice(0, entries.length - MAX_STORAGE_ENTRIES);
        toRemove.forEach(e => localStorage.removeItem(e.key));
      }
    } catch {
      // Ignore
    }
  },

  clear(): void {
    memoryCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore
    }
  },

  // Get stale data (even if expired) — useful for fallback
  getStale<T>(key: string): T | null {
    const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry) return memEntry.data;

    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        return entry.data;
      }
    } catch {
      // Ignore
    }

    return null;
  },
};
