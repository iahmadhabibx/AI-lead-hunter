import {
  CanonicalJobSchema,
  JOB_NORMALIZATION_VERSION,
  type CanonicalJob,
} from '@aijh/contracts';
import { stripHtml } from './text';

export function normalizeLeverJob(
  raw: Record<string, unknown>,
  opts: { site: string; companyName?: string | null },
): CanonicalJob {
  const title = String(raw.text ?? '').trim();
  const applyUrl = String(raw.applyUrl ?? raw.hostedUrl ?? '').trim();
  if (!title || !applyUrl) {
    throw new Error('Lever posting missing text or apply/hosted URL');
  }

  const categories =
    raw.categories && typeof raw.categories === 'object'
      ? (raw.categories as Record<string, unknown>)
      : {};

  const locationText =
    typeof categories.location === 'string' ? categories.location : null;
  const team = typeof categories.team === 'string' ? categories.team : null;
  const department =
    typeof categories.department === 'string' ? categories.department : null;

  const htmlParts = [
    typeof raw.opening === 'string' ? raw.opening : '',
    typeof raw.description === 'string' ? raw.description : '',
    typeof raw.additional === 'string' ? raw.additional : '',
  ].filter(Boolean);
  const html = htmlParts.length ? htmlParts.join('\n') : null;

  const plainParts = [
    typeof raw.openingPlain === 'string' ? raw.openingPlain : '',
    typeof raw.descriptionPlain === 'string' ? raw.descriptionPlain : '',
    typeof raw.additionalPlain === 'string' ? raw.additionalPlain : '',
  ].filter(Boolean);

  const workplace =
    typeof raw.workplaceType === 'string'
      ? raw.workplaceType.toLowerCase()
      : '';
  const workMode =
    workplace.includes('remote')
      ? 'remote'
      : workplace.includes('hybrid')
        ? 'hybrid'
        : workplace.includes('onsite') || workplace.includes('on-site')
          ? 'onsite'
          : 'unknown';

  const createdAt =
    typeof raw.createdAt === 'number'
      ? new Date(raw.createdAt).toISOString()
      : null;

  return CanonicalJobSchema.parse({
    normalizationVersion: JOB_NORMALIZATION_VERSION,
    title,
    companyName: opts.companyName ?? opts.site,
    locationText,
    descriptionText: plainParts.length
      ? plainParts.join('\n\n')
      : html
        ? stripHtml(html)
        : null,
    descriptionHtml: html,
    applyUrl,
    sourceAttribution: `Lever site:${opts.site}`,
    departments: [department, team].filter((x): x is string => Boolean(x)),
    offices: locationText ? [locationText] : [],
    workMode,
    publishedAt: createdAt,
    updatedAtSource: null,
    rawExtras: {
      commitment: categories.commitment ?? null,
      country: raw.country ?? null,
      workplaceType: raw.workplaceType ?? null,
      hostedUrl: raw.hostedUrl ?? null,
    },
  });
}
