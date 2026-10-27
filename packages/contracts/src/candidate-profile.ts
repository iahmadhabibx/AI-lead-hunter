import { z } from 'zod';

/** Schema version for canonical candidate JSON. Bump when breaking. */
export const CANDIDATE_PROFILE_SCHEMA_VERSION = '1.0.0' as const;

export const EvidenceSchema = z.object({
  fieldPath: z.string().min(1),
  quote: z.string().max(2000).optional(),
  confidence: z.enum(['high', 'medium', 'low', 'unknown']).default('unknown'),
  source: z.enum(['cv_text', 'user_edit', 'system']).default('cv_text'),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const DatePrecisionSchema = z.enum(['day', 'month', 'year', 'unknown']);

export const FlexibleDateSchema = z.object({
  year: z.number().int().min(1900).max(2100).nullable(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  day: z.number().int().min(1).max(31).nullable().optional(),
  precision: DatePrecisionSchema.default('unknown'),
});

export type FlexibleDate = z.infer<typeof FlexibleDateSchema>;

export const EmploymentIntervalSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable().optional(),
  start: FlexibleDateSchema.nullable(),
  end: FlexibleDateSchema.nullable(),
  isCurrent: z.boolean().default(false),
  description: z.string().nullable().optional(),
  /** Explicit missing vs present */
  missing: z
    .object({
      title: z.boolean().optional(),
      company: z.boolean().optional(),
      start: z.boolean().optional(),
      end: z.boolean().optional(),
    })
    .optional(),
});

export type EmploymentInterval = z.infer<typeof EmploymentIntervalSchema>;

export const SkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  id: z.string().min(1),
  institution: z.string().nullable(),
  degree: z.string().nullable().optional(),
  field: z.string().nullable().optional(),
  start: FlexibleDateSchema.nullable().optional(),
  end: FlexibleDateSchema.nullable().optional(),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  description: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
});

export const CertificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  issuer: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
});

export const LanguageSchema = z.object({
  name: z.string().min(1),
  proficiency: z.string().nullable().optional(),
});

export const WorkModeSchema = z.enum(['onsite', 'hybrid', 'remote', 'unknown']);

/**
 * Canonical candidate profile payload (facts from CV + user corrections).
 * Preferences / ranking signals live elsewhere and must not be mixed in silently.
 */
export const CandidateProfilePayloadSchema = z.object({
  schemaVersion: z.literal(CANDIDATE_PROFILE_SCHEMA_VERSION),
  identity: z.object({
    fullName: z.string().nullable(),
    email: z.union([z.string().email(), z.null()]),
    phone: z.string().nullable().optional(),
    links: z.array(z.string().url()).default([]),
  }),
  location: z.object({
    current: z.string().nullable(),
    preferredCountries: z.array(z.string()).default([]),
    relocationWillingness: z
      .enum(['yes', 'no', 'unsure', 'unknown'])
      .default('unknown'),
  }),
  employment: z.array(EmploymentIntervalSchema).default([]),
  /** Calculated months of experience with overlap collapsed; null if unknown */
  totalExperienceMonths: z.number().int().nonnegative().nullable(),
  skills: z.array(SkillSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  preferences: z.object({
    preferredJobTitles: z.array(z.string()).default([]),
    preferredIndustries: z.array(z.string()).default([]),
    excludedIndustries: z.array(z.string()).default([]),
    preferredWorkModes: z.array(WorkModeSchema).default([]),
    salary: z
      .object({
        min: z.number().nonnegative().nullable().optional(),
        max: z.number().nonnegative().nullable().optional(),
        currency: z.string().nullable().optional(),
        period: z.enum(['year', 'month', 'hour', 'unknown']).default('unknown'),
      })
      .optional(),
    workAuthorization: z
      .object({
        status: z.string().nullable().optional(),
        requiresSponsorship: z
          .enum(['yes', 'no', 'unknown'])
          .default('unknown'),
      })
      .optional(),
  }),
  evidence: z.array(EvidenceSchema).default([]),
  missingFields: z.array(z.string()).default([]),
  uncertainFields: z.array(z.string()).default([]),
});

export type CandidateProfilePayload = z.infer<
  typeof CandidateProfilePayloadSchema
>;

export const ProfileVersionStatusSchema = z.enum([
  'pending_review',
  'approved',
  'superseded',
]);

export type ProfileVersionStatus = z.infer<typeof ProfileVersionStatusSchema>;

export const CvDocumentStatusSchema = z.enum([
  'uploaded',
  'processing',
  'extracted',
  'failed',
]);

export type CvDocumentStatus = z.infer<typeof CvDocumentStatusSchema>;

export const CvUploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  taskId: z.string().uuid(),
  status: CvDocumentStatusSchema,
});

export type CvUploadResponse = z.infer<typeof CvUploadResponseSchema>;

export const ProfileVersionPublicSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: ProfileVersionStatusSchema,
  schemaVersion: z.string(),
  payload: CandidateProfilePayloadSchema,
  sourceDocumentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
});

export type ProfileVersionPublic = z.infer<typeof ProfileVersionPublicSchema>;

export function emptyCandidateProfile(): CandidateProfilePayload {
  return {
    schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
    identity: { fullName: null, email: null, phone: null, links: [] },
    location: {
      current: null,
      preferredCountries: [],
      relocationWillingness: 'unknown',
    },
    employment: [],
    totalExperienceMonths: null,
    skills: [],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    preferences: {
      preferredJobTitles: [],
      preferredIndustries: [],
      excludedIndustries: [],
      preferredWorkModes: [],
    },
    evidence: [],
    missingFields: [
      'identity.fullName',
      'employment',
      'skills',
    ],
    uncertainFields: [],
  };
}
