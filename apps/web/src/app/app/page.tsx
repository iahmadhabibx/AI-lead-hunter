'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  Heading,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { AppHeader } from '@/components/layout/site-header';
import { PageShell } from '@/components/layout/page-shell';
import { SlackButton } from '@/components/ui/slack-button';
import { useApplicationsStore } from '@/stores/applications-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCvStore } from '@/stores/cv-store';
import { useMatchesStore, type MatchListItem } from '@/stores/matches-store';
import { useProfileStore } from '@/stores/profile-store';

type LogLine = { at: string; message: string; level: 'info' | 'error' | 'ok' };

function formatPosted(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(band: string): string {
  if (band === 'eligible') return 'Eligible';
  if (band === 'needs_verification') return 'Needs review';
  if (band === 'ineligible') return 'Ineligible';
  return band;
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/** Loose token match: "front end" ≈ "frontend", "React" ≈ "reactjs". */
function textMatchesKeyword(haystack: string, keyword: string): boolean {
  const h = haystack.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (!k) return true;
  if (h.includes(k)) return true;
  const hCompact = h.replace(/[^a-z0-9]+/g, '');
  const kCompact = k.replace(/[^a-z0-9]+/g, '');
  if (!kCompact) return false;
  return hCompact.includes(kCompact) || kCompact.includes(hCompact);
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid #DDDDDD',
  padding: '0 10px',
  background: '#fff',
  fontSize: 14,
};

export default function AppHomePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [bootstrapped, setBootstrapped] = useState(false);
  /** Results stay hidden until the user explicitly runs a search. */
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilter, setShowFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [keywords, setKeywords] = useState('');
  const [excludeTitle, setExcludeTitle] = useState('');
  const [maxAgeDays, setMaxAgeDays] = useState(30);
  const [titleOnly, setTitleOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(true);
  const [logLines, setLogLines] = useState<LogLine[]>([
    {
      at: new Date().toISOString(),
      message: 'Ready. Enter filters and press Find jobs to search configured boards.',
      level: 'info',
    },
  ]);

  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.error);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  const profile = useProfileStore((s) => s.data);
  const profileLoading = useProfileStore((s) => s.loading);
  const profileError = useProfileStore((s) => s.error);
  const loadProfile = useProfileStore((s) => s.load);
  const approveProfile = useProfileStore((s) => s.approve);

  const cvPending = useCvStore((s) => s.pending);
  const cvError = useCvStore((s) => s.error);
  const cvTask = useCvStore((s) => s.task);
  const uploadAndWait = useCvStore((s) => s.uploadAndWait);
  const clearCvError = useCvStore((s) => s.clearError);

  const matches = useMatchesStore((s) => s.matches);
  const matchesPending = useMatchesStore((s) => s.pending);
  const matchesError = useMatchesStore((s) => s.error);
  const loadSources = useMatchesStore((s) => s.loadSources);
  const clearResults = useMatchesStore((s) => s.clearResults);
  const refreshFeed = useMatchesStore((s) => s.refreshFeed);
  const loadMatchDetail = useMatchesStore((s) => s.loadMatchDetail);
  const selectedDetail = useMatchesStore((s) => s.selected);
  const saveJob = useMatchesStore((s) => s.saveJob);
  const rejectJob = useMatchesStore((s) => s.rejectJob);
  const savedIds = useMatchesStore((s) => s.savedIds);

  const draftPending = useApplicationsStore((s) => s.pending);
  const draftError = useApplicationsStore((s) => s.error);
  const createAndGenerateDrafts = useApplicationsStore(
    (s) => s.createAndGenerateDrafts,
  );

  const hasProfile = Boolean(
    profile?.activeVersion || profile?.pendingVersion,
  );
  const hasApproved = Boolean(profile?.activeVersion);
  const busy =
    cvPending || matchesPending || profileLoading || draftPending;
  const processingCv =
    cvPending ||
    (cvTask != null &&
      cvTask.status !== 'succeeded' &&
      cvTask.status !== 'failed');

  function log(message: string, level: LogLine['level'] = 'info') {
    setLogLines((prev) => [
      ...prev.slice(-200),
      { at: new Date().toISOString(), message, level },
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (!me) {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        clearResults();
        await loadProfile();
        await loadSources();
        if (!cancelled) {
          log(
            'Workspace ready. No jobs loaded yet — set filters and press Find jobs.',
          );
        }
      } catch {
        if (!cancelled) log('Failed to load workspace.', 'error');
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearResults, fetchMe, loadProfile, loadSources, router]);

  const filtered = useMemo(() => {
    const kw = keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exclude = excludeTitle
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const listQ = listSearch.trim();

    return matches.filter((m) => {
      if (showFilter !== 'all' && m.band !== showFilter) return false;
      const title = m.job?.title ?? '';
      const company = m.job?.companyName ?? '';
      const location = m.job?.locationText ?? '';
      const hay = titleOnly ? title : `${title} ${company} ${location}`;

      if (exclude.some((e) => textMatchesKeyword(title, e))) return false;
      if (kw.length > 0 && !kw.some((k) => textMatchesKeyword(hay, k))) {
        return false;
      }

      const posted = m.job?.publishedAt ?? m.job?.lastSeenAt ?? m.updatedAt;
      const age = daysAgo(posted);
      if (age != null && age > maxAgeDays) return false;

      if (listQ) {
        const blob = `${title} ${company} ${location} ${m.band}`;
        if (!textMatchesKeyword(blob, listQ)) return false;
      }
      return true;
    });
  }, [
    excludeTitle,
    keywords,
    listSearch,
    matches,
    maxAgeDays,
    showFilter,
    titleOnly,
  ]);

  const selectedMatch: MatchListItem | null =
    matches.find((m) => m.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const eligible = matches.filter((m) => m.band === 'eligible').length;
    const review = matches.filter(
      (m) => m.band === 'needs_verification',
    ).length;
    return {
      total: matches.length,
      shown: filtered.length,
      eligible,
      review,
      saved: savedIds.length,
    };
  }, [filtered.length, matches, savedIds.length]);

  async function onLogout() {
    try {
      await logout();
      router.push('/');
    } catch {
      // auth store
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file || file.size === 0) return;
    clearCvError();
    cancelRef.current = false;
    setHasSearched(false);
    clearResults();
    setSelectedId(null);
    log(`Uploading CV: ${file.name}`);
    try {
      await uploadAndWait(file);
      await loadProfile();
      log(
        'CV processed. Set filters and press Find jobs when you are ready.',
        'ok',
      );
    } catch (err) {
      log(err instanceof Error ? err.message : 'CV upload failed', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onFindJobs() {
    cancelRef.current = false;
    setSelectedId(null);
    setHasSearched(true);
    log(
      'Searching configured employer boards, then matching your profile…',
    );
    try {
      if (!hasApproved && profile?.pendingVersion) {
        log('Approving pending profile…');
        await approveProfile();
        await loadProfile();
      }
      if (!useProfileStore.getState().data?.activeVersion) {
        throw new Error('Upload and approve a CV profile first.');
      }
      // User-initiated search: refresh boards then match (not on page load).
      await refreshFeed({ forceDiscover: true });
      if (!cancelRef.current) {
        const n = useMatchesStore.getState().matches.length;
        log(`Search finished — ${n} matched roles.`, 'ok');
      }
    } catch (err) {
      if (!cancelRef.current) {
        log(err instanceof Error ? err.message : 'Find jobs failed', 'error');
      }
    }
  }

  function onStop() {
    cancelRef.current = true;
    log('Stop requested — waiting for the current step to finish.', 'info');
  }

  async function onSelectRow(m: MatchListItem) {
    setSelectedId(m.id);
    try {
      await loadMatchDetail(m.id);
    } catch {
      // store
    }
  }

  async function onDraftSelected() {
    if (!selectedMatch) return;
    cancelRef.current = false;
    log(
      `Drafting CV + cover for ${selectedMatch.job?.title ?? selectedMatch.id}…`,
    );
    try {
      const result = await createAndGenerateDrafts({
        canonicalJobId: selectedMatch.canonicalJobId,
        matchResultId: selectedMatch.id,
      });
      if (!cancelRef.current) {
        log(
          `Drafts ready (application ${result.applicationId.slice(0, 8)}…). Human review required — never auto-submitted.`,
          'ok',
        );
      }
    } catch (err) {
      if (!cancelRef.current) {
        log(
          err instanceof Error ? err.message : 'Draft generation failed',
          'error',
        );
      }
    }
  }

  if (authStatus === 'idle' || authStatus === 'loading' || !bootstrapped) {
    return (
      <PageShell>
        <Text color="fg.muted" py="10">
          Loading your workspace…
        </Text>
      </PageShell>
    );
  }

  if (!user) return null;

  const error = authError || cvError || profileError || matchesError || draftError;
  const profileName =
    profile?.activeVersion?.payload.identity.fullName ||
    profile?.pendingVersion?.payload.identity.fullName ||
    null;

  return (
    <PageShell>
      <AppHeader
        right={
          <SlackButton variant="secondary" type="button" onClick={onLogout}>
            Sign out
          </SlackButton>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => {
          void onPickFile(e.target.files?.[0]);
        }}
      />

      {/* Primary toolbar */}
      <HStack gap="2" flexWrap="wrap" mb="3">
        <SlackButton
          type="button"
          variant="primary"
          disabled={busy || (!hasProfile && !hasApproved)}
          onClick={() => {
            void onFindJobs();
          }}
        >
          {matchesPending ? 'Finding…' : 'Find jobs'}
        </SlackButton>
        <SlackButton
          type="button"
          variant="secondary"
          disabled={busy || !selectedMatch || !hasApproved}
          onClick={() => {
            void onDraftSelected();
          }}
        >
          {draftPending ? 'Drafting…' : 'Draft CV + cover'}
        </SlackButton>
        <SlackButton
          type="button"
          variant="secondary"
          disabled={!busy}
          onClick={onStop}
        >
          Stop run
        </SlackButton>
        <SlackButton
          type="button"
          variant="ghost"
          onClick={() => setLogOpen((v) => !v)}
        >
          {logOpen ? 'Hide run log' : 'Run log'}
        </SlackButton>
        <SlackButton href="/app/profile" variant="ghost">
          Tracker / profile
        </SlackButton>
      </HStack>

      {/* CV row */}
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="slack"
        boxShadow="elevation.sm"
        px="4"
        py="3"
        mb="3"
      >
        <HStack
          gap="3"
          flexWrap="wrap"
          align="center"
          justify="space-between"
        >
          <HStack gap="3" flexWrap="wrap" align="center">
            <Text fontWeight="900">Your CV:</Text>
            <SlackButton
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {processingCv
                ? 'Processing…'
                : hasProfile
                  ? 'Upload / replace CV'
                  : 'Upload my CV'}
            </SlackButton>
            <SlackButton href="/app/profile" variant="secondary" size="sm">
              My profile
            </SlackButton>
            <Text color="fg.muted" fontSize="sm">
              {!hasProfile
                ? 'No profile yet. Press Upload my CV.'
                : hasApproved
                  ? `Active profile${profileName ? `: ${profileName}` : ''}.`
                  : `Pending profile${profileName ? `: ${profileName}` : ''} — approve to score jobs.`}
            </Text>
          </HStack>
          {!hasApproved && hasProfile ? (
            <SlackButton
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => {
                void onFindJobs();
              }}
            >
              Approve & find jobs
            </SlackButton>
          ) : null}
        </HStack>
      </Box>

      {error ? (
        <Box
          role="alert"
          mb="3"
          bg="rgba(224, 30, 90, 0.08)"
          borderWidth="1px"
          borderColor="rgba(224, 30, 90, 0.25)"
          color="fg.danger"
          borderRadius="slack"
          px="3"
          py="2"
          fontWeight="700"
          fontSize="sm"
        >
          {error}
        </Box>
      ) : null}

      {/* Job filter — filters matched jobs from configured employer boards (not LinkedIn/Indeed). */}
      <Box
        as="form"
        bg="#ECEFF1"
        borderWidth="1px"
        borderColor="border.default"
        borderRadius="slackLg"
        p="4"
        mb="3"
        onSubmit={(e) => {
          e.preventDefault();
          void onFindJobs();
        }}
      >
        <Text fontWeight="900" mb="1">
          Job filter
        </Text>
        <Text color="fg.muted" fontSize="sm" mb="3">
          Filters jobs already ingested from configured employer boards
          (Greenhouse / Lever in <Text as="span" fontWeight="700">JOB_SOURCES_JSON</Text>
          ). This is not LinkedIn, Indeed, or global web search — those portals
          are out of scope for the MVP.
        </Text>
        <Stack gap="3">
          <HStack gap="3" align="center" flexWrap="wrap">
            <Checkbox.Root
              checked={titleOnly}
              onCheckedChange={(d) => setTitleOnly(!!d.checked)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label fontSize="sm">Keywords in title only</Checkbox.Label>
            </Checkbox.Root>
          </HStack>
          <Box>
            <Text fontSize="sm" fontWeight="700" mb="1">
              Keywords (any of)
            </Text>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. React, TypeScript, Node"
              bg="bg.panel"
              borderRadius="slack"
              borderColor="border.default"
            />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="700" mb="1">
              Exclude in title
            </Text>
            <Input
              value={excludeTitle}
              onChange={(e) => setExcludeTitle(e.target.value)}
              placeholder="e.g. intern, junior"
              bg="bg.panel"
              borderRadius="slack"
              borderColor="border.default"
            />
          </Box>
          <HStack gap="3" align="end" flexWrap="wrap">
            <Box maxW="140px">
              <Text fontSize="sm" fontWeight="700" mb="1">
                Max age (days)
              </Text>
              <Input
                type="number"
                min={1}
                max={365}
                value={maxAgeDays}
                onChange={(e) =>
                  setMaxAgeDays(Math.max(1, Number(e.target.value) || 1))
                }
                bg="bg.panel"
                borderRadius="slack"
                borderColor="border.default"
              />
            </Box>
            <SlackButton type="submit" variant="primary" disabled={busy}>
              {busy ? 'Searching…' : 'Apply filters & find jobs'}
            </SlackButton>
          </HStack>
        </Stack>
      </Box>

      {/* Results + detail */}
      <Stack
        direction={{ base: 'column', lg: 'row' }}
        gap="3"
        align="stretch"
        mb="3"
        minH="360px"
      >
        <Box
          flex="1.6"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="slackLg"
          boxShadow="elevation.sm"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          <HStack
            px="3"
            py="2"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            gap="3"
            flexWrap="wrap"
            bg="slack.hover"
          >
            <Text fontSize="sm" fontWeight="700">
              Show:
            </Text>
            <select
              value={showFilter}
              onChange={(e) => setShowFilter(e.target.value)}
              style={{ ...selectStyle, width: 160 }}
            >
              <option value="all">All matches</option>
              <option value="eligible">Eligible</option>
              <option value="needs_verification">Needs review</option>
              <option value="ineligible">Ineligible</option>
            </select>
            <Text fontSize="sm" fontWeight="700">
              Search in list:
            </Text>
            <Input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Filter visible rows"
              maxW="220px"
              h="36px"
              bg="bg.panel"
              borderRadius="slack"
              borderColor="border.default"
            />
          </HStack>
          <Box px="3" py="2" borderBottomWidth="1px" borderColor="border.subtle">
            <Text fontSize="sm" color="fg.muted">
              {!hasSearched
                ? 'No search yet. Enter filters and press Find jobs.'
                : matchesPending
                  ? 'Searching configured employer boards…'
                  : `${counts.shown} shown · ${counts.total} matched · ${counts.eligible} eligible · ${counts.review} needs review · ${counts.saved} saved`}
            </Text>
          </Box>
          <Box flex="1" overflow="auto">
            {!hasProfile ? (
              <Box p="6" color="fg.muted">
                <Heading size="md" fontWeight="900" mb="2" color="fg.default">
                  Welcome{user.displayName ? `, ${user.displayName}` : ''}
                </Heading>
                Upload your CV first, then set filters and press Find jobs.
              </Box>
            ) : !hasSearched ? (
              <Box p="6" color="fg.muted">
                Results stay empty until you search. Set keywords / filters, then
                press <Text as="span" fontWeight="700">Find jobs</Text> or hit
                Enter.
              </Box>
            ) : filtered.length === 0 ? (
              <Box p="6" color="fg.muted">
                {matchesPending
                  ? 'Refreshing boards and matching your profile…'
                  : 'No jobs match these filters. Broaden keywords or remove exclusions.'}
              </Box>
            ) : (
              <Table.Root size="sm" stickyHeader>
                <Table.Header>
                  <Table.Row bg="slack.hover">
                    <Table.ColumnHeader fontWeight="900">Status</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="900">Posted</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="900">Company</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="900">Role</Table.ColumnHeader>
                    <Table.ColumnHeader fontWeight="900">Location</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filtered.map((m) => {
                    const active = m.id === selectedId;
                    return (
                      <Table.Row
                        key={m.id}
                        cursor="pointer"
                        bg={active ? 'rgba(18, 100, 163, 0.08)' : undefined}
                        _hover={{ bg: active ? 'rgba(18, 100, 163, 0.12)' : 'slack.hover' }}
                        onClick={() => {
                          void onSelectRow(m);
                        }}
                      >
                        <Table.Cell fontWeight="700" whiteSpace="nowrap">
                          {statusLabel(m.band)}
                          {m.suitabilityPercent != null
                            ? ` · ${m.suitabilityPercent}%`
                            : ''}
                        </Table.Cell>
                        <Table.Cell whiteSpace="nowrap">
                          {formatPosted(
                            m.job?.publishedAt ??
                              m.job?.lastSeenAt ??
                              m.updatedAt,
                          )}
                        </Table.Cell>
                        <Table.Cell>{m.job?.companyName ?? '—'}</Table.Cell>
                        <Table.Cell fontWeight="700">
                          {m.job?.title ?? 'Untitled'}
                        </Table.Cell>
                        <Table.Cell>{m.job?.locationText ?? '—'}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            )}
          </Box>
        </Box>

        <Box
          flex="1"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="slackLg"
          boxShadow="elevation.sm"
          p="4"
          minH="320px"
        >
          {!selectedMatch ? (
            <Text color="fg.muted">
              Pick a job on the left to see details and actions.
            </Text>
          ) : (
            <Stack gap="3">
              <Box>
                <Heading size="md" fontWeight="900" mb="1">
                  {selectedMatch.job?.title ?? 'Untitled'}
                </Heading>
                <Text color="fg.muted" fontSize="sm">
                  {selectedMatch.job?.companyName ?? 'Unknown company'}
                  {selectedMatch.job?.locationText
                    ? ` · ${selectedMatch.job.locationText}`
                    : ''}
                  {selectedMatch.job?.workMode
                    ? ` · ${selectedMatch.job.workMode}`
                    : ''}
                </Text>
                <Text fontWeight="700" mt="2">
                  {statusLabel(selectedMatch.band)}
                  {selectedMatch.suitabilityPercent != null
                    ? ` · ${selectedMatch.suitabilityPercent}% suitability`
                    : ''}
                </Text>
              </Box>

              <Stack gap="2">
                <SlackButton
                  type="button"
                  variant="primary"
                  disabled={busy || !hasApproved}
                  onClick={() => {
                    void onDraftSelected();
                  }}
                >
                  {draftPending ? 'Drafting…' : 'Draft CV + cover letter'}
                </SlackButton>
                {selectedMatch.job?.applyUrl ? (
                  <SlackButton
                    href={selectedMatch.job.applyUrl}
                    variant="secondary"
                    openInNewTab
                  >
                    Open job page
                  </SlackButton>
                ) : (
                  <SlackButton type="button" variant="secondary" disabled>
                    Open job page
                  </SlackButton>
                )}
                <HStack gap="2">
                  <SlackButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || savedIds.includes(selectedMatch.canonicalJobId)}
                    onClick={() => {
                      void saveJob(
                        selectedMatch.canonicalJobId,
                        selectedMatch.id,
                      )
                        .then(() => log('Job saved.', 'ok'))
                        .catch((err) =>
                          log(
                            err instanceof Error ? err.message : 'Save failed',
                            'error',
                          ),
                        );
                    }}
                  >
                    {savedIds.includes(selectedMatch.canonicalJobId)
                      ? 'Saved'
                      : 'Save'}
                  </SlackButton>
                  <SlackButton
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void rejectJob(
                        selectedMatch.canonicalJobId,
                        selectedMatch.id,
                        'wrong_role',
                      )
                        .then(() => {
                          setSelectedId(null);
                          log('Job rejected.', 'ok');
                        })
                        .catch((err) =>
                          log(
                            err instanceof Error
                              ? err.message
                              : 'Reject failed',
                            'error',
                          ),
                        );
                    }}
                  >
                    Skip job
                  </SlackButton>
                </HStack>
              </Stack>

              {selectedDetail?.id === selectedMatch.id ? (
                <Box
                  borderTopWidth="1px"
                  borderColor="border.subtle"
                  pt="3"
                  fontSize="sm"
                >
                  {selectedDetail.breakdown?.disclaimer ? (
                    <Text color="fg.muted" mb="2">
                      {selectedDetail.breakdown.disclaimer}
                    </Text>
                  ) : null}
                  {selectedDetail.breakdown?.components
                    ?.slice(0, 6)
                    .map((c) => (
                      <Text key={c.id} mb="1">
                        <Text as="span" fontWeight="700">
                          {c.id}
                        </Text>
                        {c.score == null
                          ? ''
                          : ` ${Math.round(c.score * 100)}%`}
                        {' — '}
                        {c.explanation}
                      </Text>
                    ))}
                </Box>
              ) : null}
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Run log */}
      {logOpen ? (
        <Box
          bg="#1A1D21"
          color="#F8F8F8"
          borderRadius="slackLg"
          px="4"
          py="3"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize="12px"
          maxH="180px"
          overflowY="auto"
        >
          <HStack justify="space-between" mb="2">
            <Text fontWeight="700">Run log</Text>
            <SlackButton
              type="button"
              variant="ghost"
              size="sm"
              color="fg.inverse"
              onClick={() =>
                setLogLines([
                  {
                    at: new Date().toISOString(),
                    message: 'Ready.',
                    level: 'info',
                  },
                ])
              }
            >
              Clear
            </SlackButton>
          </HStack>
          {logLines.map((line, i) => (
            <Text
              key={`${line.at}-${i}`}
              color={
                line.level === 'error'
                  ? '#E01E5A'
                  : line.level === 'ok'
                    ? '#2EB67D'
                    : '#F8F8F8'
              }
            >
              [{new Date(line.at).toLocaleTimeString()}] {line.message}
            </Text>
          ))}
        </Box>
      ) : null}
    </PageShell>
  );
}
