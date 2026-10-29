import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

type TaskResponse = {
  id: string;
  status: string;
  errorMessage: string | null;
};

type ApplicationsState = {
  pending: boolean;
  error: string | null;
  lastApplicationId: string | null;
  lastDocumentIds: string[];
  clearError: () => void;
  createAndGenerateDrafts: (input: {
    canonicalJobId: string;
    matchResultId?: string;
  }) => Promise<{ applicationId: string; documentIds: string[] }>;
};

async function pollTask(taskId: string): Promise<TaskResponse> {
  for (let i = 0; i < 180; i++) {
    const task = await apiFetch<TaskResponse>(`/tasks/${taskId}`);
    if (task.status === 'succeeded' || task.status === 'failed') return task;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Timed out waiting for draft generation');
}

export const useApplicationsStore = create<ApplicationsState>((set) => ({
  pending: false,
  error: null,
  lastApplicationId: null,
  lastDocumentIds: [],

  clearError: () => set({ error: null }),

  createAndGenerateDrafts: async ({ canonicalJobId, matchResultId }) => {
    set({ pending: true, error: null });
    try {
      const created = await apiFetch<{ id: string }>('/applications', {
        method: 'POST',
        body: JSON.stringify({ canonicalJobId, matchResultId }),
      });
      const gen = await apiFetch<{ taskId: string }>('/applications/generate', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: created.id,
          types: ['tailored_cv', 'cover_letter'],
        }),
      });
      const task = await pollTask(gen.taskId);
      if (task.status === 'failed') {
        throw new Error(task.errorMessage || 'Draft generation failed');
      }
      const detail = await apiFetch<{
        documents: Array<{ id: string; type: string }>;
      }>(`/applications/${created.id}`);
      const documentIds = detail.documents.map((d) => d.id);
      set({
        pending: false,
        lastApplicationId: created.id,
        lastDocumentIds: documentIds,
      });
      return { applicationId: created.id, documentIds };
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Draft generation failed',
      });
      throw err;
    }
  },
}));
