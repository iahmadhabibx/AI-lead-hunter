import { create } from 'zustand';
import type {
  CandidateProfilePayload,
  ProfileVersionPublic,
} from '@aijh/contracts';
import { apiFetch } from '@/lib/api';

export type ProfileResponse = {
  profileId: string | null;
  activeVersion: ProfileVersionPublic | null;
  pendingVersion: ProfileVersionPublic | null;
};

type ProfileState = {
  data: ProfileResponse | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  success: string | null;
  clearMessages: () => void;
  reset: () => void;
  load: () => Promise<ProfileResponse>;
  saveDraft: (payload: CandidateProfilePayload) => Promise<void>;
  approve: () => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set) => ({
  data: null,
  loading: false,
  pending: false,
  error: null,
  success: null,

  clearMessages: () => set({ error: null, success: null }),

  reset: () =>
    set({
      data: null,
      loading: false,
      pending: false,
      error: null,
      success: null,
    }),

  load: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await apiFetch<ProfileResponse>('/profile');
      set({ data: profile, loading: false });
      return profile;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load profile',
      });
      throw err;
    }
  },

  saveDraft: async (payload) => {
    set({ pending: true, error: null, success: null });
    try {
      await apiFetch('/profile/draft', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const profile = await apiFetch<ProfileResponse>('/profile');
      set({
        data: profile,
        pending: false,
        success: 'Draft saved. Review carefully before approving.',
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Save failed',
      });
      throw err;
    }
  },

  approve: async () => {
    set({ pending: true, error: null, success: null });
    try {
      await apiFetch('/profile/approve', { method: 'POST' });
      const profile = await apiFetch<ProfileResponse>('/profile');
      set({
        data: profile,
        pending: false,
        success: 'Profile approved. This version is now immutable and active.',
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Approve failed',
      });
      throw err;
    }
  },
}));
