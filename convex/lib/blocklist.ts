/**
 * Lowercases, strips diacritics ("cabrão" → "cabrao") and collapses whitespace,
 * so a single block-list entry covers accented / unaccented / mixed-case spellings.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function containsAtWordStart(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return false;
    if (idx === 0 || !LETTER_OR_DIGIT.test(haystack[idx - 1])) return true;
    from = idx + 1;
  }
}

/**
 * Accent- and case-insensitive match against any term — plain text matching, no NLU.
 * A term must start at a word boundary, so "puta" matches "putas" but not
 * "computador" or "reputação". Suffixes are still matched (plurals, conjugations).
 */
export function matchesAnyTerm(content: string, terms: string[]): boolean {
  const text = normalizeText(content);
  return terms.some((term) => {
    const t = normalizeText(term);
    return t.length > 0 && containsAtWordStart(text, t);
  });
}
