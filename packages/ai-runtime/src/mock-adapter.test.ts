import { describe, expect, it } from 'vitest';
import { MockAiAdapter } from './mock-adapter';

describe('MockAiAdapter', () => {
  it('extracts email and skills deterministically', async () => {
    const ai = new MockAiAdapter();
    const result = await ai.extractCandidateProfile({
      text: [
        'Ada Lovelace',
        'ada@example.com',
        '',
        'Skills',
        'TypeScript, PostgreSQL, NestJS',
        '',
        'Experience',
        'Software Engineer - Analytical Engines',
        'Built calculating machines',
      ].join('\n'),
    });

    expect(result.provider).toBe('mock');
    expect(result.payload.identity.email).toBe('ada@example.com');
    expect(result.payload.identity.fullName).toBe('Ada Lovelace');
    expect(result.payload.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(['TypeScript', 'PostgreSQL', 'NestJS']),
    );
    expect(result.payload.employment.length).toBeGreaterThan(0);
  });

  it('does not invent an email when absent', async () => {
    const ai = new MockAiAdapter();
    const result = await ai.extractCandidateProfile({
      text: 'Only a name\nJane Doe\n',
    });
    expect(result.payload.identity.email).toBeNull();
    expect(result.payload.missingFields).toContain('identity.email');
  });
});
