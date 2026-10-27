import type { EmploymentInterval, FlexibleDate } from './candidate-profile';

function toMonthIndex(date: FlexibleDate | null | undefined): number | null {
  if (!date || date.year == null) return null;
  const month = date.month ?? 1;
  return date.year * 12 + (month - 1);
}

/**
 * Sum employment duration in whole months, collapsing overlapping intervals
 * so concurrent roles are not double-counted.
 */
export function calculateExperienceMonths(
  employment: EmploymentInterval[],
  asOf: Date = new Date(),
): number | null {
  const asOfMonths = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const ranges: Array<{ start: number; end: number }> = [];

  for (const job of employment) {
    const start = toMonthIndex(job.start);
    if (start == null) continue;
    let end: number | null;
    if (job.isCurrent) {
      end = asOfMonths;
    } else {
      end = toMonthIndex(job.end);
    }
    if (end == null) continue;
    if (end < start) continue;
    ranges.push({ start, end });
  }

  if (ranges.length === 0) return null;

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  return merged.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}
