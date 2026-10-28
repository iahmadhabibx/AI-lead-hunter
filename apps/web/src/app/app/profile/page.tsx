'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect } from 'react';
import type { CandidateProfilePayload } from '@aijh/contracts';
import { Box, Field, Heading, Input, Stack, Text } from '@chakra-ui/react';
import { AppHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';

export default function ProfileReviewPage() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const data = useProfileStore((s) => s.data);
  const loading = useProfileStore((s) => s.loading);
  const pending = useProfileStore((s) => s.pending);
  const error = useProfileStore((s) => s.error);
  const success = useProfileStore((s) => s.success);
  const load = useProfileStore((s) => s.load);
  const saveDraft = useProfileStore((s) => s.saveDraft);
  const approve = useProfileStore((s) => s.approve);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!me) {
          if (!cancelled) router.replace('/login');
          return;
        }
        await load();
      } catch {
        if (!cancelled) router.replace('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe, load, router]);

  const draft = data?.pendingVersion?.payload;
  const active = data?.activeVersion;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft || !data?.pendingVersion) return;
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
      await saveDraft(next);
    } catch {
      // error stored in profile store
    }
  }

  async function onApprove() {
    try {
      await approve();
    } catch {
      // error stored in profile store
    }
  }

  if (loading || (!data && !error)) {
    return (
      <PageShell>
        <Text color="fg.muted" py="10">
          Loading profile…
        </Text>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppHeader
        right={
          <SlackButton href="/app/cv" variant="secondary">
            Upload CV
          </SlackButton>
        }
      />
      <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="900" mb="1">
        Candidate profile
      </Heading>
      <Text color="fg.muted" mb="6">
        Correct extraction mistakes before approving. Approved versions are
        immutable.
      </Text>

      {error ? (
        <Box
          role="alert"
          mb="4"
          bg="rgba(224, 30, 90, 0.08)"
          borderWidth="1px"
          borderColor="rgba(224, 30, 90, 0.25)"
          color="fg.danger"
          borderRadius="slack"
          px="3"
          py="2"
          fontWeight="700"
        >
          {error}
        </Box>
      ) : null}
      {success ? (
        <Box
          role="status"
          mb="4"
          bg="rgba(46, 182, 125, 0.12)"
          color="fg.success"
          borderRadius="slack"
          px="3"
          py="2"
          fontWeight="700"
        >
          {success}
        </Box>
      ) : null}

      {!draft && !active ? (
        <Box
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.default"
          borderRadius="slackLg"
          bg="bg.panel"
          p="5"
          color="fg.muted"
        >
          No profile yet.{' '}
          <Text asChild color="fg.link" fontWeight="700" display="inline">
            <Link href="/app/cv">Upload a CV</Link>
          </Text>{' '}
          to begin.
        </Box>
      ) : null}

      {active && !draft ? (
        <Box
          bg="bg.panel"
          borderRadius="slackLg"
          boxShadow="elevation.md"
          borderWidth="1px"
          borderColor="border.subtle"
          p="5"
        >
          <Text mb="2" color="fg.muted">
            Active approved version #{active.versionNumber} (
            {active.approvedAt ?? active.createdAt})
          </Text>
          <Text fontWeight="900" fontSize="lg" mb="1">
            {active.payload.identity.fullName ?? 'Unnamed'}
          </Text>
          <Text color="fg.muted" mb="3">
            {active.payload.identity.email ?? 'no email'}
          </Text>
          <Text color="fg.muted">
            Skills:{' '}
            {active.payload.skills.map((s) => s.name).join(', ') || '—'}
          </Text>
        </Box>
      ) : null}

      {draft && data?.pendingVersion ? (
        <Box
          mt="4"
          bg="bg.panel"
          borderRadius="slackLg"
          boxShadow="elevation.md"
          borderWidth="1px"
          borderColor="border.subtle"
          p={{ base: '5', md: '6' }}
          maxW="560px"
        >
          <Text color="fg.muted" mb="4" fontWeight="700">
            Pending review — version #{data.pendingVersion.versionNumber}
          </Text>
          <form onSubmit={onSave}>
            <Stack gap="4">
              <Field.Root>
                <Field.Label fontWeight="700">Full name</Field.Label>
                <Input
                  name="fullName"
                  defaultValue={draft.identity.fullName ?? ''}
                  maxLength={120}
                  borderRadius="slack"
                  borderColor="border.default"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontWeight="700">Email</Field.Label>
                <Input
                  name="email"
                  type="email"
                  defaultValue={draft.identity.email ?? ''}
                  maxLength={320}
                  borderRadius="slack"
                  borderColor="border.default"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontWeight="700">Phone</Field.Label>
                <Input
                  name="phone"
                  defaultValue={draft.identity.phone ?? ''}
                  borderRadius="slack"
                  borderColor="border.default"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontWeight="700">Current location</Field.Label>
                <Input
                  name="location"
                  defaultValue={draft.location.current ?? ''}
                  borderRadius="slack"
                  borderColor="border.default"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontWeight="700">Skills (comma-separated)</Field.Label>
                <Input
                  name="skills"
                  defaultValue={draft.skills.map((s) => s.name).join(', ')}
                  borderRadius="slack"
                  borderColor="border.default"
                />
              </Field.Root>
              {draft.missingFields.length > 0 ? (
                <Text color="fg.muted" fontSize="sm">
                  Missing fields: {draft.missingFields.join(', ')}
                </Text>
              ) : null}
              {draft.uncertainFields.length > 0 ? (
                <Text color="fg.muted" fontSize="sm">
                  Uncertain: {draft.uncertainFields.join(', ')}
                </Text>
              ) : null}
              <Stack direction={{ base: 'column', sm: 'row' }} gap="3" pt="2">
                <SlackButton type="submit" variant="secondary" disabled={pending}>
                  {pending ? 'Saving…' : 'Save corrections'}
                </SlackButton>
                <SlackButton
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={onApprove}
                >
                  Approve profile
                </SlackButton>
              </Stack>
            </Stack>
          </form>
        </Box>
      ) : null}
    </PageShell>
  );
}
