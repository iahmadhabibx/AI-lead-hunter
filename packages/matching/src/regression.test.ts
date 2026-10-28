/**
 * Regression suite for hard-constraint violations.
 * These cases must remain ineligible / needs_verification across scoring versions
 * unless MATCH_SCORING_VERSION is intentionally bumped with documented migration notes.
 */
import { describe, expect, it } from 'vitest';
import { matchProfileToJob } from './engine';
import { baseJob, baseProfile } from './fixtures';

const cases: Array<{
  name: string;
  expectBand: 'ineligible' | 'needs_verification' | 'eligible';
  filterId?: string;
  build: () => Parameters<typeof matchProfileToJob>[0];
}> = [
  {
    name: 'closed listing',
    expectBand: 'ineligible',
    filterId: 'job_status',
    build: () => ({
      profile: baseProfile(),
      job: baseJob(),
      jobStatus: 'closed',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'remote-only vs onsite',
    expectBand: 'ineligible',
    filterId: 'work_mode',
    build: () => ({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['remote'],
        },
      }),
      job: baseJob({ workMode: 'onsite' }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'excluded industry keyword',
    expectBand: 'ineligible',
    filterId: 'excluded_industry',
    build: () => ({
      profile: baseProfile(),
      job: baseJob({
        departments: ['Gambling'],
        descriptionText: 'Casino TypeScript role',
      }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'no relocate + onsite elsewhere',
    expectBand: 'ineligible',
    filterId: 'relocation',
    build: () => ({
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
        locationText: 'Tokyo, Japan',
        descriptionText: 'TypeScript onsite Tokyo',
      }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'sponsorship required + not offered',
    expectBand: 'ineligible',
    filterId: 'sponsorship',
    build: () => ({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['hybrid'],
          workAuthorization: { requiresSponsorship: 'yes' },
        },
      }),
      job: baseJob({
        descriptionText: 'TypeScript. No visa sponsorship.',
      }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'sponsorship required + unknown must not invent eligibility',
    expectBand: 'needs_verification',
    filterId: 'sponsorship',
    build: () => ({
      profile: baseProfile({
        preferences: {
          preferredJobTitles: ['Software Engineer'],
          preferredIndustries: ['Software'],
          excludedIndustries: [],
          preferredWorkModes: ['hybrid'],
          workAuthorization: { requiresSponsorship: 'yes' },
        },
      }),
      job: baseJob({
        descriptionText: 'TypeScript and Node.js in Berlin, Germany.',
      }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
  {
    name: 'country mismatch for place-specific non-remote job',
    expectBand: 'ineligible',
    filterId: 'country',
    build: () => ({
      profile: baseProfile({
        location: {
          current: 'Berlin, Germany',
          preferredCountries: ['Germany'],
          relocationWillingness: 'yes',
        },
        preferences: {
          preferredJobTitles: ['Engineer'],
          preferredIndustries: [],
          excludedIndustries: [],
          preferredWorkModes: ['onsite', 'hybrid', 'remote'],
        },
      }),
      job: baseJob({
        workMode: 'hybrid',
        locationText: 'Austin, Texas, USA',
        descriptionText: 'TypeScript hybrid in Austin',
      }),
      jobStatus: 'active',
      jobContentHash: 'h',
      profileVersionId: 'v',
    }),
  },
];

describe('matching hard-constraint regressions', () => {
  for (const c of cases) {
    it(c.name, () => {
      const result = matchProfileToJob(c.build());
      expect(result.band).toBe(c.expectBand);
      if (c.filterId) {
        const filter = result.hardFilters.find((f) => f.id === c.filterId);
        expect(filter).toBeTruthy();
        if (c.expectBand === 'ineligible') {
          expect(filter!.passed).toBe(false);
          expect(filter!.hard).toBe(true);
          expect(result.suitabilityPercent).toBeNull();
        }
      }
    });
  }
});
