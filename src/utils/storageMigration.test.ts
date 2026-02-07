import { describe, expect, it } from 'vitest';
import { getItemWithMigration } from '@/utils/storageMigration';

function createStorageMock(seed: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(seed));
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

describe('storageMigration', () => {
  it('prefers canonical key when both canonical and legacy exist', () => {
    const storage = createStorageMock({
      hamafx_key: 'new-value',
      nexus_key: 'legacy-value',
    });

    const value = getItemWithMigration('hamafx_key', ['nexus_key'], storage);
    expect(value).toBe('new-value');
    expect(storage.getItem('hamafx_key')).toBe('new-value');
  });

  it('migrates legacy value into canonical key when canonical key is absent', () => {
    const storage = createStorageMock({
      nexus_key: 'legacy-value',
    });

    const value = getItemWithMigration('hamafx_key', ['nexus_key'], storage);
    expect(value).toBe('legacy-value');
    expect(storage.getItem('hamafx_key')).toBe('legacy-value');
  });

  it('returns null when no canonical or legacy keys exist', () => {
    const storage = createStorageMock();
    const value = getItemWithMigration('hamafx_key', ['nexus_key'], storage);
    expect(value).toBeNull();
  });
});
