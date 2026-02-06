export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Approximate localStorage usage in bytes (UTF-16 chars => 2 bytes per char).
export function getStorageUsageBytes(storage: Storage = localStorage): number {
  let chars = 0;

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const value = storage.getItem(key) ?? '';
    chars += key.length + value.length;
  }

  return chars * 2;
}

export function getStorageUsageKb(storage: Storage = localStorage): number {
  return getStorageUsageBytes(storage) / 1024;
}
