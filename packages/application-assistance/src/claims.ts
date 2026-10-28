import type { DocumentClaim } from '@aijh/contracts';
import type { EvidenceItem } from './evidence';
import { findEvidenceForTerm } from './evidence';

/**
 * Heuristic claim extraction: look for capitalized skill-like tokens and
 * "I/we [verb] X" patterns, then require evidence support.
 */
export function validateDraftClaims(
  contentMarkdown: string,
  corpus: EvidenceItem[],
): { claims: DocumentClaim[]; unsupportedClaims: string[] } {
  const claims: DocumentClaim[] = [];
  const unsupportedClaims: string[] = [];
  const seen = new Set<string>();

  // Explicit "skill:" / bullet skill lines
  const skillMentions = contentMarkdown.match(
    /(?:^|\n)[-*]\s+([A-Za-z][A-Za-z0-9+.#/\s-]{1,48})(?=\n|$)/g,
  );
  const candidates = new Set<string>();
  if (skillMentions) {
    for (const m of skillMentions) {
      const cleaned = m.replace(/^[-*\s\n]+/, '').trim();
      if (cleaned.length > 1) candidates.add(cleaned);
    }
  }

  // Phrases that look like invented credentials
  const inventPatterns = [
    /certified\s+([A-Za-z0-9+.#\s-]{2,40})/gi,
    /(?:fluent|expert|proficient)\s+in\s+([A-Za-z0-9+.#\s-]{2,40})/gi,
    /worked\s+at\s+([A-Za-z0-9&.,\s-]{2,60})/gi,
    /(?:degree|graduated)\s+(?:in|from)\s+([A-Za-z0-9&.,\s-]{2,60})/gi,
  ];
  for (const re of inventPatterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(contentMarkdown)) !== null) {
      const term = match[1]?.trim();
      if (term) candidates.add(term);
    }
  }

  // Also validate skill-like multi-word tokens that appear as **bold** claims
  const bold = contentMarkdown.match(/\*\*([^*]{2,60})\*\*/g) ?? [];
  for (const b of bold) {
    candidates.add(b.replace(/\*/g, '').trim());
  }

  let i = 0;
  for (const term of candidates) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Skip structural headings
    if (/^(experience|skills|education|summary|cover|application)/i.test(term)) {
      continue;
    }
    const evidence = findEvidenceForTerm(corpus, term);
    const supported = evidence.length > 0;
    const claim: DocumentClaim = {
      id: `claim-${i++}`,
      text: term,
      supported,
      evidencePaths: evidence.map((e) => e.path),
      evidenceQuotes: evidence.map((e) => e.quote).slice(0, 3),
      reason: supported
        ? 'Matched approved profile evidence.'
        : 'No supporting evidence in approved profile — do not treat as a verified fact.',
    };
    claims.push(claim);
    if (!supported) unsupportedClaims.push(term);
  }

  return { claims, unsupportedClaims };
}

/** Reject drafts that introduce unsupported claims before approval. */
export function assertNoUnsupportedClaims(
  unsupportedClaims: string[],
): void {
  if (unsupportedClaims.length > 0) {
    throw new Error(
      `Draft contains unsupported claims: ${unsupportedClaims.slice(0, 8).join('; ')}`,
    );
  }
}
