export function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeToken(value)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export function includesNormalized(haystack: string, needle: string): boolean {
  const h = normalizeToken(haystack);
  const n = normalizeToken(needle);
  if (!n) return false;
  return h.includes(n);
}

/** Detect sponsorship stance from job text without inventing facts. */
export type SponsorshipSignal = 'offered' | 'not_offered' | 'unknown';

export function detectSponsorshipSignal(text: string | null | undefined): SponsorshipSignal {
  if (!text || !text.trim()) return 'unknown';
  const t = text.toLowerCase();

  const negative = [
    'no sponsorship',
    'cannot sponsor',
    'will not sponsor',
    'not able to sponsor',
    'sponsorship not available',
    'must have unrestricted work authorization',
    'no visa sponsorship',
  ];
  if (negative.some((p) => t.includes(p))) return 'not_offered';

  const positive = [
    'visa sponsorship available',
    'will sponsor',
    'sponsorship available',
    'h-1b sponsorship',
    'h1b sponsorship',
    'we sponsor visas',
  ];
  if (positive.some((p) => t.includes(p))) return 'offered';

  return 'unknown';
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map(normalizeToken).filter(Boolean));
  const sb = new Set(b.map(normalizeToken).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}
