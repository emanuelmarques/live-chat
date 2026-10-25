/** Case-insensitive substring match against any term — plain text matching, no NLU. */
export function matchesAnyTerm(content: string, terms: string[]): boolean {
  const lower = content.toLowerCase();
  return terms.some((term) => {
    const t = term.trim().toLowerCase();
    return t.length > 0 && lower.includes(t);
  });
}
