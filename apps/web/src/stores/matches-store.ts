import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export type SourceStatus = {
  key: string;
  provider: string;
  enabled: boolean;
  unavailableReason: string | null;
  isGlobalSearch: boolean;
  persistence: {
    lastHealthOk: boolean;
    lastIngestAt: string | null;
    lastIngestError: string | null;
  } | null;
};

export type MatchListItem = {
  id: string;
  band: string;
  suitabilityPercent: number | null;
  scoringVersion: string;
  canonicalJobId: string;
  job: {
    title: string;
    companyName: string | null;
    locationText: string | null;
    workMode: string;
    applyUrl: string;
    status: string;
  } | null;
  updatedAt: string;
};

export type MatchDetail = {
  id: string;
  band: string;
  suitabilityPercent: number | null;
  scoringVersion: string;
  canonicalJobId: string;
  breakdown: {
    hardFilters?: Array<{ id: string; passed: boolean; reason: string }>;
    components?: Array<{
      id: string;
      score: number | null;
      status: string;
      explanation: string;
    }>;
    evidence?: Array<{ kind: string; message: string }>;
    missingRequirements?: string[];
    disclaimer?: string;
  };
  job: {
    id: string;
    title: string;
    companyName: string | null;
    locationText: string | null;
    workMode: string;
    applyUrl: string;
    status: string;
    sourceAttribution: string;
  } | null;
};

type TaskResponse = {
  id: string;
  status: string;
  errorMessage: string | null;
};

type MatchesState = {
  sources: SourceStatus[];
  catalogCount: number;
  catalogNote: string | null;
  matches: MatchListItem[];
  scoringNote: string | null;
  selected: MatchDetail | null;
  savedIds: string[];
  loading: boolean;
  pending: boolean;
  error: string | null;
  success: string | null;
  clearMessages: () => void;
  loadSources: () => Promise<void>;
  loadMatches: () => Promise<void>;
  loadSaved: () => Promise<void>;
  bootstrap: () => Promise<void>;
  discover: () => Promise<void>;
  runMatch: (limit?: number) => Promise<void>;
  loadMatchDetail: (id: string) => Promise<void>;
  clearSelected: () => void;
  saveJob: (canonicalJobId: string, matchResultId?: string) => Promise<void>;
  rejectJob: (
    canonicalJobId: string,
    matchResultId: string | undefined,
    reason: string,
  ) => Promise<void>;
};

async function pollTask(taskId: string): Promise<TaskResponse> {
  // Large public boards (e.g. Stripe) can take several minutes to ingest.
  for (let i = 0; i < 360; i++) {
    const task = await apiFetch<TaskResponse>(`/tasks/${taskId}`);
    if (task.status === 'succeeded' || task.status === 'failed') {
      return task;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timed out waiting for background task');
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  sources: [],
  catalogCount: 0,
  catalogNote: null,
  matches: [],
  scoringNote: null,
  selected: null,
  savedIds: [],
  loading: false,
  pending: false,
  error: null,
  success: null,

  clearMessages: () => set({ error: null, success: null }),

  loadSources: async () => {
    const data = await apiFetch<{
      sources: SourceStatus[];
      catalog: { canonicalJobCount: number; note: string };
    }>('/sources');
    set({
      sources: data.sources,
      catalogCount: data.catalog.canonicalJobCount,
      catalogNote: data.catalog.note,
    });
  },

  loadMatches: async () => {
    const data = await apiFetch<{
      scoringNote: string;
      matches: MatchListItem[];
    }>('/matches?limit=50');
    set({ matches: data.matches, scoringNote: data.scoringNote });
  },

  loadSaved: async () => {
    const data = await apiFetch<{
      saved: Array<{ canonicalJobId: string }>;
    }>('/saved-jobs');
    set({ savedIds: data.saved.map((s) => s.canonicalJobId) });
  },

  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().loadSources(),
        get().loadMatches(),
        get().loadSaved(),
      ]);
      set({ loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load matches',
      });
      throw err;
    }
  },

  discover: async () => {
    set({ pending: true, error: null, success: null });
    try {
      const queued = await apiFetch<{ taskId: string; status: string }>(
        '/sources/discover',
        { method: 'POST' },
      );
      const task = await pollTask(queued.taskId);
      if (task.status === 'failed') {
        throw new Error(task.errorMessage || 'Job discovery failed');
      }
      await get().loadSources();
      set({
        pending: false,
        success: 'Job discovery finished. Run matching to score against your profile.',
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Discovery failed',
      });
      throw err;
    }
  },

  runMatch: async (limit = 100) => {
    set({ pending: true, error: null, success: null });
    try {
      const queued = await apiFetch<{ taskId: string; status: string }>(
        `/matches/run?limit=${limit}`,
        { method: 'POST' },
      );
      const task = await pollTask(queued.taskId);
      if (task.status === 'failed') {
        throw new Error(task.errorMessage || 'Matching failed');
      }
      await get().loadMatches();
      set({
        pending: false,
        success: 'Matching complete. Scores are suitability weights — not hiring odds.',
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Matching failed',
      });
      throw err;
    }
  },

  loadMatchDetail: async (id) => {
    set({ error: null });
    try {
      const detail = await apiFetch<MatchDetail>(`/matches/${id}`);
      set({ selected: detail });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load match detail',
      });
      throw err;
    }
  },

  clearSelected: () => set({ selected: null }),

  saveJob: async (canonicalJobId, matchResultId) => {
    set({ pending: true, error: null });
    try {
      await apiFetch('/saved-jobs', {
        method: 'POST',
        body: JSON.stringify({ canonicalJobId, matchResultId }),
      });
      const savedIds = get().savedIds.includes(canonicalJobId)
        ? get().savedIds
        : [...get().savedIds, canonicalJobId];
      set({ pending: false, savedIds, success: 'Job saved.' });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Save failed',
      });
      throw err;
    }
  },

  rejectJob: async (canonicalJobId, matchResultId, reason) => {
    set({ pending: true, error: null });
    try {
      await apiFetch('/matches/reject', {
        method: 'POST',
        body: JSON.stringify({
          canonicalJobId,
          matchResultId,
          type: 'rejected',
          rejectionReasons: [reason],
        }),
      });
      set({
        pending: false,
        success: 'Rejection recorded for preference learning.',
        matches: get().matches.filter((m) => m.canonicalJobId !== canonicalJobId),
        selected:
          get().selected?.canonicalJobId === canonicalJobId
            ? null
            : get().selected,
      });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Reject failed',
      });
      throw err;
    }
  },
}));
