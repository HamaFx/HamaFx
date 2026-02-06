import { describe, expect, it } from 'vitest';
import { getStorageUsageBytes, getStorageUsageKb, safeJsonParse } from '@/utils/storage';

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

describe('storage utils', () => {
  it('parses json safely with fallback', () => {
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
    expect(safeJsonParse('{bad json', { ok: false })).toEqual({ ok: false });
    expect(safeJsonParse(null, { ok: false })).toEqual({ ok: false });
  });

  it('estimates storage usage from keys and values', () => {
    const storage = createStorageMock({
      a: '123',
      bb: '',
    });

    // chars: ("a" + "123") + ("bb" + "") = 1 + 3 + 2 + 0 = 6 => 12 bytes (UTF-16)
    expect(getStorageUsageBytes(storage)).toBe(12);
    expect(getStorageUsageKb(storage)).toBeCloseTo(12 / 1024, 8);
  });
});
