// Pure report aggregation (no React). Inputs are per-session points built from the module selectors.
// Date convention: everything is filtered and labelled by mission day (Day 1 = first mission day); ranges are
// inclusive on both ends.

export type Ctx = { side: string; protocol: string };

export type ReportPoint = {
  astronautId: string;
  sessionId: string;
  missionDay: number;
  /** Knee measurement context; knee metrics are only comparable within the same side and protocol. */
  knee: Ctx;
  romDeg: number | null;
  speedMs: number | null;
  cadenceSpm: number | null;
  balanceIndex: number | null;
};

export type MetricKey = "romDeg" | "speedMs" | "cadenceSpm" | "balanceIndex";
export const KNEE_METRICS: MetricKey[] = ["romDeg"];

export type Range = { start: number; end: number };
export type RangeCheck = { ok: true } | { ok: false; message: string };

export function validateRange(r: Range, minDay: number, maxDay: number): RangeCheck {
  if (!Number.isInteger(r.start) || !Number.isInteger(r.end)) return { ok: false, message: "Choose a start and an end date." };
  if (r.start > r.end) return { ok: false, message: "The start date is after the end date." };
  if (r.start < minDay || r.end > maxDay) return { ok: false, message: `The range must be within mission Day ${minDay} to Day ${maxDay}.` };
  return { ok: true };
}

export const rangeLength = (r: Range) => r.end - r.start + 1;

/** The immediately preceding, non-overlapping range with the same number of calendar days. */
export function previousRange(r: Range): Range {
  const len = rangeLength(r);
  return { start: r.start - len, end: r.start - 1 };
}

export function inRange(points: ReportPoint[], astronautId: string, r: Range): ReportPoint[] {
  return points.filter((p) => p.astronautId === astronautId && p.missionDay >= r.start && p.missionDay <= r.end);
}

export type Agg = { kind: "value"; mean: number; n: number } | { kind: "unavailable"; reason: "no-valid-sessions" };

/** Mean of valid (finite, non-null) values. Missing values are skipped, never treated as 0. */
export function meanOf(values: (number | null)[]): Agg {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? { kind: "value", mean: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : { kind: "unavailable", reason: "no-valid-sessions" };
}

export type Row = {
  metric: MetricKey;
  current: Agg;
  previous: Agg;
  /** current.mean - previous.mean, in the metric's unit. */
  change: number | null;
  /** change / previous.mean * 100, only for a valid positive previous mean. */
  changePct: number | null;
  /** Sessions in the current period left out because their knee side/protocol differs from the reference. */
  excludedCurrent: number;
  excludedPrevious: number;
};

/**
 * One summary row. Knee metrics keep only sessions whose knee context equals `ref` (side and protocol), in
 * both periods. Other metrics use every session with a valid value.
 */
export function metricRow(metric: MetricKey, cur: ReportPoint[], prev: ReportPoint[], ref: Ctx | null): Row {
  const knee = KNEE_METRICS.includes(metric);
  const keep = (p: ReportPoint) => !knee || (ref !== null && p.knee.side === ref.side && p.knee.protocol === ref.protocol);
  const c = cur.filter(keep);
  const pv = prev.filter(keep);
  const current = meanOf(c.map((p) => p[metric]));
  const previous = meanOf(pv.map((p) => p[metric]));
  const change = current.kind === "value" && previous.kind === "value" ? current.mean - previous.mean : null;
  const changePct = change !== null && previous.kind === "value" && previous.mean > 0 ? (change / previous.mean) * 100 : null;
  return { metric, current, previous, change, changePct, excludedCurrent: cur.length - c.length, excludedPrevious: prev.length - pv.length };
}

/** Reference knee context = the latest session in the current period (the one a reader sees last). */
export function referenceContext(cur: ReportPoint[]): Ctx | null {
  const last = [...cur].filter((p) => p.knee.side !== "").sort((a, b) => a.missionDay - b.missionDay).pop(); // walking-only points have no knee
  return last ? last.knee : null;
}

export type ObsRow = { day: number; sessionId: string; value: number | null };

/**
 * Chart rows: one per session in the range, in date order. Days without a session produce no row, so they do
 * not break the line; a session whose measurement is missing gives value null, which does break it. Knee metrics
 * keep only sessions with the reference knee side and protocol.
 */
export function observationRows(cur: ReportPoint[], metric: MetricKey, ref: Ctx | null): ObsRow[] {
  const knee = KNEE_METRICS.includes(metric);
  return cur
    .filter((p) => !knee || (ref !== null && p.knee.side === ref.side && p.knee.protocol === ref.protocol))
    .sort((a, b) => a.missionDay - b.missionDay)
    .map((p) => ({ day: p.missionDay, sessionId: p.sessionId, value: p[metric] !== null && Number.isFinite(p[metric]) ? p[metric] : null }));
}

/** Y domain around the observed values with ~15% padding (at least `minSpan`), rounded to `step`. */
export function paddedDomain(values: (number | null)[], step: number, minSpan: number, floor = -Infinity, ceil = Infinity): [number, number] | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  if (!v.length) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = Math.max(hi - lo, minSpan);
  const pad = span * 0.15;
  const mid = (lo + hi) / 2;
  const a = Math.max(floor, Math.floor((Math.min(lo - pad, mid - span / 2 - pad)) / step) * step);
  const b = Math.min(ceil, Math.ceil((Math.max(hi + pad, mid + span / 2 + pad)) / step) * step);
  return [Number(a.toFixed(6)), Number(b.toFixed(6))];
}
