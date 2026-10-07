import { create } from 'zustand';
import type { HistoryEntry } from './lib/types';
import { listHistory, saveHistory, deleteHistory, clearHistory } from './lib/history';

/** Global app state: theme, toasts and the history cache. */

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;

  history: HistoryEntry[];
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
  addHistory: (entry: HistoryEntry) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  wipeHistory: () => Promise<void>;
}

const THEME_KEY = 'codeforge:theme';

function initialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* Storage can be blocked; fall through to the system preference. */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

let toastSeq = 0;

export const useApp = create<AppState>((set, get) => ({
  theme: 'dark',

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },

  toasts: [],

  notify: (message, tone = 'info') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 3200);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  history: [],
  historyLoaded: false,

  loadHistory: async () => {
    const entries = await listHistory();
    set({ history: entries, historyLoaded: true });
  },

  addHistory: async (entry) => {
    set((s) => ({ history: [entry, ...s.history.filter((e) => e.id !== entry.id)] }));
    await saveHistory(entry);
  },

  removeHistory: async (id) => {
    set((s) => ({ history: s.history.filter((e) => e.id !== id) }));
    await deleteHistory(id);
  },

  toggleFavorite: async (id) => {
    const entry = get().history.find((e) => e.id === id);
    if (!entry) return;
    const updated = { ...entry, favorite: !entry.favorite };
    set((s) => ({ history: s.history.map((e) => (e.id === id ? updated : e)) }));
    await saveHistory(updated);
  },

  wipeHistory: async () => {
    set({ history: [] });
    await clearHistory();
  },
}));

/** Called once at startup, before React paints, to avoid a theme flash. */
export function bootstrapTheme() {
  const theme = initialTheme();
  applyTheme(theme);
  useApp.setState({ theme });
}
