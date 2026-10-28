import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_PROFILE_SCHEMA_VERSION,
  JOB_NORMALIZATION_VERSION,
  DRAFT_GENERATION_VERSION,
} from '@aijh/contracts';
import { generateGroundedDrafts } from './generate';
import { validateDraftClaims } from './claims';
import { buildEvidenceCorpus } from './evidence';
import { exportDocumentMarkdown } from './export';

function profile() {
  return {
    schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
    identity: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      links: [],
    },
    location: {
      current: 'London, UK',
      preferredCountries: ['UK'],
      relocationWillingness: 'unknown' as const,
    },
    employment: [
      {
        id: 'e1',
        title: 'Software Engineer',
        company: 'Analytical Engines',
        start: { year: 2020, month: 1, precision: 'month' as const },
        end: null,
        isCurrent: true,
        description: 'Built TypeScript services and PostgreSQL data pipelines.',
      },
    ],
    totalExperienceMonths: 48,
    skills: [
      { name: 'TypeScript', evidenceIds: [] },
      { name: 'PostgreSQL', evidenceIds: [] },
    ],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    preferences: {
      preferredJobTitles: [],
      preferredIndustries: [],
      excludedIndustries: [],
      preferredWorkModes: [],
      workAuthorization: { requiresSponsorship: 'unknown' as const },
    },
    evidence: [],
    missingFields: [],
    uncertainFields: [],
  };
}

function job() {
  return {
    normalizationVersion: JOB_NORMALIZATION_VERSION,
    title: 'Backend Engineer',
    companyName: 'Example Co',
    locationText: 'Remote',
    descriptionText: 'Need TypeScript and PostgreSQL experience.',
    applyUrl: 'https://boards.greenhouse.io/example/jobs/1',
    sourceAttribution: 'greenhouse:example',
    departments: ['Engineering'],
    offices: [],
    workMode: 'remote' as const,
    rawExtras: {},
  };
}

describe('generateGroundedDrafts', () => {
  it('produces versioned drafts with provenance and no invented employers', () => {
    const result = generateGroundedDrafts({
      profile: profile(),
      job: job(),
      profileVersionId: '11111111-1111-4111-8111-111111111111',
      jobContentHash: 'abc',
      canonicalJobId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.provenance.generationVersion).toBe(DRAFT_GENERATION_VERSION);
    expect(result.documents).toHaveLength(3);
    const cv = result.documents.find((d) => d.type === 'tailored_cv')!;
    expect(cv.contentMarkdown).toContain('Ada Lovelace');
    expect(cv.contentMarkdown).toContain('Analytical Engines');
    expect(cv.contentMarkdown).not.toMatch(/Google|Meta|PhD/i);
    expect(cv.disclaimer).toMatch(/Human review required/i);
  });

  it('flags unsupported claims that are not in profile evidence', () => {
    const corpus = buildEvidenceCorpus(profile());
    const forged = [
      '# Cover',
      '- TypeScript',
      'I am certified Kubernetes Administrator',
      'worked at Google',
    ].join('\n');
    const { unsupportedClaims } = validateDraftClaims(forged, corpus);
    expect(unsupportedClaims.some((c) => /kubernetes|google/i.test(c))).toBe(
      true,
    );
    // evidenced skill should be supported
    const { claims } = validateDraftClaims('- TypeScript\n', corpus);
    expect(claims.find((c) => c.text === 'TypeScript')?.supported).toBe(true);
  });

  it('exports markdown with provenance markers', () => {
    const result = generateGroundedDrafts({
      profile: profile(),
      job: job(),
      profileVersionId: '11111111-1111-4111-8111-111111111111',
      jobContentHash: 'abc',
      canonicalJobId: '22222222-2222-4222-8222-222222222222',
      types: ['cover_letter'],
    });
    const exported = exportDocumentMarkdown(result.documents[0]!, {
      applicationId: '33333333-3333-4333-8333-333333333333',
    });
    expect(exported.filename).toBe('cover-letter.md');
    expect(exported.body).toContain('ForgePath export');
    expect(exported.mimeType).toContain('markdown');
  });
});
