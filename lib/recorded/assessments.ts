import type { AstronautRecord, Session } from "../demo/types";
import type { BalanceAssessmentView, PressureAssessmentView } from "./types";

// Calculations and selectors for recorded pressure and balance assessments. Nothing here rounds: screens round when they display.

export type LoadShares =
  | { kind: "value"; leftPct: number; rightPct: number; /** Absolute difference in percentage points. */ diffPp: number; heavier: "left" | "right" | "equal" }
  | { kind: "unavailable"; reason: "missing-force" | "no-load" };

/**
 * Load share = foot force / combined force x 100, only when BOTH forces were measured in the same assessment and their sum is
 * positive. A measured zero is a real zero (0% for that foot); a blank is "not measured" and gives no shares at all.
 */
export function loadShares(leftN: number | null, rightN: number | null): LoadShares {
  if (leftN === null || rightN === null || !Number.isFinite(leftN) || !Number.isFinite(rightN) || leftN < 0 || rightN < 0) return { kind: "unavailable", reason: "missing-force" };
  const total = leftN + rightN;
  if (!(total > 0)) return { kind: "unavailable", reason: "no-load" };
  const leftPct = (leftN / total) * 100;
  const rightPct = (rightN / total) * 100;
  const diffPp = Math.abs(leftPct - rightPct);
  return { kind: "value", leftPct, rightPct, diffPp, heavier: leftN === rightN ? "equal" : leftN > rightN ? "left" : "right" };
}

export const SHARE_REASON: Record<"missing-force" | "no-load", string> = {
  "missing-force": "Load shares need both the left and the right force from the same assessment.",
  "no-load": "Both forces are zero, so there is no load to share.",
};

/** Resultant RMS = sqrt(ML^2 + AP^2), only when both instrument-reported components were entered. */
export function resultantRmsMm(mlMm: number | null, apMm: number | null): number | null {
  if (mlMm === null || apMm === null || !Number.isFinite(mlMm) || !Number.isFinite(apMm) || mlMm < 0 || apMm < 0) return null;
  return Math.sqrt(mlMm * mlMm + apMm * apMm);
}

/** The one assessment an overview shows for the selected knee session: same mission day if any, else the latest. An explicit pick wins. */
export function pickByContext<T extends { id: string; missionDay: number }>(all: readonly T[], session: Session | null, pickedId: string | null = null): T | null {
  if (!all.length) return null;
  const picked = pickedId ? all.find((x) => x.id === pickedId) : undefined;
  if (picked) return picked;
  if (session && !session.recorded?.empty) {
    const sameDay = [...all].reverse().find((x) => x.missionDay === session.missionDay);
    if (sameDay) return sameDay;
  }
  return all[all.length - 1];
}

export const pressureFor = (a: AstronautRecord, s: Session | null, id: string | null = null) => pickByContext(a.pressure ?? [], s, id);
export const balanceFor = (a: AstronautRecord, s: Session | null, id: string | null = null) => pickByContext(a.balance ?? [], s, id);

/** Balance assessments that can be compared with `ref`: same trial side and same protocol, oldest first. */
export function comparableBalance(a: AstronautRecord, ref: Pick<BalanceAssessmentView, "trialSide" | "protocol">): BalanceAssessmentView[] {
  return (a.balance ?? []).filter((b) => b.trialSide === ref.trialSide && b.protocol === ref.protocol);
}

// ---------------------------------------------------------------- reports
export type ObsMean = { kind: "value"; mean: number; n: number } | { kind: "unavailable" };
const meanOf = (v: (number | null)[]): ObsMean => {
  const x = v.filter((n): n is number => n !== null && Number.isFinite(n));
  return x.length ? { kind: "value", mean: x.reduce((s, n) => s + n, 0) / x.length, n: x.length } : { kind: "unavailable" };
};

// ---------------------------------------------------------------- manual values vs imported CSV values
// RULE (shown in the UI): a value that was typed in by hand is never replaced. A reading that was NOT entered by hand is filled from the
// assessment's imported sensor CSV, if it has one, and is always labelled "Imported CSV". Both values stay visible on the detail pages.
export type Origin = "manual" | "csv";
export const ORIGIN_LABEL: Record<Origin, string> = { manual: "Manual entry", csv: "Imported CSV" };
export const SUMMARY_RULE = "Manually entered values are used when present; otherwise the value calculated from the imported sensor CSV is used and labelled.";

