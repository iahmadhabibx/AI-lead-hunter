import {
  CANDIDATE_PROFILE_SCHEMA_VERSION,
  JOB_NORMALIZATION_VERSION,
  type CandidateProfilePayload,
  type CanonicalJob,
} from '@aijh/contracts';

export function baseProfile(
  overrides: Partial<CandidateProfilePayload> = {},
): CandidateProfilePayload {
  const base: CandidateProfilePayload = {
    schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
    identity: { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: null, links: [] },
    location: {
      current: 'Berlin, Germany',
      preferredCountries: ['Germany'],
      relocationWillingness: 'no',
    },
    employment: [
      {
        id: 'e1',
        title: 'Senior Software Engineer',
        company: 'Acme',
        start: { year: 2018, month: 1, precision: 'month' },
        end: null,
        isCurrent: true,
      },
    ],
    totalExperienceMonths: 84,
    skills: [
      { name: 'TypeScript', evidenceIds: [] },
      { name: 'Node.js', evidenceIds: [] },
      { name: 'PostgreSQL', evidenceIds: [] },
    ],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    preferences: {
      preferredJobTitles: ['Software Engineer', 'Backend Engineer'],
      preferredIndustries: ['Software'],
      excludedIndustries: ['Gambling'],
      preferredWorkModes: ['remote', 'hybrid'],
      salary: { min: 80000, max: 140000, currency: 'EUR', period: 'year' },
      workAuthorization: { requiresSponsorship: 'no' },
    },
    evidence: [],
    missingFields: [],
    uncertainFields: [],
  };
  const mergedAuth = {
    requiresSponsorship: 'unknown' as const,
    ...base.preferences.workAuthorization,
    ...overrides.preferences?.workAuthorization,
  };
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...(overrides.identity ?? {}) },
    location: { ...base.location, ...(overrides.location ?? {}) },
    preferences: {
      ...base.preferences,
      ...(overrides.preferences ?? {}),
      workAuthorization: {
        ...mergedAuth,
        requiresSponsorship: mergedAuth.requiresSponsorship ?? 'unknown',
      },
      salary: overrides.preferences?.salary ?? base.preferences.salary,
    },
  };
}

export function baseJob(overrides: Partial<CanonicalJob> = {}): CanonicalJob {
  return {
    normalizationVersion: JOB_NORMALIZATION_VERSION,
    title: 'Senior Software Engineer',
    companyName: 'Example Corp',
    locationText: 'Berlin, Germany',
    descriptionText:
      'We need TypeScript, Node.js, and PostgreSQL. Remote-friendly hybrid team. Compensation around $120,000.',
    applyUrl: 'https://boards.greenhouse.io/example/jobs/1',
    sourceAttribution: 'greenhouse:example',
    departments: ['Engineering'],
    offices: ['Berlin'],
    workMode: 'hybrid',
    rawExtras: {},
    ...overrides,
  };
}
