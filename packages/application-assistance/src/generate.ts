import {
  DRAFT_GENERATION_VERSION,
  GeneratedDocumentPayloadSchema,
  type CandidateProfilePayload,
  type CanonicalJob,
  type DocumentType,
  type GeneratedDocumentPayload,
  type GenerationProvenance,
} from '@aijh/contracts';
import {
  buildEvidenceCorpus,
  extractJobRequirementTerms,
  findEvidenceForTerm,
} from './evidence';
import { validateDraftClaims } from './claims';

export const TEMPLATE_PROMPT_VERSION = 'template-draft-v1';

export type GenerateDraftsInput = {
  profile: CandidateProfilePayload;
  job: CanonicalJob;
  profileVersionId: string;
  jobContentHash: string;
  canonicalJobId: string;
  types?: DocumentType[];
  now?: Date;
};

export type GenerateDraftsResult = {
  documents: GeneratedDocumentPayload[];
  provenance: GenerationProvenance;
};

/**
 * Template-based grounded draft generator.
 * Only emits facts present in the approved profile evidence corpus.
 * Never invents employers, degrees, certifications, or skills.
 */
export function generateGroundedDrafts(
  input: GenerateDraftsInput,
): GenerateDraftsResult {
  const now = input.now ?? new Date();
  const types = input.types ?? [
    'tailored_cv',
    'cover_letter',
    'application_answers',
  ];
  const corpus = buildEvidenceCorpus(input.profile);
  const jobText = [input.job.title, input.job.descriptionText]
    .filter(Boolean)
    .join('\n');
  const reqTerms = extractJobRequirementTerms(jobText);

  const matchedSkills = input.profile.skills
    .map((s) => s.name)
    .filter((name) =>
      reqTerms.some(
        (t) =>
          name.toLowerCase().includes(t) || t.includes(name.toLowerCase()),
      ) ||
      jobText.toLowerCase().includes(name.toLowerCase()),
    );

  const documents: GeneratedDocumentPayload[] = [];

  for (const type of types) {
    let contentMarkdown = '';
    let title = '';
    const missingEvidenceNotes: string[] = [];

    if (type === 'tailored_cv') {
      title = `Tailored CV — ${input.job.title}`;
      contentMarkdown = renderTailoredCv(input.profile, matchedSkills);
    } else if (type === 'cover_letter') {
      title = `Cover letter — ${input.job.title}`;
      const { markdown, missing } = renderCoverLetter(
        input.profile,
        input.job,
        matchedSkills,
        corpus,
      );
      contentMarkdown = markdown;
      missingEvidenceNotes.push(...missing);
    } else {
      title = `Application answers — ${input.job.title}`;
      const { markdown, missing } = renderApplicationAnswers(
        input.profile,
        input.job,
        matchedSkills,
        corpus,
      );
      contentMarkdown = markdown;
      missingEvidenceNotes.push(...missing);
    }

    const { claims, unsupportedClaims } = validateDraftClaims(
      contentMarkdown,
      corpus,
    );

    documents.push(
      GeneratedDocumentPayloadSchema.parse({
        schemaVersion: DRAFT_GENERATION_VERSION,
        type,
        title,
        contentMarkdown,
        claims,
        unsupportedClaims,
        missingEvidenceNotes,
      }),
    );
  }

  const provenance: GenerationProvenance = {
    generationVersion: DRAFT_GENERATION_VERSION,
    provider: 'template',
    model: 'template',
    promptVersion: TEMPLATE_PROMPT_VERSION,
    profileVersionId: input.profileVersionId,
    jobContentHash: input.jobContentHash,
    canonicalJobId: input.canonicalJobId,
    generatedAt: now.toISOString(),
  };

  return { documents, provenance };
}

function renderTailoredCv(
  profile: CandidateProfilePayload,
  matchedSkills: string[],
): string {
  const name = profile.identity.fullName ?? 'Candidate';
  const lines: string[] = [
    `# ${name}`,
    profile.identity.email ? `Email: ${profile.identity.email}` : '',
    profile.location.current ? `Location: ${profile.location.current}` : '',
    '',
    '## Summary',
    profile.totalExperienceMonths != null
      ? `Professional with approximately ${profile.totalExperienceMonths} months of validated experience (from approved profile).`
      : 'Experience duration unknown in approved profile.',
    '',
    '## Skills (evidenced)',
  ];

  const skills =
    matchedSkills.length > 0
      ? matchedSkills
      : profile.skills.map((s) => s.name).slice(0, 12);
  for (const s of skills) {
    lines.push(`- ${s}`);
  }
  if (skills.length === 0) {
    lines.push('_No skills recorded in approved profile._');
  }

  lines.push('', '## Experience');
  if (profile.employment.length === 0) {
    lines.push('_No employment intervals in approved profile._');
  } else {
    for (const e of profile.employment) {
      const header = [e.title, e.company].filter(Boolean).join(' — ');
      lines.push(`### ${header || 'Role'}`);
      if (e.description) lines.push(e.description);
      lines.push('');
    }
  }

  if (profile.education.length) {
    lines.push('## Education');
    for (const ed of profile.education) {
      lines.push(
        `- ${[ed.institution, ed.degree, ed.field].filter(Boolean).join(' — ')}`,
      );
    }
  }

  lines.push(
    '',
    '_This draft uses only facts from the approved profile. It was not submitted automatically._',
  );
  return lines.filter((l) => l !== undefined).join('\n');
}

