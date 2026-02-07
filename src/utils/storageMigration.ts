function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') return null;
  return localStorage;
}

export function getItemWithMigration(
  key: string,
  legacyKeys: string[] = [],
  storageOverride?: Storage | null
): string | null {
  const storage = resolveStorage(storageOverride);
  if (!storage) return null;

  const current = storage.getItem(key);
  if (current !== null) return current;

  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null) continue;

    // One-time migration: copy legacy value into the new canonical key.
    try {
      storage.setItem(key, legacyValue);
    } catch {
      // Ignore quota/storage errors and still return the legacy value.
    }
    return legacyValue;
  }

  return null;
}
