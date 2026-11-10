// Pure insight derivations (no React). Inputs are the canonical knee metrics and samples used by Joint Analytics.
import type { ReducedRomConfig } from "./config";

export type IReason = "missing-measurement" | "no-comparable-baseline" | "invalid-baseline" | "no-repetition";
export type IM<T> = { kind: "value"; value: T } | { kind: "unavailable"; reason: IReason };

const value = <T,>(v: T): IM<T> => ({ kind: "value", value: v });
const unavailable = (reason: IReason): IM<never> => ({ kind: "unavailable", reason });

export type MeasurementContext = { side: string; movement: string; protocol: string };

/** A baseline is comparable only for the same knee side, movement and protocol. */
export function isComparableBaseline(current: MeasurementContext, baseline: MeasurementContext | null | undefined): boolean {
  return !!baseline && baseline.side === current.side && baseline.movement === current.movement && baseline.protocol === current.protocol;
}

export type Comparison = { current: IM<number>; baseline: IM<number>; diff: IM<number>; pct: IM<number> };

/**
 * current vs baseline. diff = current - baseline (signed). pct = diff / baseline * 100, only for a finite
 * baseline > 0. The current value is always reported when measured, even without a comparable baseline.
 */
export function compare(current: number | null | undefined, baseline: number | null | undefined, comparable: boolean): Comparison {
  const cur = current === null || current === undefined || !Number.isFinite(current) ? unavailable("missing-measurement") : value(current);
  const base = !comparable || baseline === null || baseline === undefined ? unavailable("no-comparable-baseline") : !Number.isFinite(baseline) ? unavailable("invalid-baseline") : value(baseline);
  if (cur.kind !== "value") return { current: cur, baseline: base, diff: cur, pct: cur };
  if (base.kind !== "value") return { current: cur, baseline: base, diff: base, pct: base };
  const diff = cur.value - base.value;
  return { current: cur, baseline: base, diff: value(diff), pct: base.value > 0 ? value((diff / base.value) * 100) : unavailable("invalid-baseline") };
}

/** Inclusive threshold rule from config.ts. */
export function meetsReducedRom(rom: Comparison, cfg: ReducedRomConfig): boolean {
  return rom.pct.kind === "value" && rom.pct.value <= cfg.thresholdPct;
}

export type KneeSampleLike = { t: number; flexionDeg: number | null };

/** Contiguous runs of missing knee samples, as measured data-gap events (seconds). */
export function dataGaps(samples: KneeSampleLike[]): { startIdx: number; fromSec: number; toSec: number }[] {
  const out: { startIdx: number; fromSec: number; toSec: number }[] = [];
  let start = -1;
  samples.forEach((s, i) => {
    const miss = s.flexionDeg === null || !Number.isFinite(s.flexionDeg);
    if (miss && start < 0) start = i;
    if ((!miss || i === samples.length - 1) && start >= 0) {
      const end = miss ? i : i - 1;
      out.push({ startIdx: start, fromSec: samples[start].t, toSec: samples[end].t });
      start = -1;
    }
  });
  return out;
}

/** Keeps the first item for every id, so a finding or event is counted once. */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

export type RepCurve = {
  /** Samples of the repetition on a normalised axis: 0 % = start (extension), 100 % = end. */
  points: { pct: number; deg: number }[];
  peak: { pct: number; deg: number };
  startSec: number;
  endSec: number;
};

/**
 * The repetition that contains the session's highest sample, normalised to 0-100 % of that repetition.
 * Repetitions are split at local minima in the lowest quarter of the range. Unavailable when the peak repetition
 * is not bounded by two minima or contains a missing sample.
 */
export function peakRepetition(samples: KneeSampleLike[]): IM<RepCurve> {
  const vals = samples.map((s) => s.flexionDeg);
  const valid = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length < 5) return unavailable("no-repetition");
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const cut = lo + 0.25 * (hi - lo);
  const minima: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v === null || v > cut) continue;
    const prev = i > 0 ? vals[i - 1] : null;
    const next = i < vals.length - 1 ? vals[i + 1] : null;
    if ((prev === null || v <= prev) && (next === null || v <= next)) {
      if (minima.length && i - minima[minima.length - 1] < 3) {
        if (v < (vals[minima[minima.length - 1]] as number)) minima[minima.length - 1] = i;
      } else minima.push(i);
    }
  }
  const peakIdx = vals.indexOf(hi);
  const a = [...minima].reverse().find((m) => m < peakIdx);
  const b = minima.find((m) => m > peakIdx);
  if (a === undefined || b === undefined) return unavailable("no-repetition");
  const seg = samples.slice(a, b + 1);
  if (seg.some((s) => s.flexionDeg === null)) return unavailable("no-repetition");
  const t0 = seg[0].t;
  const span = seg[seg.length - 1].t - t0;
  const points = seg.map((s) => ({ pct: ((s.t - t0) / span) * 100, deg: s.flexionDeg as number }));
  const peak = points.reduce((m, p) => (p.deg > m.deg ? p : m), points[0]);
  return value({ points, peak, startSec: t0, endSec: seg[seg.length - 1].t });
}

/** Rows for a two-series chart on the shared cycle-% axis. A series is filled only where it has a real sample. */
export function overlayRows(current: RepCurve | null, baseline: RepCurve | null) {
  const map = new Map<number, { pct: number; current: number | null; baseline: number | null }>();
  const put = (c: RepCurve | null, key: "current" | "baseline") =>
    c?.points.forEach((p) => {
      const k = Math.round(p.pct * 100) / 100;
      const row = map.get(k) ?? { pct: k, current: null, baseline: null };
      row[key] = p.deg;
      map.set(k, row);
    });
  put(current, "current");
  put(baseline, "baseline");
  return [...map.values()].sort((x, y) => x.pct - y.pct);
}

export const ival = <T,>(m: IM<T>): T | null => (m.kind === "value" ? m.value : null);