/** Load shares for summaries: both manual forces when entered, else the CSV session mean (frames where both feet are complete). */
export function effectiveShares(x: PressureAssessmentView): { shares: LoadShares; origin: Origin | null } {
  if (x.shares.kind === "value") return { shares: x.shares, origin: "manual" };
  const s = x.csvImport?.summary;
  if (s?.kind === "pressure" && s.session.meanShares.kind === "value") {
    const { leftPct, rightPct } = s.session.meanShares.value;
    return { shares: { kind: "value", leftPct, rightPct, diffPp: Math.abs(leftPct - rightPct), heavier: leftPct === rightPct ? "equal" : leftPct > rightPct ? "left" : "right" }, origin: "csv" };
  }
  return { shares: x.shares, origin: null };
}

/** Peak pressure (kPa) of one foot: the typed value when entered, else the highest value in the imported CSV. */
export function effectivePeak(x: PressureAssessmentView, side: "left" | "right"): { value: number | null; origin: Origin | null } {
  const manual = side === "left" ? x.leftPeakKpa : x.rightPeakKpa;
  if (manual !== null) return { value: manual, origin: "manual" };
  const s = x.csvImport?.summary;
  if (s?.kind === "pressure") { const m = s.session.peakKpa[side]; if (m.kind === "value") return { value: m.value, origin: "csv" }; }
  return { value: null, origin: null };
}

/** ML / AP sway RMS (mm): the typed instrument value when entered, else the mean-centred RMS of the imported samples. */
export function effectiveSway(x: BalanceAssessmentView, axis: "ml" | "ap"): { value: number | null; origin: Origin | null } {
  const manual = axis === "ml" ? x.mlRmsMm : x.apRmsMm;
  if (manual !== null) return { value: manual, origin: "manual" };
  const s = x.csvImport?.summary;
  if (s?.kind === "balance") { const m = axis === "ml" ? s.trial.rmsMlMm : s.trial.rmsApMm; if (m.kind === "value") return { value: m.value, origin: "csv" }; }
  return { value: null, origin: null };
}

export type AssessmentRow = { key: string; label: string; unit: string; digits: number; value: ObsMean; points: { id: string; day: number; value: number; origin: Origin }[]; note: string };

/**
 * Report rows for recorded pressure and balance in a mission-day range. Pressure rows use the assessments of the reference
 * protocol (the latest one in range); balance rows use only assessments with the reference trial side and protocol. Readings that
 * were not measured are left out of the means (never counted as zero), and every row states its observation count.
 */
export function assessmentRows(a: AstronautRecord, range: { start: number; end: number }): AssessmentRow[] {
  const inR = <T extends { missionDay: number }>(l: readonly T[]) => l.filter((x) => x.missionDay >= range.start && x.missionDay <= range.end);
  const pr = inR(a.pressure ?? []);
  const prRef = pr[pr.length - 1];
  const prComp = prRef ? pr.filter((x) => x.protocol === prRef.protocol) : [];
  const bl = inR(a.balance ?? []);
  const blRef = bl[bl.length - 1];
  const blComp = blRef ? bl.filter((x) => x.trialSide === blRef.trialSide && x.protocol === blRef.protocol) : [];
  const row = <T extends { id: string; missionDay: number }>(key: string, label: string, unit: string, digits: number, l: T[], f: (x: T) => { value: number | null; origin: Origin | null }, note: string): AssessmentRow =>
    ({ key, label, unit, digits, value: meanOf(l.map((x) => f(x).value)), points: l.flatMap((x) => { const r = f(x); return r.value === null || r.origin === null ? [] : [{ id: x.id, day: x.missionDay, value: r.value, origin: r.origin }]; }), note });
  const pNote = prRef ? `${prRef.protocol} assessments only (${prComp.length} in range)` : "No pressure assessment in range";
  const bNote = blRef ? `${blRef.trialSide}-leg, ${blRef.protocol} only (${blComp.length} in range)` : "No balance assessment in range";
  return [
    row("leftShare", "Left load share", "%", 1, prComp, (x) => { const e = effectiveShares(x); return { value: e.shares.kind === "value" ? e.shares.leftPct : null, origin: e.origin }; }, pNote),
    row("rightShare", "Right load share", "%", 1, prComp, (x) => { const e = effectiveShares(x); return { value: e.shares.kind === "value" ? e.shares.rightPct : null, origin: e.origin }; }, pNote),
    row("leftPeak", "Left peak pressure", " kPa", 1, prComp, (x) => effectivePeak(x, "left"), pNote),
    row("rightPeak", "Right peak pressure", " kPa", 1, prComp, (x) => effectivePeak(x, "right"), pNote),
    row("ml", "ML sway RMS", " mm", 1, blComp, (x) => effectiveSway(x, "ml"), bNote),
    row("ap", "AP sway RMS", " mm", 1, blComp, (x) => effectiveSway(x, "ap"), bNote),
  ];
}

