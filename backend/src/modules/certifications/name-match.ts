/**
 * Normalises a name string for fuzzy comparison: NFD-decomposed accents
 * are stripped, all non-letter characters become spaces, multiple
 * spaces collapse, casing goes lowercase. Tokens are then sorted so
 * "Dupont Jean" and "Jean Dupont" produce the same canonical form.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return '';
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped.split(/\s+/).sort().join(' ');
}

/** Standard iterative Levenshtein. O(n*m) memory, fine for short names. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Returns a similarity ratio in [0, 1]: 1 means identical (after
 * normalisation), 0 means fully different. The default acceptance
 * threshold is 0.85 (configurable via `OCR_NAME_SIMILARITY_THRESHOLD`).
 */
export function nameSimilarity(
  candidate: string | null | undefined,
  reference: string | null | undefined,
): number {
  const a = normalizeName(candidate);
  const b = normalizeName(reference);
  if (!a && !b) return 0;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/** Compares two plate strings ignoring case and whitespace/dash. */
export function plateMatches(
  candidate: string | null | undefined,
  reference: string | null | undefined,
): boolean {
  if (!candidate || !reference) return false;
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return norm(candidate) === norm(reference);
}
