'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          displayName: String(form.get('displayName') ?? '') || undefined,
        }),
      });
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="shell">
      <header className="site-header">
        <Link className="brand" href="/">
          ForgePath
        </Link>
      </header>
      <section className="panel" aria-labelledby="register-title">
        <h1 id="register-title">Create your account</h1>
        <p className="lead">Private by default. You control exports and deletion later.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Display name
            <input name="displayName" autoComplete="name" maxLength={120} />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={320}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
