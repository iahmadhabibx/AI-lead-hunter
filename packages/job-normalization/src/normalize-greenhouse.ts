import {
  CanonicalJobSchema,
  JOB_NORMALIZATION_VERSION,
  type CanonicalJob,
} from '@aijh/contracts';
import { stripHtml } from './text';

export function normalizeGreenhouseJob(
  raw: Record<string, unknown>,
  opts: { boardToken: string; companyName?: string | null },
): CanonicalJob {
  const title = String(raw.title ?? '').trim();
  const absoluteUrl = String(raw.absolute_url ?? '').trim();
  if (!title || !absoluteUrl) {
    throw new Error('Greenhouse job missing title or absolute_url');
  }

  const location =
    raw.location && typeof raw.location === 'object'
      ? String((raw.location as { name?: unknown }).name ?? '') || null
      : null;

  const departments = Array.isArray(raw.departments)
    ? raw.departments
        .map((d) =>
          d && typeof d === 'object'
            ? String((d as { name?: unknown }).name ?? '')
            : '',
        )
        .filter(Boolean)
    : [];

  const offices = Array.isArray(raw.offices)
    ? raw.offices
        .map((o) =>
          o && typeof o === 'object'
            ? String((o as { name?: unknown }).name ?? '')
            : '',
        )
        .filter(Boolean)
    : [];

  const html =
    typeof raw.content === 'string' ? raw.content : null;
  const updatedAtSource =
    typeof raw.updated_at === 'string'
      ? new Date(raw.updated_at).toISOString()
      : null;

  return CanonicalJobSchema.parse({
    normalizationVersion: JOB_NORMALIZATION_VERSION,
    title,
    companyName: opts.companyName ?? opts.boardToken,
    locationText: location,
    descriptionText: html ? stripHtml(html) : null,
    descriptionHtml: html,
    applyUrl: absoluteUrl,
    sourceAttribution: `Greenhouse board:${opts.boardToken}`,
    departments,
    offices,
    workMode: 'unknown',
    publishedAt: null,
    updatedAtSource,
    rawExtras: {
      internal_job_id: raw.internal_job_id ?? null,
      requisition_id: raw.requisition_id ?? null,
      language: raw.language ?? null,
    },
  });
}
