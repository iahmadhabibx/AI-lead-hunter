import type { CandidateProfilePayload } from '@aijh/contracts';

export type EvidenceItem = {
  path: string;
  quote: string;
  tokens: string[];
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Build a flat evidence corpus from an approved profile — no invented facts. */
export function buildEvidenceCorpus(
  profile: CandidateProfilePayload,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  if (profile.identity.fullName) {
    items.push({
      path: 'identity.fullName',
      quote: profile.identity.fullName,
      tokens: tokenize(profile.identity.fullName),
    });
  }
  if (profile.identity.email) {
    items.push({
      path: 'identity.email',
      quote: profile.identity.email,
      tokens: tokenize(profile.identity.email),
    });
  }
  if (profile.location.current) {
    items.push({
      path: 'location.current',
      quote: profile.location.current,
      tokens: tokenize(profile.location.current),
    });
  }

  profile.skills.forEach((s, i) => {
    items.push({
      path: `skills[${i}].name`,
      quote: s.name,
      tokens: tokenize(s.name),
    });
  });

  profile.employment.forEach((e, i) => {
    if (e.title) {
      items.push({
        path: `employment[${i}].title`,
        quote: e.title,
        tokens: tokenize(e.title),
      });
    }
    if (e.company) {
      items.push({
        path: `employment[${i}].company`,
        quote: e.company,
        tokens: tokenize(e.company),
      });
    }
    if (e.description) {
      items.push({
        path: `employment[${i}].description`,
        quote: e.description.slice(0, 500),
        tokens: tokenize(e.description),
      });
    }
  });

  profile.education.forEach((ed, i) => {
    const parts = [ed.institution, ed.degree, ed.field].filter(Boolean);
    if (parts.length) {
      items.push({
        path: `education[${i}]`,
        quote: parts.join(' — '),
        tokens: tokenize(parts.join(' ')),
      });
    }
  });

  profile.projects.forEach((p, i) => {
    const parts = [p.name, p.description].filter(Boolean);
    if (parts.length) {
      items.push({
        path: `projects[${i}]`,
        quote: parts.join(': ').slice(0, 500),
        tokens: tokenize(parts.join(' ')),
      });
    }
  });

  profile.certifications.forEach((c, i) => {
    if (c.name) {
      items.push({
        path: `certifications[${i}].name`,
        quote: c.name,
        tokens: tokenize(c.name),
      });
    }
  });

  return items;
}

export function findEvidenceForTerm(
  corpus: EvidenceItem[],
  term: string,
): EvidenceItem[] {
  const needle = term.toLowerCase().trim();
  if (!needle) return [];
  return corpus.filter(
    (e) =>
      e.quote.toLowerCase().includes(needle) ||
      e.tokens.some((t) => t === needle || needle.includes(t)),
  );
}

export function extractJobRequirementTerms(jobText: string): string[] {
  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'you',
    'our',
    'will',
    'have',
    'this',
    'that',
    'from',
    'are',
    'job',
    'role',
    'team',
    'work',
    'years',
    'experience',
    'ability',
    'strong',
    'using',
  ]);
  const counts = new Map<string, number>();
  for (const t of tokenize(jobText)) {
    if (stop.has(t) || t.length < 3) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1]! - a[1]!)
    .slice(0, 40)
    .map(([t]) => t);
}
