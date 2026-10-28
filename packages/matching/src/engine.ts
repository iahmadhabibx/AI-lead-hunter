import {
  MATCH_SCORING_VERSION,
  MatchResultPayloadSchema,
  type CandidateProfilePayload,
  type CanonicalJob,
  type MatchResultPayload,
} from '@aijh/contracts';
import { scoreComponents } from './components';
import { evaluateHardFilters, hardFilterOutcome } from './hard-filters';

export type MatchInput = {
  profile: CandidateProfilePayload;
  job: CanonicalJob;
  jobStatus?: 'active' | 'stale' | 'closed' | 'unknown';
  jobContentHash: string;
  profileVersionId: string;
};

export type MatchOutput = MatchResultPayload & {
  profileVersionId: string;
  jobContentHash: string;
  scoringVersion: typeof MATCH_SCORING_VERSION;
};

/**
 * Deterministic matching. Suitability is a weighted score, never a hiring probability.
 * Unknown component scores are excluded from the weighted average (not treated as 1.0).
 */
export function matchProfileToJob(input: MatchInput): MatchOutput {
  const hardFilters = evaluateHardFilters({
    profile: input.profile,
    job: input.job,
    jobStatus: input.jobStatus,
  });
  const { ineligible, needsVerification } = hardFilterOutcome(hardFilters);
  const { components, evidence } = scoreComponents(input.profile, input.job);

  const scored = components.filter(
    (c) => c.status === 'scored' && c.score != null,
  );
  let suitabilityPercent: number | null = null;
  if (scored.length > 0) {
    const weightSum = scored.reduce((s, c) => s + c.weight, 0);
    if (weightSum > 0) {
      const weighted =
        scored.reduce((s, c) => s + c.weight * (c.score as number), 0) /
        weightSum;
      suitabilityPercent = Math.round(weighted * 1000) / 10;
    }
  }

  const missingRequirements = evidence
    .filter((e) => e.kind === 'missing')
    .map((e) => e.message);
  const unknownFields = evidence
    .filter((e) => e.kind === 'unknown')
    .map((e) => e.message);

  let band: MatchResultPayload['band'] = 'eligible';
  if (ineligible) band = 'ineligible';
  else if (needsVerification || unknownFields.some((u) => /sponsorship/i.test(u)))
    band = 'needs_verification';

  const payload = MatchResultPayloadSchema.parse({
    scoringVersion: MATCH_SCORING_VERSION,
    band,
    suitabilityPercent: ineligible ? null : suitabilityPercent,
    hardFilters,
    components,
    evidence,
    missingRequirements,
    unknownFields,
  });

  return {
    ...payload,
    profileVersionId: input.profileVersionId,
    jobContentHash: input.jobContentHash,
    scoringVersion: MATCH_SCORING_VERSION,
  };
}
