import { create } from 'zustand';
import { useAuthStore } from '@/stores/authStore';
import { getItemWithMigration } from '@/utils/storageMigration';
import type { AiModelSource } from '@/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: string; // what page/asset the user was on
  followUps?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  source?: AiModelSource | 'rule-based' | 'backend';
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;

  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    context?: string,
    metadata?: Pick<ChatMessage, 'followUps' | 'riskLevel' | 'source'>
  ) => void;
  setLoading: (v: boolean) => void;
  clearHistory: () => void;
  loadMessages: () => void;
}

const CHAT_KEY_PREFIX = 'hamafx_chat_';
const LEGACY_CHAT_KEY_PREFIX = 'nexustrade-chat_';
const LEGACY_SHARED_CHAT_KEY = 'nexus_chat';
const DEMO_USER_ID = 'demo';
const MAX_MESSAGES = 50;

export function getChatStorageKey(userId: string): string {
  return `${CHAT_KEY_PREFIX}${userId}`;
}

function getLegacyChatStorageKey(userId: string): string {
  return `${LEGACY_CHAT_KEY_PREFIX}${userId}`;
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

    const stored = getItemWithMigration(
      getChatStorageKey(userId),
      [getLegacyChatStorageKey(userId), LEGACY_SHARED_CHAT_KEY],
      storage
    );
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
      .map((msg) => ({
        ...msg,
        followUps: Array.isArray(msg.followUps)
          ? msg.followUps.filter((item) => typeof item === 'string').slice(0, 4)
          : undefined,
        riskLevel: msg.riskLevel === 'low' || msg.riskLevel === 'medium' || msg.riskLevel === 'high'
          ? msg.riskLevel
          : undefined,
        source: msg.source === 'gemini' || msg.source === 'groq' || msg.source === 'scitely' || msg.source === 'rule-based' || msg.source === 'backend'
          ? msg.source
          : undefined,
      }))
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

  addMessage: (role, content, context, metadata) =>
    set((s) => {
      const messages = [
        ...s.messages,
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          role,
          content,
          timestamp: Date.now(),
          context,
          ...(metadata ?? {}),
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