// ---------------------------------------------------------------- one line per assessment, for the report document (PDF)
export type ReportValue = { label: string; text: string; origin: Origin | null };
export type ReportAssessment = { kind: "pressure" | "balance"; id: string; day: number; label: string; startedAt: string; csvFile: string | null; values: ReportValue[] };

const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** The pressure and balance assessments in a mission-day range, each with its values and where they came from. Same selectors as the detail pages. */
export function reportAssessments(a: AstronautRecord, range: { start: number; end: number }): { pressure: ReportAssessment[]; balance: ReportAssessment[] } {
  const inR = <T extends { missionDay: number }>(l: readonly T[] | undefined) => (l ?? []).filter((x) => x.missionDay >= range.start && x.missionDay <= range.end);
  const num = (n: number | null, unit: string): ReportValue["text"] | null => (n === null ? null : `${f1(n)} ${unit}`);
  const val = (label: string, n: number | null, unit: string, origin: Origin | null): ReportValue => ({ label, text: num(n, unit) ?? "not available", origin: n === null ? null : origin });
  const pressure = inR(a.pressure).map((x): ReportAssessment => {
    const sh = effectiveShares(x);
    const pl = effectivePeak(x, "left"), pr = effectivePeak(x, "right");
    const shareText = (n: number | undefined) => (sh.shares.kind === "value" && n !== undefined ? `${f1(n)} %` : "not available");
    return {
      kind: "pressure", id: x.id, day: x.missionDay, label: x.label, startedAt: x.startedAt, csvFile: x.csvImport?.fileName ?? null,
      values: [
        { label: "Left load share", text: shareText(sh.shares.kind === "value" ? sh.shares.leftPct : undefined), origin: sh.shares.kind === "value" ? sh.origin : null },
        { label: "Right load share", text: shareText(sh.shares.kind === "value" ? sh.shares.rightPct : undefined), origin: sh.shares.kind === "value" ? sh.origin : null },
        { label: "Difference", text: sh.shares.kind === "value" ? `${f1(sh.shares.diffPp)} percentage points` : "not available", origin: sh.shares.kind === "value" ? sh.origin : null },
        val("Left force", x.leftForceN, "N", "manual"), val("Right force", x.rightForceN, "N", "manual"),
        val("Left peak pressure", pl.value, "kPa", pl.origin), val("Right peak pressure", pr.value, "kPa", pr.origin),
      ],
    };
  });
  const balance = inR(a.balance).map((x): ReportAssessment => {
    const ml = effectiveSway(x, "ml"), ap = effectiveSway(x, "ap");
    const t = x.csvImport?.summary.kind === "balance" ? x.csvImport.summary.trial : null;
    const prev = x.csvImport?.preview.kind === "balance" ? x.csvImport.preview : null;
    const path = t && t.pathLengthMm.kind === "value" ? t.pathLengthMm.value : null;
    return {
      kind: "balance", id: x.id, day: x.missionDay, label: x.label, startedAt: x.startedAt, csvFile: x.csvImport?.fileName ?? null,
      values: [
        val("ML sway RMS", ml.value, "mm", ml.origin), val("AP sway RMS", ap.value, "mm", ap.origin),
        ...(path !== null ? [val("Path length", path, "mm", "csv")] : []),
        { label: "Duration (entered by hand)", text: `${f1(x.durationS)} s`, origin: "manual" },
        ...(prev ? [{ label: "Duration observed in CSV", text: `${f1(prev.observedDurationS)} s`, origin: "csv" as Origin }] : []),
        ...(prev ? [{ label: "CSV coverage", text: `${(prev.coverage * 100).toFixed(0)} %`, origin: "csv" as Origin }] : []),
      ],
    };
  });
  return { pressure, balance };
}
