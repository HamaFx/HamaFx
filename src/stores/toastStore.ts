import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, title, message, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, title, message, duration, createdAt: Date.now() };
    
    set(state => ({
      toasts: [...state.toasts.slice(-4), toast], // max 5
    }));

    // Auto-remove
    setTimeout(() => {
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));
