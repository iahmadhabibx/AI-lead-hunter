'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Box, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { AppHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useAuthStore } from '@/stores/auth-store';
import { useMatchesStore } from '@/stores/matches-store';

function bandColor(band: string): string {
  if (band === 'eligible') return 'fg.success';
  if (band === 'needs_verification') return 'slack.yellow';
  return 'fg.danger';
}

export default function MatchesPage() {
  const router = useRouter();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const sources = useMatchesStore((s) => s.sources);
  const catalogCount = useMatchesStore((s) => s.catalogCount);
  const catalogNote = useMatchesStore((s) => s.catalogNote);
  const matches = useMatchesStore((s) => s.matches);
  const scoringNote = useMatchesStore((s) => s.scoringNote);
  const selected = useMatchesStore((s) => s.selected);
  const savedIds = useMatchesStore((s) => s.savedIds);
  const loading = useMatchesStore((s) => s.loading);
  const pending = useMatchesStore((s) => s.pending);
  const error = useMatchesStore((s) => s.error);
  const success = useMatchesStore((s) => s.success);
  const bootstrap = useMatchesStore((s) => s.bootstrap);
  const discover = useMatchesStore((s) => s.discover);
  const runMatch = useMatchesStore((s) => s.runMatch);
  const loadMatchDetail = useMatchesStore((s) => s.loadMatchDetail);
  const clearSelected = useMatchesStore((s) => s.clearSelected);
  const saveJob = useMatchesStore((s) => s.saveJob);
  const rejectJob = useMatchesStore((s) => s.rejectJob);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (!me) {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        await bootstrap();
      } catch {
        // error in store
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, fetchMe, router]);

  if (loading) {
    return (
      <PageShell>
        <Text color="fg.muted" py="10">
          Loading job matches…
        </Text>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppHeader
        right={
          <HStack gap="2">
            <SlackButton href="/app/cv" variant="secondary">
              Upload CV
            </SlackButton>
            <SlackButton href="/app/profile" variant="secondary">
              Profile
            </SlackButton>
          </HStack>
        }
      />

      <Heading as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="900" mb="1">
        Job matches
      </Heading>
      <Text color="fg.muted" mb="6" maxW="40rem">
        Discover listings from configured employer boards, then match them to
        your approved profile. Scores are suitability weights — not hiring odds.
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

      <Box
        bg="bg.panel"
        borderRadius="slackLg"
        boxShadow="elevation.md"
        borderWidth="1px"
        borderColor="border.subtle"
        p={{ base: '5', md: '6' }}
        mb="6"
      >
        <Heading as="h2" size="md" fontWeight="900" mb="2">
          Job sources
        </Heading>
        <Text color="fg.muted" mb="4" fontSize="sm">
          {catalogNote ??
            'Listings only come from configured employer boards — not global search.'}{' '}
          Catalog size: <Text as="span" fontWeight="700">{catalogCount}</Text>
        </Text>

        {sources.length === 0 ? (
          <Text color="fg.muted" mb="4">
            No boards configured. Set{' '}
            <Text as="span" fontWeight="700">
              JOB_SOURCES_JSON
            </Text>{' '}
            in the API environment (Greenhouse board tokens / Lever sites).
          </Text>
        ) : (
          <Stack gap="2" mb="4">
            {sources.map((s) => (
              <Text key={s.key} fontSize="sm">
                <Text as="span" fontWeight="700">
                  {s.key}
                </Text>{' '}
                ({s.provider}
                {s.enabled ? '' : ', disabled'})
                {s.unavailableReason ? ` — ${s.unavailableReason}` : ''}
                {s.persistence?.lastIngestAt
                  ? ` · last ingest ${s.persistence.lastIngestAt}`
                  : ' · not ingested yet'}
              </Text>
            ))}
          </Stack>
        )}

        <Stack direction={{ base: 'column', sm: 'row' }} gap="3">
          <SlackButton
            type="button"
            variant="primary"
            disabled={pending || sources.length === 0}
            onClick={() => {
              void discover().catch(() => undefined);
            }}
          >
            {pending ? 'Working…' : 'Discover jobs'}
          </SlackButton>
          <SlackButton
            type="button"
            variant="secondary"
            disabled={pending || catalogCount === 0}
            onClick={() => {
              void runMatch().catch(() => undefined);
            }}
          >
            {pending ? 'Working…' : 'Run matching'}
          </SlackButton>
        </Stack>
        {pending ? (
          <Text color="fg.muted" fontSize="sm" mt="3">
            Large boards can take a few minutes. Keep this tab open.
          </Text>
        ) : null}
      </Box>

      {scoringNote ? (
        <Text color="fg.muted" fontSize="sm" mb="4">
          {scoringNote}
        </Text>
      ) : null}

      {matches.length === 0 ? (
        <Box
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.default"
          borderRadius="slackLg"
          bg="bg.panel"
          p="5"
          color="fg.muted"
        >
          No matches yet. Discover jobs from configured boards, then run
          matching against your approved profile.
        </Box>
      ) : (
        <Stack gap="3" mb="8">
          {matches.map((m) => {
            const saved = savedIds.includes(m.canonicalJobId);
            const open = selected?.id === m.id;
            return (
              <Box
                key={m.id}
                bg="bg.panel"
                borderRadius="slackLg"
                boxShadow="elevation.sm"
                borderWidth="1px"
                borderColor="border.subtle"
                p="5"
              >
                <Stack
                  direction={{ base: 'column', md: 'row' }}
                  justify="space-between"
                  gap="3"
                  mb={open ? '4' : '0'}
                >
                  <Box>
                    <Text fontWeight="900" fontSize="lg">
                      {m.job?.title ?? 'Untitled role'}
                    </Text>
                    <Text color="fg.muted" fontSize="sm">
                      {m.job?.companyName ?? 'Unknown company'}
                      {m.job?.locationText ? ` · ${m.job.locationText}` : ''}
                      {m.job?.workMode ? ` · ${m.job.workMode}` : ''}
                    </Text>
                    <HStack gap="3" mt="2" flexWrap="wrap">
                      <Text fontWeight="700" color={bandColor(m.band)}>
                        {m.band.replace('_', ' ')}
                      </Text>
                      <Text fontWeight="700">
                        {m.suitabilityPercent == null
                          ? 'n/a'
                          : `${m.suitabilityPercent}% suitability`}
                      </Text>
                    </HStack>
                  </Box>
                  <Stack direction="row" gap="2" flexWrap="wrap">
                    <SlackButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (open) {
                          clearSelected();
                        } else {
                          void loadMatchDetail(m.id).catch(() => undefined);
                        }
                      }}
                    >
                      {open ? 'Hide detail' : 'Explain'}
                    </SlackButton>
                    {m.job?.applyUrl ? (
                      <SlackButton
                        href={m.job.applyUrl}
                        variant="secondary"
                        size="sm"
                        openInNewTab
                      >
                        Official apply page
                      </SlackButton>
                    ) : null}
                    <SlackButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending || saved}
                      onClick={() => {
                        void saveJob(m.canonicalJobId, m.id).catch(
                          () => undefined,
                        );
                      }}
                    >
                      {saved ? 'Saved' : 'Save'}
                    </SlackButton>
                    <SlackButton
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        void rejectJob(
                          m.canonicalJobId,
                          m.id,
                          'wrong_role',
                        ).catch(() => undefined);
                      }}
                    >
                      Reject
                    </SlackButton>
                  </Stack>
                </Stack>

                {open && selected ? (
                  <Box
                    borderTopWidth="1px"
                    borderColor="border.subtle"
                    pt="4"
                    mt="1"
                  >
                    {selected.job?.sourceAttribution ? (
                      <Text color="fg.muted" fontSize="sm" mb="3">
                        Source: {selected.job.sourceAttribution}
                      </Text>
                    ) : null}
                    {selected.breakdown?.disclaimer ? (
                      <Text color="fg.muted" fontSize="sm" mb="3">
                        {selected.breakdown.disclaimer}
                      </Text>
                    ) : null}
                    {selected.breakdown?.components?.length ? (
                      <Stack gap="2" mb="3">
                        <Text fontWeight="700">Score components</Text>
                        {selected.breakdown.components.map((c) => (
                          <Text key={c.id} fontSize="sm">
                            <Text as="span" fontWeight="700">
                              {c.id}
                            </Text>
                            {c.score == null ? '' : ` ${Math.round(c.score * 100)}%`}
                            {' — '}
                            {c.explanation}
                          </Text>
                        ))}
                      </Stack>
                    ) : null}
                    {selected.breakdown?.evidence?.length ? (
                      <Stack gap="1" mb="3">
                        <Text fontWeight="700">Evidence</Text>
                        {selected.breakdown.evidence.slice(0, 8).map((e, i) => (
                          <Text key={`${e.kind}-${i}`} fontSize="sm" color="fg.muted">
                            [{e.kind}] {e.message}
                          </Text>
                        ))}
                      </Stack>
                    ) : null}
                    {selected.breakdown?.missingRequirements?.length ? (
                      <Text fontSize="sm" color="fg.muted">
                        Missing: {selected.breakdown.missingRequirements.join(', ')}
                      </Text>
                    ) : null}
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}
    </PageShell>
  );
}
