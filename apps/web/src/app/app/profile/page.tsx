'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { CandidateProfilePayload, ProfileVersionPublic } from '@aijh/contracts';
import { apiFetch } from '@/lib/api';

type ProfileResponse = {
  profileId: string | null;
  activeVersion: ProfileVersionPublic | null;
  pendingVersion: ProfileVersionPublic | null;
};

export default function ProfileReviewPage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const profile = await apiFetch<ProfileResponse>('/profile');
    setData(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiFetch('/auth/me');
        await load();
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  const draft = data?.pendingVersion?.payload;
  const active = data?.activeVersion;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft || !data?.pendingVersion) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(e.currentTarget);
    const next: CandidateProfilePayload = {
      ...draft,
      identity: {
        ...draft.identity,
        fullName: String(form.get('fullName') || '') || null,
        email: String(form.get('email') || '') || null,
        phone: String(form.get('phone') || '') || null,
      },
      location: {
        ...draft.location,
        current: String(form.get('location') || '') || null,
      },
      skills: String(form.get('skills') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, evidenceIds: [] })),
    };
    try {
      await apiFetch('/profile/draft', {
        method: 'PATCH',
        body: JSON.stringify(next),
      });
      await load();
      setSuccess('Draft saved. Review carefully before approving.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  async function onApprove() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/profile/approve', { method: 'POST' });
      await load();
      setSuccess('Profile approved. This version is now immutable and active.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <main className="shell dashboard">
        <p className="muted">Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="shell dashboard">
      <header className="site-header">
        <Link className="brand" href="/app">
          ForgePath
        </Link>
        <Link className="btn btn-secondary" href="/app/cv">
          Upload CV
        </Link>
      </header>
      <h1>Candidate profile</h1>
      <p className="muted">
        Correct extraction mistakes before approving. Approved versions are immutable.
      </p>

      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {success ? <div className="form-success" role="status">{success}</div> : null}

      {!draft && !active ? (
        <div className="empty">
          No profile yet. <Link href="/app/cv">Upload a CV</Link> to begin.
        </div>
      ) : null}

      {active && !draft ? (
        <div className="empty">
          <p>
            Active approved version #{active.versionNumber} (
            {active.approvedAt ?? active.createdAt})
          </p>
          <p>
            <strong>{active.payload.identity.fullName ?? 'Unnamed'}</strong> —{' '}
            {active.payload.identity.email ?? 'no email'}
          </p>
          <p className="muted">
            Skills: {active.payload.skills.map((s) => s.name).join(', ') || '—'}
          </p>
        </div>
      ) : null}

      {draft && data?.pendingVersion ? (
        <form className="form panel" style={{ marginTop: '1.25rem' }} onSubmit={onSave}>
          <p className="muted">
            Pending review — version #{data.pendingVersion.versionNumber}
          </p>
          <label>
            Full name
            <input
              name="fullName"
              defaultValue={draft.identity.fullName ?? ''}
              maxLength={120}
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              defaultValue={draft.identity.email ?? ''}
              maxLength={320}
            />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={draft.identity.phone ?? ''} />
          </label>
          <label>
            Current location
            <input name="location" defaultValue={draft.location.current ?? ''} />
          </label>
          <label>
            Skills (comma-separated)
            <input
              name="skills"
              defaultValue={draft.skills.map((s) => s.name).join(', ')}
            />
          </label>
          {draft.missingFields.length > 0 ? (
            <p className="muted">
              Missing fields: {draft.missingFields.join(', ')}
            </p>
          ) : null}
          {draft.uncertainFields.length > 0 ? (
            <p className="muted">
              Uncertain: {draft.uncertainFields.join(', ')}
            </p>
          ) : null}
          <div className="hero-actions">
            <button className="btn btn-secondary" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save corrections'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending}
              onClick={onApprove}
            >
              Approve profile
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
