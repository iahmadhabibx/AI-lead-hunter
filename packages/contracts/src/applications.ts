import { z } from 'zod';

/** Bump when draft generation prompt/template semantics change. */
export const DRAFT_GENERATION_VERSION = '1.0.0' as const;

export const ApplicationStatusSchema = z.enum([
  'drafting',
  'ready_for_review',
  'approved',
  'applied',
  'withdrawn',
  'archived',
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const DocumentTypeSchema = z.enum([
  'tailored_cv',
  'cover_letter',
  'application_answers',
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'superseded',
]);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  supported: z.boolean(),
  evidencePaths: z.array(z.string()).default([]),
  evidenceQuotes: z.array(z.string()).default([]),
  reason: z.string().optional(),
});

export type DocumentClaim = z.infer<typeof DocumentClaimSchema>;

export const GenerationProvenanceSchema = z.object({
  generationVersion: z.literal(DRAFT_GENERATION_VERSION),
  provider: z.enum(['mock', 'ollama', 'template']),
  model: z.string(),
  promptVersion: z.string(),
  profileVersionId: z.string().uuid(),
  jobContentHash: z.string(),
  canonicalJobId: z.string().uuid(),
  generatedAt: z.string().datetime(),
});

export type GenerationProvenance = z.infer<typeof GenerationProvenanceSchema>;

export const GeneratedDocumentPayloadSchema = z.object({
  schemaVersion: z.literal(DRAFT_GENERATION_VERSION),
  type: DocumentTypeSchema,
  title: z.string(),
  contentMarkdown: z.string(),
  claims: z.array(DocumentClaimSchema).default([]),
  unsupportedClaims: z.array(z.string()).default([]),
  missingEvidenceNotes: z.array(z.string()).default([]),
  disclaimer: z
    .string()
    .default(
      'Draft grounded only in approved profile evidence and the job description. Human review required. Never submitted automatically.',
    ),
});

export type GeneratedDocumentPayload = z.infer<
  typeof GeneratedDocumentPayloadSchema
>;

export const ApplicationCreateSchema = z.object({
  canonicalJobId: z.string().uuid(),
  matchResultId: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
});

export type ApplicationCreate = z.infer<typeof ApplicationCreateSchema>;

export const ApplicationStatusUpdateSchema = z.object({
  status: ApplicationStatusSchema,
  note: z.string().max(2000).optional(),
});

export type ApplicationStatusUpdate = z.infer<
  typeof ApplicationStatusUpdateSchema
>;

export const DraftGenerateRequestSchema = z.object({
  applicationId: z.string().uuid(),
  types: z
    .array(DocumentTypeSchema)
    .min(1)
    .optional()
    .default(['tailored_cv', 'cover_letter', 'application_answers']),
});

export type DraftGenerateRequest = z.infer<typeof DraftGenerateRequestSchema>;

export const DocumentUpdateSchema = z.object({
  contentMarkdown: z.string().min(1).max(100_000),
});

export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;