function renderCoverLetter(
  profile: CandidateProfilePayload,
  job: CanonicalJob,
  matchedSkills: string[],
  corpus: ReturnType<typeof buildEvidenceCorpus>,
): { markdown: string; missing: string[] } {
  const missing: string[] = [];
  const name = profile.identity.fullName ?? 'Candidate';
  const company = job.companyName ?? 'the hiring team';
  const skillPhrase =
    matchedSkills.length > 0
      ? matchedSkills.slice(0, 5).join(', ')
      : null;

  if (!skillPhrase) {
    missing.push(
      'No overlapping skills between profile and job description — cover letter omits unverified skill claims.',
    );
  }

  // Only mention companies that exist in evidence
  const companies = profile.employment
    .map((e) => e.company)
    .filter((c): c is string => Boolean(c));
  const companyLine =
    companies.length > 0
      ? `Relevant experience includes work at ${companies.slice(0, 3).join(', ')}, as recorded in the approved profile.`
      : 'Employment company history is limited in the approved profile.';

  const lines = [
    `# Cover letter — ${job.title}`,
    '',
    `Dear ${company},`,
    '',
    `I am applying for the ${job.title} role. My name is ${name}.`,
    skillPhrase
      ? `Based on my approved profile, I have evidenced experience with ${skillPhrase}.`
      : 'I am limiting this letter to facts present in my approved profile; overlapping skill evidence with this posting was not found.',
    companyLine,
    '',
    'I have not claimed qualifications that are absent from my approved profile.',
    '',
    'Sincerely,',
    name,
    '',
    '_Draft only — human review required. Official apply URL must be used by the user; no automatic submission._',
  ];

  // Ensure companies mentioned are evidenced
  for (const c of companies.slice(0, 3)) {
    if (findEvidenceForTerm(corpus, c).length === 0) {
      missing.push(`Company "${c}" missing from corpus unexpectedly.`);
    }
  }

  return { markdown: lines.join('\n'), missing };
}

function renderApplicationAnswers(
  profile: CandidateProfilePayload,
  job: CanonicalJob,
  matchedSkills: string[],
  _corpus: ReturnType<typeof buildEvidenceCorpus>,
): { markdown: string; missing: string[] } {
  const missing: string[] = [];
  const name = profile.identity.fullName ?? null;
  const years =
    profile.totalExperienceMonths != null
      ? `${Math.floor(profile.totalExperienceMonths / 12)}+ years (derived from approved profile months)`
      : null;

  const qas: Array<{ q: string; a: string }> = [
    {
      q: 'Why are you interested in this role?',
      a: matchedSkills.length
        ? `The ${job.title} role aligns with evidenced skills in my approved profile: ${matchedSkills.slice(0, 5).join(', ')}.`
        : `Insufficient overlapping skill evidence to draft a specific interest answer for ${job.title}.`,
    },
    {
      q: 'Describe your relevant experience.',
      a:
        profile.employment.length > 0
          ? profile.employment
              .slice(0, 3)
              .map((e) =>
                [e.title, e.company, e.description?.slice(0, 180)]
                  .filter(Boolean)
                  .join(' — '),
              )
              .join('\n\n')
          : 'No employment evidence available in the approved profile.',
    },
    {
      q: 'How many years of experience do you have?',
      a: years ?? 'Unknown — total experience months not set on approved profile.',
    },
    {
      q: 'Are you authorized to work without sponsorship?',
      a:
        profile.preferences.workAuthorization?.requiresSponsorship === 'no'
          ? 'Profile indicates sponsorship is not required (user-stated preference/fact on profile — verify before submitting).'
          : profile.preferences.workAuthorization?.requiresSponsorship === 'yes'
            ? 'Profile indicates sponsorship is required. Do not invent employer sponsorship availability.'
            : 'Insufficient evidence in approved profile — leave blank or answer manually.',
    },
  ];

  if (!name) missing.push('identity.fullName missing');
  if (!years) missing.push('totalExperienceMonths unknown');
  if (matchedSkills.length === 0) {
    missing.push('No skill overlap with job description');
  }

  const lines = [`# Application answers — ${job.title}`, ''];
  for (const qa of qas) {
    lines.push(`## ${qa.q}`, qa.a, '');
  }
  lines.push(
    '_Answers grounded only in approved profile evidence. Unsupported topics left as insufficient-evidence notes._',
  );
  return { markdown: lines.join('\n'), missing };
}
