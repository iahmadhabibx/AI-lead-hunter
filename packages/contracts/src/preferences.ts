import { z } from 'zod';
import { WorkModeSchema } from './candidate-profile';
import { RejectionReasonSchema } from './matching';

/** Bump when preference-learning rules change. */
export const PREFERENCE_LEARNING_VERSION = '1.0.0' as const;

export const LearnedPreferencesPayloadSchema = z.object({
  learningVersion: z.literal(PREFERENCE_LEARNING_VERSION),
  preferredJobTitles: z.array(z.string()).default([]),
  preferredIndustries: z.array(z.string()).default([]),
  excludedIndustries: z.array(z.string()).default([]),
  preferredWorkModes: z.array(WorkModeSchema).default([]),
  demotedWorkModes: z.array(WorkModeSchema).default([]),
  /** Transparent rule audit trail (not model inference) */
  inferences: z
    .array(
      z.object({
        ruleId: z.string(),
        fromEventIds: z.array(z.string().uuid()),
        message: z.string(),
        rejectionReasons: z.array(RejectionReasonSchema).default([]),
      }),
    )
    .default([]),
  sourceEventCount: z.number().int().nonnegative().default(0),
  computedAt: z.string().datetime(),
});

export type LearnedPreferencesPayload = z.infer<
  typeof LearnedPreferencesPayloadSchema
>;

export const LearnedPreferencesPublicSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: z.enum(['active', 'reset']),
  payload: LearnedPreferencesPayloadSchema,
  createdAt: z.string().datetime(),
  resetAt: z.string().datetime().nullable(),
  note: z
    .string()
    .default(
      'Learned preferences are deterministic summaries of your feedback events. Explicit profile preferences always override them. CV facts are never mutated.',
    ),
});

export type LearnedPreferencesPublic = z.infer<
  typeof LearnedPreferencesPublicSchema
>;
