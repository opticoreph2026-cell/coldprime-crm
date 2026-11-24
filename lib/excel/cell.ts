// exceljs cell helpers shared by the importers. exceljs returns rich objects for
// formulas, rich text, hyperlinks and errors; callers want the plain value.

/** "A" -> 1, "AB" -> 28 (exceljs columns are 1-based). */
export function columnIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) continue;
    n = n * 26 + (code - 64);
  }
  return n;
}

/** Normalize an exceljs `cell.value` to a primitive (or Date). */
export function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((part) => part?.text ?? "").join("");
    }
    if ("error" in v) return undefined;
    if ("formula" in v || "sharedFormula" in v) return cellValue(v.result);
    if ("hyperlink" in v) return cellValue(v.text ?? v.hyperlink);
  }
  return value;
}
