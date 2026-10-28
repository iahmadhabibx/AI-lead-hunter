import { z } from 'zod';

/** Bump when scoring weights or hard-filter semantics change. */
export const MATCH_SCORING_VERSION = '1.0.0' as const;

export const DEFAULT_MATCH_WEIGHTS = {
  skills: 0.3,
  experience: 0.25,
  role: 0.15,
  workModeLocation: 0.15,
  compensation: 0.1,
  industry: 0.05,
} as const;

export const MatchComponentIdSchema = z.enum([
  'skills',
  'experience',
  'role',
  'workModeLocation',
  'compensation',
  'industry',
]);

export type MatchComponentId = z.infer<typeof MatchComponentIdSchema>;

export const MatchBandSchema = z.enum([
  'eligible',
  'needs_verification',
  'ineligible',
]);

export type MatchBand = z.infer<typeof MatchBandSchema>;

export const HardFilterResultSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  reason: z.string(),
  /** When true, failure is hard ineligibility */
  hard: z.boolean().default(true),
});

export type HardFilterResult = z.infer<typeof HardFilterResultSchema>;

export const MatchEvidenceSchema = z.object({
  component: MatchComponentIdSchema.optional(),
  kind: z.enum(['support', 'missing', 'unknown', 'conflict']),
  message: z.string(),
  jobQuote: z.string().optional(),
  profilePath: z.string().optional(),
});

export type MatchEvidence = z.infer<typeof MatchEvidenceSchema>;

export const ComponentScoreSchema = z.object({
  id: MatchComponentIdSchema,
  weight: z.number().min(0).max(1),
  score: z.number().min(0).max(1).nullable(),
  /** null score means unknown — does not count as positive */
  status: z.enum(['scored', 'unknown', 'skipped']),
  explanation: z.string(),
});

export type ComponentScore = z.infer<typeof ComponentScoreSchema>;

export const MatchResultPayloadSchema = z.object({
  scoringVersion: z.literal(MATCH_SCORING_VERSION),
  band: MatchBandSchema,
  /** Weighted suitability 0–100; NOT interview/hiring probability */
  suitabilityPercent: z.number().min(0).max(100).nullable(),
  hardFilters: z.array(HardFilterResultSchema),
  components: z.array(ComponentScoreSchema),
  evidence: z.array(MatchEvidenceSchema),
  missingRequirements: z.array(z.string()).default([]),
  unknownFields: z.array(z.string()).default([]),
  disclaimer:
    z.string().default(
      'Suitability score is a deterministic weighted comparison, not a prediction of interview or hiring outcomes.',
    ),
});

export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;

export const FeedbackEventTypeSchema = z.enum([
  'interested',
  'saved',
  'unsaved',
  'rejected',
  'applied',
  'interview_received',
  'offer_received',
  'marked_expired',
  'marked_irrelevant',
]);

export type FeedbackEventType = z.infer<typeof FeedbackEventTypeSchema>;

export const RejectionReasonSchema = z.enum([
  'wrong_role',
  'insufficient_compensation',
  'wrong_location',
  'wrong_work_mode',
  'wrong_seniority',
  'missing_sponsorship',
  'unwanted_industry',
  'duplicate_listing',
  'expired_or_poor_quality',
  'other',
]);

export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const FeedbackCreateSchema = z.object({
  canonicalJobId: z.string().uuid(),
  type: FeedbackEventTypeSchema,
  rejectionReasons: z.array(RejectionReasonSchema).default([]),
  note: z.string().max(2000).optional(),
  matchResultId: z.string().uuid().optional(),
});

export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;
