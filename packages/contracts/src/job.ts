import { z } from 'zod';

export const JOB_NORMALIZATION_VERSION = '1.0.0' as const;

export const JobListingStatusSchema = z.enum([
  'active',
  'stale',
  'closed',
  'unknown',
]);

export type JobListingStatus = z.infer<typeof JobListingStatusSchema>;

export const JobSourceProviderSchema = z.enum(['greenhouse', 'lever']);

export type JobSourceProvider = z.infer<typeof JobSourceProviderSchema>;

export const CanonicalJobSchema = z.object({
  normalizationVersion: z.literal(JOB_NORMALIZATION_VERSION),
  title: z.string().min(1),
  companyName: z.string().nullable(),
  locationText: z.string().nullable(),
  descriptionText: z.string().nullable(),
  descriptionHtml: z.string().nullable().optional(),
  applyUrl: z.string().url(),
  sourceAttribution: z.string().min(1),
  departments: z.array(z.string()).default([]),
  offices: z.array(z.string()).default([]),
  workMode: z
    .enum(['onsite', 'hybrid', 'remote', 'unknown'])
    .default('unknown'),
  publishedAt: z.string().datetime().nullable().optional(),
  updatedAtSource: z.string().datetime().nullable().optional(),
  rawExtras: z.record(z.unknown()).default({}),
});

export type CanonicalJob = z.infer<typeof CanonicalJobSchema>;

export const GreenhouseBoardConfigSchema = z.object({
  type: z.literal('greenhouse'),
  key: z.string().min(1),
  boardToken: z.string().min(1),
  enabled: z.boolean().default(true),
  displayName: z.string().optional(),
});

export type GreenhouseBoardConfig = z.infer<typeof GreenhouseBoardConfigSchema>;

export const LeverSiteConfigSchema = z.object({
  type: z.literal('lever'),
  key: z.string().min(1),
  site: z.string().min(1),
  /** Use EU postings host when true */
  eu: z.boolean().default(false),
  enabled: z.boolean().default(true),
  displayName: z.string().optional(),
});

export type LeverSiteConfig = z.infer<typeof LeverSiteConfigSchema>;

export const JobSourceConfigSchema = z.discriminatedUnion('type', [
  GreenhouseBoardConfigSchema,
  LeverSiteConfigSchema,
]);

export type JobSourceConfig = z.infer<typeof JobSourceConfigSchema>;

export const JobSourcesFileSchema = z.object({
  sources: z.array(JobSourceConfigSchema).default([]),
});

export function parseJobSourcesJson(raw: string | undefined): JobSourceConfig[] {
  if (!raw || !raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return z.array(JobSourceConfigSchema).parse(parsed);
  }
  return JobSourcesFileSchema.parse(parsed).sources;
}
