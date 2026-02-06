// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { getChatStorageKey, useChatStore } from '@/stores/chatStore';

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

describe('chatStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    setTestUser(null);
    useChatStore.setState({ messages: [], isLoading: false, isOpen: false });
    useChatStore.getState().loadMessages();
  });

  it('isolates chat history by user', () => {
    setTestUser('alice');
    useChatStore.getState().loadMessages();
    useChatStore.getState().addMessage('user', 'alice-message');
    expect(useChatStore.getState().messages).toHaveLength(1);

    setTestUser('bob');
    useChatStore.getState().loadMessages();
    expect(useChatStore.getState().messages).toHaveLength(0);
    useChatStore.getState().addMessage('user', 'bob-message');

    setTestUser('alice');
    useChatStore.getState().loadMessages();
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe('alice-message');
  });

  it('persists clearHistory for current user only', () => {
    setTestUser('alice');
    useChatStore.getState().addMessage('user', 'hello');
    expect(JSON.parse(localStorage.getItem(getChatStorageKey('alice')) || '[]')).toHaveLength(1);

    useChatStore.getState().clearHistory();
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(getChatStorageKey('alice')) || '[]')).toHaveLength(0);
  });
});
