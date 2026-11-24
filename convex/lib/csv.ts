/**
 * Spreadsheet apps execute cells that start with = + - @ (or tab / CR) as
 * formulas. Chat content is attacker-controlled, so prefix such cells with a
 * single quote — the standard CSV-injection mitigation.
 */
function neutralizeFormula(field: string): string {
  return /^[=+\-@\t\r]/.test(field) ? `'${field}` : field;
}

function escapeCsvField(raw: string): string {
  const field = neutralizeFormula(raw);
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}
