import { describe, expect, it } from 'vitest';
import { contentHashForCanonicalJob, dedupeKey } from './hash';
import { normalizeGreenhouseJob } from './normalize-greenhouse';
import { normalizeLeverJob } from './normalize-lever';

describe('normalizeGreenhouseJob', () => {
  it('maps official board fields without inventing content', () => {
    const job = normalizeGreenhouseJob(
      {
        id: 127817,
        title: 'Vault Designer',
        absolute_url: 'https://boards.greenhouse.io/vaulttec/jobs/127817',
        updated_at: '2016-01-14T10:55:28-05:00',
        location: { name: 'NYC' },
        content: '<p>Build vaults</p>',
        departments: [{ id: 1, name: 'Design' }],
        offices: [{ id: 2, name: 'New York City' }],
      },
      { boardToken: 'vaulttec' },
    );
    expect(job.title).toBe('Vault Designer');
    expect(job.applyUrl).toContain('greenhouse.io');
    expect(job.descriptionText).toContain('Build vaults');
    expect(job.sourceAttribution).toContain('vaulttec');
    expect(contentHashForCanonicalJob(job)).toHaveLength(64);
  });
});

describe('normalizeLeverJob', () => {
  it('maps postings API fields', () => {
    const job = normalizeLeverJob(
      {
        id: 'abc-123',
        text: 'Sales Engineer',
        applyUrl: 'https://jobs.lever.co/leverdemo/abc-123/apply',
        hostedUrl: 'https://jobs.lever.co/leverdemo/abc-123',
        categories: { location: 'Oakland', team: 'Sales', department: 'GTM' },
        descriptionPlain: 'Sell thoughtfully',
        workplaceType: 'hybrid',
        createdAt: 1_600_000_000_000,
      },
      { site: 'leverdemo' },
    );
    expect(job.title).toBe('Sales Engineer');
    expect(job.workMode).toBe('hybrid');
    expect(job.locationText).toBe('Oakland');
    expect(dedupeKey('lever', 'demo', 'abc-123')).toBe('lever:demo:abc-123');
  });
});
