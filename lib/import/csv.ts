// Small, strict CSV reader for sensor imports. Pure TypeScript (runs on the server and in tests).
// Supports RFC 4180 basics: comma separator, double-quoted fields with "" escapes, CRLF or LF, a UTF-8 BOM, and a trailing newline.
// It never evaluates anything and never reads more than the caller's limits allow.

export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB of CSV text
export const MAX_PRESSURE_ROWS = 60_000; // data rows (one row per sensor reading)
export const MAX_PRESSURE_FRAMES = 20_000; // distinct timestamps
export const MAX_BALANCE_ROWS = 30_000; // one row per time sample
export const MAX_ERRORS_SHOWN = 12;

/** A problem with a specific place in the file. line is 1-based and counts the header as line 1. */
export type CsvIssue = { line: number | null; column: string | null; message: string };

export type CsvTable = { header: string[]; rows: { line: number; cells: string[] }[] };

export type CsvRead = { ok: true; table: CsvTable } | { ok: false; issues: CsvIssue[] };

export const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Splits text into records. Returns an issue instead of guessing when a quote is never closed. */
export function readCsv(text: string, maxRows: number): CsvRead {
  if (byteLength(text) > MAX_FILE_BYTES) {
    return { ok: false, issues: [{ line: null, column: null, message: `The file is larger than ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB. Split the recording or remove unneeded rows.` }] };
  }
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  let line = 1;
  let recLine = 1;
  let sawAny = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else { if (ch === "\n") line++; cur += ch; }
      continue;
    }
    if (ch === '"' && cur === "") { inQuotes = true; sawAny = true; continue; }
    if (ch === ",") { cells.push(cur); cur = ""; sawAny = true; continue; }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (sawAny || cur !== "") { cells.push(cur); records.push({ line: recLine, cells }); }
      cells = []; cur = ""; sawAny = false; line++; recLine = line;
      if (records.length > maxRows + 1) break;
      continue;
    }
    cur += ch; sawAny = true;
  }
  if (inQuotes) return { ok: false, issues: [{ line: recLine, column: null, message: "A quoted value is never closed (missing closing quote)." }] };
  if (sawAny || cur !== "") { cells.push(cur); records.push({ line: recLine, cells }); }
  if (records.length === 0) return { ok: false, issues: [{ line: 1, column: null, message: "The file is empty. The first line must be the column header." }] };
  if (records.length - 1 > maxRows) {
    return { ok: false, issues: [{ line: null, column: null, message: `The file has more than ${maxRows.toLocaleString("en-US")} data rows, which is the limit for this import.` }] };
  }
  const header = records[0].cells.map((c) => c.trim());
  const rows = records.slice(1).filter((r) => !(r.cells.length === 1 && r.cells[0].trim() === ""));
  if (rows.length === 0) return { ok: false, issues: [{ line: 2, column: null, message: "The file has a header but no data rows." }] };
  return { ok: true, table: { header, rows } };
}

/**
 * Checks the header against the template, with helpful hints for common unit mix-ups.
 * `hints` maps a wrong column name (lower case) to the explanation shown to the user.
 */
export function checkHeader(header: string[], expected: readonly string[], hints: Record<string, string> = {}): CsvIssue[] {
  const issues: CsvIssue[] = [];
  const lower = header.map((h) => h.toLowerCase());
  header.forEach((h, i) => {
    if (h !== "" && lower.indexOf(h.toLowerCase()) !== i) issues.push({ line: 1, column: h, message: `Column "${h}" appears more than once.` });
  });
  header.forEach((h) => {
    if (!expected.includes(h.toLowerCase())) {
      issues.push({ line: 1, column: h, message: hints[h.toLowerCase()] ?? `Unexpected column "${h}". Expected exactly: ${expected.join(", ")}.` });
    } else if (h !== h.toLowerCase()) issues.push({ line: 1, column: h, message: `Column "${h}" must be written in lower case as "${h.toLowerCase()}".` });
  });
  for (const e of expected) {
    if (!lower.includes(e)) issues.push({ line: 1, column: e, message: `Missing required column "${e}".` });
  }
  return issues;
}

/** Index of each expected column in the header (case-insensitive). Only call after checkHeader found no issues. */
export const columnIndex = (header: string[], expected: readonly string[]) =>
  Object.fromEntries(expected.map((e) => [e, header.findIndex((h) => h.toLowerCase() === e)])) as Record<string, number>;

/** A cell is "blank" when it is empty or whitespace only. Blank means missing, never zero. */
export const isBlank = (s: string | undefined) => s === undefined || s.trim() === "";

/** Strict decimal parser: optional sign, digits, optional fraction, optional exponent. Rejects "", "1,5", "12 kPa", "NaN", "Infinity", "0x10". */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Collects issues and stops adding detail after a cap, keeping a count so the message can say "and N more". */
export class IssueList {
  items: CsvIssue[] = [];
  total = 0;
  constructor(private cap = MAX_ERRORS_SHOWN) {}
  add(line: number | null, column: string | null, message: string) {
    this.total++;
    if (this.items.length < this.cap) this.items.push({ line, column, message });
  }
  get hidden() { return Math.max(0, this.total - this.items.length); }
  get any() { return this.total > 0; }
}
