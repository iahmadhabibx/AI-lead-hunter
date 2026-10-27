import {
  CANDIDATE_PROFILE_SCHEMA_VERSION,
  CandidateProfilePayloadSchema,
  calculateExperienceMonths,
  emptyCandidateProfile,
  type CandidateProfilePayload,
} from '@aijh/contracts';
import type {
  AiHealth,
  AiRuntime,
  ExtractionRequest,
  ExtractionResult,
} from './types';

export const MOCK_PROMPT_VERSION = 'mock-extract-v1';

/**
 * Deterministic extractor for tests and local development without a model.
 * Uses simple heuristics only — never fabricates employers/dates not present as text cues.
 */
export class MockAiAdapter implements AiRuntime {
  readonly provider = 'mock' as const;

  async healthCheck(): Promise<AiHealth> {
    return { ok: true, provider: 'mock', detail: 'deterministic mock' };
  }

  async extractCandidateProfile(
    req: ExtractionRequest,
  ): Promise<ExtractionResult> {
    const text = req.text ?? '';
    const payload = buildFromText(text);
    const validated = CandidateProfilePayloadSchema.parse(payload);
    return {
      payload: validated,
      provider: 'mock',
      model: 'mock',
      promptVersion: MOCK_PROMPT_VERSION,
    };
  }
}

function buildFromText(text: string): CandidateProfilePayload {
  const base = emptyCandidateProfile();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const nameLine = lines.find(
    (l) =>
      !l.includes('@') &&
      l.length > 2 &&
      l.length < 80 &&
      !/^(curriculum|resume|cv)\b/i.test(l),
  );

  const skillsSection = extractSection(text, /skills?/i);
  const skills = skillsSection
    ? skillsSection
        .split(/[,;\n|/]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 48)
        .slice(0, 40)
        .map((name) => ({ name, evidenceIds: [] as string[] }))
    : [];

  const employment: CandidateProfilePayload['employment'] = [];
  const expSection = extractSection(text, /experience|employment/i);
  if (expSection) {
    const jobBlocks = expSection.split(/\n{2,}/).slice(0, 8);
    let idx = 0;
    for (const block of jobBlocks) {
      const blockLines = block
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (blockLines.length === 0) continue;
      const header = blockLines[0] ?? '';
      const companyMatch = header.match(/(.+?)\s[-–—@]\s(.+)/);
      employment.push({
        id: `emp-${idx++}`,
        title: companyMatch?.[1]?.trim() ?? header.slice(0, 120),
        company: companyMatch?.[2]?.trim() ?? null,
        start: null,
        end: null,
        isCurrent: /present|current/i.test(block),
        description: blockLines.slice(1).join(' ').slice(0, 2000) || null,
        missing: { start: true, end: !/present|current/i.test(block) },
      });
    }
  }

  const missingFields: string[] = [];
  if (!nameLine) missingFields.push('identity.fullName');
  if (!emailMatch) missingFields.push('identity.email');
  if (employment.length === 0) missingFields.push('employment');
  if (skills.length === 0) missingFields.push('skills');

  const payload: CandidateProfilePayload = {
    ...base,
    schemaVersion: CANDIDATE_PROFILE_SCHEMA_VERSION,
    identity: {
      fullName: nameLine ?? null,
      email: emailMatch?.[0]?.toLowerCase() ?? null,
      phone: null,
      links: [],
    },
    employment,
    skills,
    totalExperienceMonths: calculateExperienceMonths(employment),
    evidence: nameLine
      ? [
          {
            fieldPath: 'identity.fullName',
            quote: nameLine.slice(0, 200),
            confidence: 'medium',
            source: 'cv_text',
          },
        ]
      : [],
    missingFields,
    uncertainFields: employment.length
      ? employment.flatMap((e) =>
          e.missing?.start ? [`employment.${e.id}.start`] : [],
        )
      : [],
  };

  return payload;
}

function extractSection(text: string, heading: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l.trim()));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) =>
    /^(education|projects?|certifications?|languages?|summary|experience|employment|skills?)\b/i.test(
      l.trim(),
    ),
  );
  const body = (end >= 0 ? rest.slice(0, end) : rest).join('\n').trim();
  return body || null;
}
