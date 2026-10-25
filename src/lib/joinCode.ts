/** Shows the code in groups of 3 ("J23 9JK") — the same way the projector does. */
export function groupCode(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/(.{3})(?=.)/g, "$1 ");
}
