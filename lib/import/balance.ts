import type { BalanceSample } from "../balance/types";
import { IssueList, MAX_BALANCE_ROWS, checkHeader, columnIndex, isBlank, parseNumber, readCsv } from "./csv";
import type { BalancePreview, BalanceRow, ParseFailure } from "./types";

// AeroRehab balance CSV, one row per time sample of ONE trial:
//   time_ms,ml_mm,ap_mm
// time_ms  elapsed milliseconds inside the trial (>= 0). Must be unique and strictly increasing.
// ml_mm    centre-of-pressure position, medio-lateral axis, millimetres. +ML = toward the astronaut's right.
// ap_mm    centre-of-pressure position, antero-posterior axis, millimetres. +AP = anterior (toward the toes).
// Both coordinates are in the ONE trial frame used by Stability & Balance (origin = centre of the plate area under the
// stance foot). The standing leg and protocol are NOT in the file: they come from the saved balance trial it is attached to.
// A row with BOTH coordinates blank is a missing sample. A row with only one coordinate is rejected (the pair must be complete).
// Timestamps that skip more than 1.5 sampling intervals are a gap: the replay and the path length never bridge it.

export const BALANCE_COLUMNS = ["time_ms", "ml_mm", "ap_mm"] as const;
export const BALANCE_TEMPLATE_NAME = "AeroRehab balance CSV v1";
export const BALANCE_TEMPLATE_CSV = [BALANCE_COLUMNS.join(","), "0,0,0", "100,3,0", "200,3,4", "300,,", "400,0,4", "500,0,0", ""].join("\n");

const HINTS: Record<string, string> = {
  time_s: 'Time must be in milliseconds: rename "time_s" to "time_ms" and multiply the values by 1000.',
  time: 'Use the column name "time_ms" and give elapsed time in milliseconds.',
  ml_cm: 'Positions must be in millimetres: use "ml_mm" and multiply cm by 10.',
  ap_cm: 'Positions must be in millimetres: use "ap_mm" and multiply cm by 10.',
  ml_m: 'Positions must be in millimetres: use "ml_mm".',
  ap_m: 'Positions must be in millimetres: use "ap_mm".',
  x_mm: 'Use "ml_mm" for the medio-lateral coordinate.',
  y_mm: 'Use "ap_mm" for the antero-posterior coordinate.',
};

const MAX_TIME_MS = 3_600_000; // one hour, same as the manual duration limit
const MAX_ABS_MM = 500; // same as the manual sway RMS limit
export const GAP_FACTOR = 1.5; // matches lib/balance/compute.ts

export type ParsedBalance = { ok: true; rows: BalanceRow[]; preview: BalancePreview };

