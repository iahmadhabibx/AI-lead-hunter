import { describe, expect, it } from 'vitest';
import { calculateExperienceMonths } from './experience';
import type { EmploymentInterval } from './candidate-profile';

function job(
  partial: Partial<EmploymentInterval> &
    Pick<EmploymentInterval, 'id' | 'start' | 'end' | 'isCurrent'>,
): EmploymentInterval {
  return {
    title: partial.title ?? 'Engineer',
    company: partial.company ?? 'Acme',
    id: partial.id,
    start: partial.start,
    end: partial.end,
    isCurrent: partial.isCurrent,
  };
}

describe('calculateExperienceMonths', () => {
  it('returns null when no dated employment', () => {
    expect(
      calculateExperienceMonths([
        job({
          id: '1',
          start: null,
          end: null,
          isCurrent: false,
        }),
      ]),
    ).toBeNull();
  });

  it('counts a single interval inclusively by month', () => {
    const months = calculateExperienceMonths([
      job({
        id: '1',
        start: { year: 2020, month: 1, precision: 'month' },
        end: { year: 2020, month: 3, precision: 'month' },
        isCurrent: false,
      }),
    ]);
    expect(months).toBe(3);
  });

  it('does not double-count overlapping jobs', () => {
    const months = calculateExperienceMonths([
      job({
        id: '1',
        start: { year: 2020, month: 1, precision: 'month' },
        end: { year: 2021, month: 6, precision: 'month' },
        isCurrent: false,
      }),
      job({
        id: '2',
        start: { year: 2020, month: 6, precision: 'month' },
        end: { year: 2021, month: 12, precision: 'month' },
        isCurrent: false,
      }),
    ]);
    // Jan 2020 – Dec 2021 inclusive = 24 months
    expect(months).toBe(24);
  });
});
