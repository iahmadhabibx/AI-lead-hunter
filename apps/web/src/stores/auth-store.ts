import { create } from 'zustand';
import type { UserPublic } from '@aijh/contracts';
import { apiFetch } from '@/lib/api';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  user: UserPublic | null;
  status: AuthStatus;
  error: string | null;
  pending: boolean;
  clearError: () => void;
  fetchMe: () => Promise<UserPublic | null>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,
  pending: false,

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      user: null,
      status: 'idle',
      error: null,
      pending: false,
    }),

  fetchMe: async () => {
    set({ status: 'loading', error: null });
    try {
      const data = await apiFetch<{ user: UserPublic }>('/auth/me');
      set({ user: data.user, status: 'authenticated' });
      return data.user;
    } catch {
      set({ user: null, status: 'unauthenticated' });
      return null;
    }
  },

  login: async (email, password) => {
    set({ pending: true, error: null });
    try {
      const data = await apiFetch<{ user: UserPublic }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      set({
        user: data.user,
        status: 'authenticated',
        pending: false,
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Sign-in failed',
      });
      throw err;
    }
  },

  register: async (input) => {
    set({ pending: true, error: null });
    try {
      const data = await apiFetch<{ user: UserPublic }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      set({
        user: data.user,
        status: 'authenticated',
        pending: false,
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Registration failed',
      });
      throw err;
    }
  },

  logout: async () => {
    set({ pending: true, error: null });
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
      set({
        user: null,
        status: 'unauthenticated',
        pending: false,
        error: null,
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Logout failed',
      });
      throw err;
    }
  },
}));