const median = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function parseBalanceCsv(text: string): ParsedBalance | ParseFailure {
  const read = readCsv(text, MAX_BALANCE_ROWS);
  if (!read.ok) return { ok: false, issues: read.issues, hidden: 0 };
  const { header, rows: table } = read.table;
  const head = checkHeader(header, BALANCE_COLUMNS, HINTS);
  if (head.length) return { ok: false, issues: head.slice(0, 12), hidden: Math.max(0, head.length - 12) };
  const col = columnIndex(header, BALANCE_COLUMNS);
  const issues = new IssueList();
  const rows: BalanceRow[] = [];
  let last = -Infinity;
  for (const r of table) {
    const c = r.cells;
    if (c.length !== BALANCE_COLUMNS.length) { issues.add(r.line, null, `Expected ${BALANCE_COLUMNS.length} values but found ${c.length}.`); continue; }
    const tRaw = c[col.time_ms];
    const t = isBlank(tRaw) ? null : parseNumber(tRaw);
    if (t === null) { issues.add(r.line, "time_ms", `time_ms "${tRaw.trim()}" is not a number (milliseconds, e.g. 1500).`); continue; }
    if (t < 0) { issues.add(r.line, "time_ms", "time_ms cannot be negative."); continue; }
    if (t > MAX_TIME_MS) { issues.add(r.line, "time_ms", `time_ms is above ${MAX_TIME_MS.toLocaleString("en-US")} (one hour). Is the time in microseconds?`); continue; }
    if (t === last) { issues.add(r.line, "time_ms", `Duplicate timestamp ${t}. Each time_ms must appear once.`); continue; }
    if (t < last) { issues.add(r.line, "time_ms", `time_ms goes backwards (${t} after ${last}). Timestamps must increase.`); continue; }

    const mRaw = c[col.ml_mm], aRaw = c[col.ap_mm];
    const mBlank = isBlank(mRaw), aBlank = isBlank(aRaw);
    let ml: number | null = null, ap: number | null = null;
    let bad = false;
    if (mBlank !== aBlank) { issues.add(r.line, mBlank ? "ml_mm" : "ap_mm", "ml_mm and ap_mm must both have a value, or both be blank (missing sample)."); bad = true; }
    if (!mBlank) {
      ml = parseNumber(mRaw);
      if (ml === null) { issues.add(r.line, "ml_mm", `ml_mm "${mRaw.trim()}" is not a number (millimetres).`); bad = true; }
      else if (Math.abs(ml) > MAX_ABS_MM) { issues.add(r.line, "ml_mm", `ml_mm must be within ±${MAX_ABS_MM} mm. Check the unit (millimetres).`); bad = true; }
    }
    if (!aBlank) {
      ap = parseNumber(aRaw);
      if (ap === null) { issues.add(r.line, "ap_mm", `ap_mm "${aRaw.trim()}" is not a number (millimetres).`); bad = true; }
      else if (Math.abs(ap) > MAX_ABS_MM) { issues.add(r.line, "ap_mm", `ap_mm must be within ±${MAX_ABS_MM} mm. Check the unit (millimetres).`); bad = true; }
    }
    if (bad) continue;
    last = t;
    rows.push({ timeMs: t, mlMm: ml, apMm: ap });
  }
  if (!issues.any) {
    if (rows.length < 2) issues.add(null, null, "A balance trial needs at least two samples.");
    else if (!rows.some((r) => r.mlMm !== null)) issues.add(null, "ml_mm", "Every sample is blank, so there is nothing to import.");
  }
  if (issues.any) return { ok: false, issues: issues.items, hidden: issues.hidden };
  return { ok: true, rows, preview: previewBalance(rows) };
}

/** Nominal sampling interval: the median spacing between consecutive rows (ms). */
export const intervalOf = (rows: BalanceRow[]) => median(rows.slice(1).map((r, i) => r.timeMs - rows[i].timeMs));

/**
 * Samples for the existing balance calculations. Every row is a sample (blank pair = missing). When the timestamps skip more than
 * 1.5 intervals, one "missing" placeholder per skipped slot is added, so coverage counts the gap and no path is drawn across it.
 */
export function samplesFromRows(rows: BalanceRow[]): { samples: BalanceSample[]; intervalMs: number; skippedSlots: number } {
  const interval = intervalOf(rows);
  const out: BalanceSample[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (i > 0 && interval > 0) {
      const dt = r.timeMs - rows[i - 1].timeMs;
      if (dt > interval * GAP_FACTOR) {
        const k = Math.round(dt / interval) - 1;
        for (let j = 1; j <= k; j++) { out.push({ timestampMs: rows[i - 1].timeMs + j * interval, mlMm: null, apMm: null, status: "missing" }); skipped++; }
      }
    }
    const ok = r.mlMm !== null && r.apMm !== null;
    out.push({ timestampMs: r.timeMs, mlMm: r.mlMm, apMm: r.apMm, status: ok ? "ok" : "missing" });
  });
  return { samples: out, intervalMs: interval, skippedSlots: skipped };
}

export function previewBalance(rows: BalanceRow[]): BalancePreview {
  const { samples, intervalMs, skippedSlots } = samplesFromRows(rows);
  const valid = samples.filter((s) => s.status === "ok").length;
  const gaps: BalancePreview["gaps"] = [];
  const t0 = rows[0].timeMs;
  let prevValid: number | null = null;
  let broken = false;
  for (const s of samples) {
    if (s.status === "ok") {
      if (prevValid !== null && broken) gaps.push({ fromS: (prevValid - t0) / 1000, toS: (s.timestampMs - t0) / 1000 });
      prevValid = s.timestampMs; broken = false;
    } else broken = true;
  }
  return {
    kind: "balance", rowCount: rows.length, validSamples: valid, missingSamples: samples.length - valid, skippedSlots,
    startMs: t0, endMs: rows[rows.length - 1].timeMs, observedDurationS: (rows[rows.length - 1].timeMs - t0) / 1000,
    intervalMs, coverage: samples.length ? valid / samples.length : 0, gaps,
  };
}
