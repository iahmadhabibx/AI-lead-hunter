import { describe, expect, it } from 'vitest';
import { MATCH_SCORING_VERSION } from '@aijh/contracts';
import { detectSponsorshipSignal } from './text';
import { matchProfileToJob } from './engine';
import { baseJob, baseProfile } from './fixtures';

describe('detectSponsorshipSignal', () => {
  it('returns unknown when text is silent', () => {
    expect(detectSponsorshipSignal('Build APIs')).toBe('unknown');
  });
  it('detects not offered without inventing offer', () => {
    expect(
      detectSponsorshipSignal('Must have unrestricted work authorization. No visa sponsorship.'),
    ).toBe('not_offered');
  });
  it('detects offered when evidenced', () => {
    expect(
      detectSponsorshipSignal('Visa sponsorship available for qualified candidates.'),
    ).toBe('offered');
  });
});

describe('matchProfileToJob', () => {
  it('scores an eligible job with versioned breakdown', () => {
    const result = matchProfileToJob({
      profile: baseProfile(),
      job: baseJob(),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: '00000000-0000-4000-8000-000000000001',
    });
    expect(result.scoringVersion).toBe(MATCH_SCORING_VERSION);
    expect(result.band).toBe('eligible');
    expect(result.suitabilityPercent).not.toBeNull();
    expect(result.suitabilityPercent!).toBeGreaterThan(40);
    expect(result.components).toHaveLength(6);
    expect(result.disclaimer).toMatch(/not a prediction/i);
  });

  it('hard-fails closed jobs', () => {
    const result = matchProfileToJob({
      profile: baseProfile(),
      job: baseJob(),
      jobStatus: 'closed',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('ineligible');
    expect(result.suitabilityPercent).toBeNull();
    expect(result.hardFilters.some((f) => f.id === 'job_status' && !f.passed)).toBe(
      true,
    );
  });

  it('hard-fails incompatible work mode when both known', () => {
    const result = matchProfileToJob({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['remote'],
        },
      }),
      job: baseJob({ workMode: 'onsite', locationText: 'Berlin, Germany' }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('ineligible');
    expect(result.hardFilters.find((f) => f.id === 'work_mode')?.passed).toBe(false);
  });

  it('hard-fails excluded industry', () => {
    const result = matchProfileToJob({
      profile: baseProfile(),
      job: baseJob({
        title: 'Casino Platform Engineer',
        descriptionText: 'Gambling platform backend',
        departments: ['Gambling'],
      }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('ineligible');
    expect(
      result.hardFilters.find((f) => f.id === 'excluded_industry')?.passed,
    ).toBe(false);
  });

  it('hard-fails relocation when user refuses and job is onsite elsewhere', () => {
    const result = matchProfileToJob({
      profile: baseProfile({
        location: {
          current: 'Berlin, Germany',
          preferredCountries: ['Germany'],
          relocationWillingness: 'no',
        },
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['onsite', 'hybrid', 'remote'],
        },
      }),
      job: baseJob({
        workMode: 'onsite',
        locationText: 'San Francisco, USA',
        descriptionText: 'TypeScript onsite role in SF',
      }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('ineligible');
    expect(result.hardFilters.find((f) => f.id === 'relocation')?.passed).toBe(
      false,
    );
  });

  it('hard-fails when sponsorship required but job says not offered', () => {
    const result = matchProfileToJob({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['remote', 'hybrid'],
          workAuthorization: { requiresSponsorship: 'yes' },
        },
      }),
      job: baseJob({
        descriptionText:
          'TypeScript role. No visa sponsorship. Must have unrestricted work authorization.',
      }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('ineligible');
    expect(result.hardFilters.find((f) => f.id === 'sponsorship')?.passed).toBe(
      false,
    );
  });

  it('marks needs_verification when sponsorship required but unknown', () => {
    const result = matchProfileToJob({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Software Engineer'],
          preferredIndustries: ['Software'],
          excludedIndustries: [],
          preferredWorkModes: ['remote', 'hybrid'],
          workAuthorization: { requiresSponsorship: 'yes' },
        },
      }),
      job: baseJob({
        descriptionText: 'TypeScript and Node.js hybrid role in Berlin, Germany.',
      }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    expect(result.band).toBe('needs_verification');
    expect(result.suitabilityPercent).not.toBeNull();
    expect(
      result.hardFilters.find((f) => f.id === 'sponsorship')?.hard,
    ).toBe(false);
  });

  it('does not treat unknown compensation as a positive score', () => {
    const result = matchProfileToJob({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Software Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['hybrid'],
          // no salary preference
        },
      }),
      job: baseJob({
        descriptionText: 'TypeScript engineer. No salary listed.',
      }),
      jobStatus: 'active',
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    });
    const comp = result.components.find((c) => c.id === 'compensation');
    expect(comp?.status).toBe('unknown');
    expect(comp?.score).toBeNull();
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      profile: baseProfile(),
      job: baseJob(),
      jobStatus: 'active' as const,
      jobContentHash: 'abc',
      profileVersionId: 'v1',
    };
    const a = matchProfileToJob(input);
    const b = matchProfileToJob(input);
    expect(a).toEqual(b);
  });
});
