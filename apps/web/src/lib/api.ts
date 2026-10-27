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
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data as ApiError | null;
    throw new Error(err?.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}
