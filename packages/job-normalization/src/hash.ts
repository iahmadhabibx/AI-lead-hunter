import { createHash } from 'node:crypto';
import type { CanonicalJob } from '@aijh/contracts';

/** Stable content hash for idempotent upserts / change detection. */
export function contentHashForCanonicalJob(job: CanonicalJob): string {
  const material = JSON.stringify({
    v: job.normalizationVersion,
    title: job.title,
    companyName: job.companyName,
    locationText: job.locationText,
    descriptionText: job.descriptionText,
    applyUrl: job.applyUrl,
    departments: job.departments,
    offices: job.offices,
    workMode: job.workMode,
  });
  return createHash('sha256').update(material).digest('hex');
}

export function dedupeKey(
  provider: string,
  boardKey: string,
  sourceJobId: string,
): string {
  return `${provider}:${boardKey}:${sourceJobId}`;
}
