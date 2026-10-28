import { describe, expect, it } from 'vitest';
import { PREFERENCE_LEARNING_VERSION } from '@aijh/contracts';
import { computeLearnedPreferences } from './learn';

describe('computeLearnedPreferences', () => {
  it('boosts titles from saved events without inventing sensitive traits', () => {
    const payload = computeLearnedPreferences([
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'saved',
        rejectionReasons: [],
        canonicalJobId: '22222222-2222-4222-8222-222222222222',
        jobTitle: 'Backend Engineer',
        jobWorkMode: 'remote',
        jobDepartments: ['Engineering'],
      },
    ]);
    expect(payload.learningVersion).toBe(PREFERENCE_LEARNING_VERSION);
    expect(payload.preferredJobTitles).toContain('Backend Engineer');
    expect(payload.preferredWorkModes).toContain('remote');
    expect(payload.inferences.length).toBeGreaterThan(0);
  });

  it('excludes industries and demotes work modes from rejection reasons', () => {
    const payload = computeLearnedPreferences([
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'rejected',
        rejectionReasons: ['unwanted_industry', 'wrong_work_mode'],
        canonicalJobId: '22222222-2222-4222-8222-222222222222',
        jobTitle: 'Casino Engineer',
        jobWorkMode: 'onsite',
        jobDepartments: ['Gambling'],
      },
    ]);
    expect(payload.excludedIndustries).toContain('Gambling');
    expect(payload.demotedWorkModes).toContain('onsite');
    expect(payload.preferredJobTitles).not.toContain('Casino Engineer');
  });

  it('is deterministic', () => {
    const events = [
      {
        id: '11111111-1111-4111-8111-111111111111' as const,
        type: 'interested' as const,
        rejectionReasons: [],
        canonicalJobId: '22222222-2222-4222-8222-222222222222',
        jobTitle: 'Platform Engineer',
        jobWorkMode: 'hybrid' as const,
      },
    ];
    const t = new Date('2026-01-01T00:00:00.000Z');
    expect(computeLearnedPreferences(events, t)).toEqual(
      computeLearnedPreferences(events, t),
    );
  });
});
