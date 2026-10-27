'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { UserPublic } from '@aijh/contracts';
import { apiFetch } from '@/lib/api';

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ user: UserPublic }>('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    setError(null);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  }

  if (loading) {
    return (
      <main className="shell dashboard">
        <p className="muted">Loading your workspace…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="shell dashboard">
      <header className="site-header">
        <Link className="brand" href="/">
          ForgePath
        </Link>
        <button className="btn btn-secondary" type="button" onClick={logout}>
          Sign out
        </button>
      </header>
      <h1>Welcome{user.displayName ? `, ${user.displayName}` : ''}</h1>
      <p className="muted">Signed in as {user.email}</p>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="hero-actions" style={{ marginTop: '1.5rem' }}>
        <Link className="btn btn-primary" href="/app/cv">
          Upload CV
        </Link>
        <Link className="btn btn-secondary" href="/app/profile">
          Review profile
        </Link>
      </div>
      <div className="empty">
        Job discovery is not available yet. Complete your CV profile first.
      </div>
    </main>
  );
}
