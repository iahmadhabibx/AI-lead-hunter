import { create } from 'zustand';
import { apiFetch, apiUpload } from '@/lib/api';

export type CvTask = {
  id: string;
  status: string;
  errorMessage: string | null;
};

export type CvDocument = {
  id: string;
  status: string;
  errorMessage: string | null;
  originalFilename: string;
};

type UploadResponse = {
  documentId: string;
  taskId: string;
  status: string;
};

type CvState = {
  task: CvTask | null;
  doc: CvDocument | null;
  pending: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
  upload: (file: File) => Promise<void>;
  refreshStatus: () => Promise<void>;
  /** Upload then poll until processing succeeds or fails. */
  uploadAndWait: (file: File) => Promise<'succeeded' | 'failed'>;
};

export const useCvStore = create<CvState>((set, get) => ({
  task: null,
  doc: null,
  pending: false,
  error: null,

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  reset: () =>
    set({
      task: null,
      doc: null,
      pending: false,
      error: null,
    }),

  upload: async (file) => {
    set({
      pending: true,
      error: null,
      task: null,
      doc: null,
    });
    try {
      const uploaded = await apiUpload<UploadResponse>('/cv/uploads', file);
      const doc = await apiFetch<CvDocument>(
        `/cv/documents/${uploaded.documentId}`,
      );
      const task = await apiFetch<CvTask>(`/tasks/${uploaded.taskId}`);
      set({ doc, task, pending: false });
    } catch (err) {
      set({
        pending: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      });
      throw err;
    }
  },

  refreshStatus: async () => {
    const { task, doc } = get();
    if (!task) return;
    try {
      const next = await apiFetch<CvTask>(`/tasks/${task.id}`);
      let nextDoc = doc;
      if (doc) {
        nextDoc = await apiFetch<CvDocument>(`/cv/documents/${doc.id}`);
      }
      set({ task: next, doc: nextDoc });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Status poll failed',
      });
      throw err;
    }
  },

  uploadAndWait: async (file) => {
    await get().upload(file);
    for (let i = 0; i < 180; i++) {
      await get().refreshStatus();
      const status = get().task?.status;
      if (status === 'succeeded') return 'succeeded';
      if (status === 'failed') {
        throw new Error(
          get().task?.errorMessage ||
            get().doc?.errorMessage ||
            'CV processing failed',
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timed out waiting for CV processing');
  },
}));
