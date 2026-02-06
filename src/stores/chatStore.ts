import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: string; // what page/asset the user was on
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;

  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (role: 'user' | 'assistant', content: string, context?: string) => void;
  setLoading: (v: boolean) => void;
  clearHistory: () => void;
  loadMessages: () => void;
}

const CHAT_KEY_PREFIX = 'nexustrade-chat_';
const DEMO_USER_ID = 'demo';
const MAX_MESSAGES = 50;

export function getChatStorageKey(userId: string): string {
  return `${CHAT_KEY_PREFIX}${userId}`;
}

function getCurrentUserId(): string {
  return useAuthStore.getState().user?.id || DEMO_USER_ID;
}

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') return null;
  return localStorage;
}

function loadMessagesFromStorage(userId: string = getCurrentUserId()): ChatMessage[] {
  try {
    const storage = getStorage();
    if (!storage) return [];

    const stored = storage.getItem(getChatStorageKey(userId));
    if (!stored) return [];

    const parsed = JSON.parse(stored) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((msg) =>
        typeof msg?.id === 'string' &&
        (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') &&
        typeof msg.content === 'string' &&
        typeof msg.timestamp === 'number'
      )
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[], userId: string = getCurrentUserId()) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(getChatStorageKey(userId), JSON.stringify(messages.slice(-MAX_MESSAGES)));
}

export const useChatStore = create<ChatState>((set) => ({
  messages: loadMessagesFromStorage(),
  isOpen: false,
  isLoading: false,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  addMessage: (role, content, context) =>
    set((s) => {
      const messages = [
        ...s.messages,
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          role,
          content,
          timestamp: Date.now(),
          context,
        },
      ].slice(-MAX_MESSAGES);
      saveMessages(messages);
      return { messages };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  clearHistory: () => {
    saveMessages([]);
    set({ messages: [] });
  },

  loadMessages: () => {
    set({ messages: loadMessagesFromStorage() });
  },
}));
