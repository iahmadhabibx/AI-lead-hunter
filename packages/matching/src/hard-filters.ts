import type {
  CandidateProfilePayload,
  CanonicalJob,
  HardFilterResult,
} from '@aijh/contracts';
import { detectSponsorshipSignal, includesNormalized } from './text';

export type HardFilterContext = {
  profile: CandidateProfilePayload;
  job: CanonicalJob;
  jobStatus?: 'active' | 'stale' | 'closed' | 'unknown';
};

/**
 * Deterministic hard eligibility. Unknown facts never count as positive passes
 * that invent eligibility — they either soft-fail into needs_verification or skip.
 */
export function evaluateHardFilters(
  ctx: HardFilterContext,
): HardFilterResult[] {
  const { profile, job } = ctx;
  const results: HardFilterResult[] = [];
  const prefs = profile.preferences;
  const jobBlob = [job.descriptionText, job.title, job.locationText]
    .filter(Boolean)
    .join('\n');

  // Job freshness / status
  if (ctx.jobStatus === 'closed') {
    results.push({
      id: 'job_status',
      passed: false,
      hard: true,
      reason: 'Job listing is marked closed.',
    });
  } else {
    results.push({
      id: 'job_status',
      passed: true,
      hard: true,
      reason:
        ctx.jobStatus === 'stale'
          ? 'Job is stale but not confirmed closed; allowed for review.'
          : 'Job status allows matching.',
    });
  }

  // Excluded industries (explicit user constraint)
  const excluded = prefs.excludedIndustries ?? [];
  if (excluded.length > 0) {
    const hit = excluded.find(
      (ind) =>
        includesNormalized(jobBlob, ind) ||
        job.departments.some((d) => includesNormalized(d, ind)),
    );
    results.push({
      id: 'excluded_industry',
      passed: !hit,
      hard: true,
      reason: hit
        ? `Job appears related to excluded industry "${hit}".`
        : 'No excluded industry keywords detected.',
    });
  }

  // Work mode — only hard-fail when both sides are known and incompatible
  const preferredModes = (prefs.preferredWorkModes ?? []).filter(
    (m) => m !== 'unknown',
  );
  if (preferredModes.length > 0 && job.workMode !== 'unknown') {
    const ok = preferredModes.includes(job.workMode);
    results.push({
      id: 'work_mode',
      passed: ok,
      hard: true,
      reason: ok
        ? `Job work mode "${job.workMode}" matches preferences.`
        : `Job work mode "${job.workMode}" conflicts with preferred modes: ${preferredModes.join(', ')}.`,
    });
  } else if (preferredModes.length > 0 && job.workMode === 'unknown') {
    results.push({
      id: 'work_mode',
      passed: true,
      hard: false,
      reason:
        'Job work mode is unknown; not treated as a hard fail (needs verification).',
    });
  }

  // Country preferences — hard fail only when location text clearly conflicts
  const countries = profile.location.preferredCountries ?? [];
  if (countries.length > 0 && job.locationText) {
    const match = countries.some((c) =>
      includesNormalized(job.locationText ?? '', c),
    );
    const remoteish =
      job.workMode === 'remote' ||
      includesNormalized(job.locationText, 'remote');
    if (!match && !remoteish) {
      // Only fail if location mentions a different known country-like token
      // vs preferred — conservative: fail when no preferred country appears
      // and location looks place-specific (contains comma or country-like word)
      const looksSpecific =
        /[A-Za-z]{2,}/.test(job.locationText) &&
        !includesNormalized(job.locationText, 'worldwide') &&
        !includesNormalized(job.locationText, 'anywhere');
      results.push({
        id: 'country',
        passed: !looksSpecific,
        hard: true,
        reason: looksSpecific
          ? `Location "${job.locationText}" does not match preferred countries (${countries.join(', ')}).`
          : 'Location is nonspecific relative to preferred countries.',
      });
    } else {
      results.push({
        id: 'country',
        passed: true,
        hard: true,
        reason: match
          ? 'Location matches a preferred country.'
          : 'Remote/worldwide location accepted against country preferences.',
      });
    }
  }

  // Relocation — hard fail when user refuses and job is clearly onsite elsewhere
  if (
    profile.location.relocationWillingness === 'no' &&
    job.workMode === 'onsite' &&
    profile.location.current &&
    job.locationText &&
    !includesNormalized(job.locationText, profile.location.current)
  ) {
    results.push({
      id: 'relocation',
      passed: false,
      hard: true,
      reason:
        'Candidate will not relocate; job appears onsite in a different location.',
    });
  } else if (profile.location.relocationWillingness === 'no') {
    results.push({
      id: 'relocation',
      passed: true,
      hard: true,
      reason:
        'No hard relocation conflict detected (job remote/unknown or locations align).',
    });
  }

  // Sponsorship — never invent availability
  const requires =
    prefs.workAuthorization?.requiresSponsorship ?? 'unknown';
  const signal = detectSponsorshipSignal(jobBlob);
  if (requires === 'yes' && signal === 'not_offered') {
    results.push({
      id: 'sponsorship',
      passed: false,
      hard: true,
      reason:
        'Candidate needs sponsorship; job text indicates sponsorship is not offered.',
    });
  } else if (requires === 'yes' && signal === 'unknown') {
    results.push({
      id: 'sponsorship',
      passed: true,
      hard: false,
      reason:
        'Candidate needs sponsorship; employer stance is unknown — needs verification.',
    });
  } else if (requires === 'yes' && signal === 'offered') {
    results.push({
      id: 'sponsorship',
      passed: true,
      hard: true,
      reason: 'Job text indicates sponsorship is available.',
    });
  } else {
    results.push({
      id: 'sponsorship',
      passed: true,
      hard: true,
      reason: 'No hard sponsorship conflict applied.',
    });
  }

  return results;
}

export function hardFilterOutcome(filters: HardFilterResult[]): {
  ineligible: boolean;
  needsVerification: boolean;
} {
  const hardFails = filters.filter((f) => f.hard && !f.passed);
  const softNotes = filters.filter((f) => !f.hard);
  return {
    ineligible: hardFails.length > 0,
    needsVerification: softNotes.some((f) =>
      f.reason.toLowerCase().includes('needs verification'),
    ),
  };
}
