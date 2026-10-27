'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/api';

type UploadResponse = {
  documentId: string;
  taskId: string;
  status: string;
};

type TaskResponse = {
  id: string;
  status: string;
  errorMessage: string | null;
};

type DocResponse = {
  id: string;
  status: string;
  errorMessage: string | null;
  originalFilename: string;
};

export default function CvUploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [doc, setDoc] = useState<DocResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiFetch('/auth/me');
      } catch {
        if (!cancelled) router.replace('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!task || task.status === 'succeeded' || task.status === 'failed') return;
    const id = task.id;
    const handle = setInterval(async () => {
      try {
        const next = await apiFetch<TaskResponse>(`/tasks/${id}`);
        setTask(next);
        if (doc) {
          const d = await apiFetch<DocResponse>(`/cv/documents/${doc.id}`);
          setDoc(d);
        }
        if (next.status === 'succeeded') {
          clearInterval(handle);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Status poll failed');
        clearInterval(handle);
      }
    }, 1000);
    return () => clearInterval(handle);
  }, [task, doc]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    setTask(null);
    setDoc(null);
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a PDF or DOCX file');
      setPending(false);
      return;
    }
    try {
      const uploaded = await apiUpload<UploadResponse>('/cv/uploads', file);
      const d = await apiFetch<DocResponse>(`/cv/documents/${uploaded.documentId}`);
      const t = await apiFetch<TaskResponse>(`/tasks/${uploaded.taskId}`);
      setDoc(d);
      setTask(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPending(false);
    }
  }

  const done = task?.status === 'succeeded';
  const failed = task?.status === 'failed' || doc?.status === 'failed';

  return (
    <main className="shell dashboard">
      <header className="site-header">
        <Link className="brand" href="/app">
          ForgePath
        </Link>
        <Link className="btn btn-secondary" href="/app/profile">
          Profile
        </Link>
      </header>
      <h1>Upload your CV</h1>
      <p className="muted">PDF or DOCX only. Content is validated server-side.</p>

      <form className="form panel" style={{ margin: '1.5rem 0' }} onSubmit={onSubmit}>
        <label>
          CV file
          <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required disabled={pending} />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? 'Uploading…' : 'Upload and process'}
        </button>
      </form>

      {task ? (
        <div className="empty" aria-live="polite">
          <p>
            Document: <strong>{doc?.originalFilename ?? '—'}</strong>
          </p>
          <p>
            Processing status: <strong>{task.status}</strong>
            {doc ? ` (file: ${doc.status})` : null}
          </p>
          {failed ? (
            <p className="form-error" role="alert">
              {task.errorMessage || doc?.errorMessage || 'Processing failed'}
            </p>
          ) : null}
          {done ? (
            <p className="form-success">
              Extraction complete.{' '}
              <Link href="/app/profile">Review your profile</Link>
            </p>
          ) : null}
          {!done && !failed ? <p className="muted">Extracting and structuring your CV…</p> : null}
        </div>
      ) : null}
    </main>
  );
}
