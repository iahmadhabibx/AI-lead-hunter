const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data as ApiError | null;
    throw new Error(err?.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function apiUpload<T>(
  path: string,
  file: File,
  idempotencyKey?: string,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }
  return apiFetch<T>(path, { method: 'POST', body: form, headers });
}
