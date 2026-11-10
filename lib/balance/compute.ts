import type { BMetric, BalanceReason, BalanceSample, SwayEllipse, TrialSummary } from "./types";

/** 2D Gaussian chi-square value for 95% (2 degrees of freedom). */
export const CHI2_95_2D = 5.991;
/** Minimum fraction of valid samples for a trial summary to be shown. */
export const MIN_COVERAGE = 0.8;
/** Minimum valid points for RMS / ellipse (sample covariance needs >= 3 for a 2D shape). */
export const MIN_POINTS = 3;
/** A pause longer than this many sample intervals between valid samples is a gap. */
const GAP_FACTOR = 1.5;

const value = <T,>(v: T): BMetric<T> => ({ kind: "value", value: v });
const unavailable = (reason: BalanceReason): BMetric<never> => ({ kind: "unavailable", reason });

const isValid = (s: BalanceSample) =>
  s.status === "ok" && s.mlMm !== null && s.apMm !== null && Number.isFinite(s.mlMm) && Number.isFinite(s.apMm);

/** Problems that make the record unusable: non-finite or non-increasing timestamps, bad values on "ok" samples. */
export function validateSamples(samples: BalanceSample[]): string[] {
  const issues: string[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!Number.isFinite(s.timestampMs)) issues.push(`sample ${i}: timestamp is not finite`);
    else if (i > 0 && !(s.timestampMs > samples[i - 1].timestampMs)) issues.push(`sample ${i}: timestamp does not increase`);
    if (s.status === "ok" && !isValid(s)) issues.push(`sample ${i}: coordinates must be finite numbers`);
  }
  return issues;
}

/** Contiguous runs of valid samples. A missing sample or a time jump breaks a run. */
export function validSegments(samples: BalanceSample[], expectedIntervalMs?: number): BalanceSample[][] {
  const segs: BalanceSample[][] = [];
  let cur: BalanceSample[] = [];
  for (const s of samples) {
    const prev = cur[cur.length - 1];
    const jump = prev && expectedIntervalMs !== undefined && s.timestampMs - prev.timestampMs > expectedIntervalMs * GAP_FACTOR;
    if (!isValid(s) || jump) {
      if (cur.length) segs.push(cur);
      cur = isValid(s) ? [s] : [];
      continue;
    }
    cur.push(s);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

/** Path length (mm) and observed time (s) over valid segments. Distance is never added across a gap. */
export function pathAndTime(samples: BalanceSample[], expectedIntervalMs?: number) {
  let length = 0;
  let timeMs = 0;
  for (const seg of validSegments(samples, expectedIntervalMs)) {
    for (let i = 1; i < seg.length; i++) {
      length += Math.hypot((seg[i].mlMm as number) - (seg[i - 1].mlMm as number), (seg[i].apMm as number) - (seg[i - 1].apMm as number));
    }
    if (seg.length > 1) timeMs += seg[seg.length - 1].timestampMs - seg[0].timestampMs;
  }
  return { lengthMm: length, observedS: timeMs / 1000 };
}

/** Mean-centred RMS (population, divide by N) of one axis. */
export function centredRms(v: number[]): number {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

/** Sample covariance (divide by N-1) of paired coordinates. */
export function sampleCovariance(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  return { mx, my, xx: sxx / (n - 1), yy: syy / (n - 1), xy: sxy / (n - 1) };
}

/** 95% ellipse from the sample covariance. Unavailable for too few points or a degenerate (flat) cloud. */
export function swayEllipse(x: number[], y: number[]): BMetric<SwayEllipse> {
  if (x.length < MIN_POINTS) return unavailable("too-few-points");
  const c = sampleCovariance(x, y);
  const det = c.xx * c.yy - c.xy * c.xy;
  const scale = Math.max(c.xx, c.yy);
  if (!(det > 0) || scale <= 0 || det <= 1e-12 * scale * scale) return unavailable("degenerate");
  const tr = c.xx + c.yy;
  const disc = Math.sqrt(Math.max(0, (tr / 2) ** 2 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  const angle = Math.abs(c.xy) < 1e-15 ? (c.xx >= c.yy ? 0 : Math.PI / 2) : Math.atan2(l1 - c.xx, c.xy);
  return value({
    cx: c.mx,
    cy: c.my,
    a: Math.sqrt(CHI2_95_2D * l1),
    b: Math.sqrt(CHI2_95_2D * Math.max(0, l2)),
    angleRad: angle,
    areaMm2: Math.PI * CHI2_95_2D * Math.sqrt(det),
  });
}

/** Full-trial summary. All metrics are unavailable when the record is invalid or coverage is below MIN_COVERAGE. */
export function summarizeTrial(samples: BalanceSample[], sampleRateHz?: number): TrialSummary {
  const issues = validateSamples(samples);
  const valid = samples.filter(isValid);
  const total = samples.length;
  const coverage = total ? valid.length / total : 0;
  const base = { totalSamples: total, validSamples: valid.length, coverage, partial: valid.length < total && coverage >= MIN_COVERAGE, issues };
  const fail = (r: BalanceReason): TrialSummary => ({
    ...base,
    partial: false,
    pathLengthMm: unavailable(r),
    meanSpeedMmPerS: unavailable(r),
    rmsMlMm: unavailable(r),
    rmsApMm: unavailable(r),
    rmsResultantMm: unavailable(r),
    ellipse: unavailable(r),
  });
  if (total === 0 || valid.length === 0) return fail("no-samples");
  if (issues.length) return fail("invalid-input");
  if (coverage < MIN_COVERAGE) return fail("insufficient-coverage");
  if (valid.length < MIN_POINTS) return fail("too-few-points");

  const interval = sampleRateHz ? 1000 / sampleRateHz : undefined;
  const { lengthMm, observedS } = pathAndTime(samples, interval);
  const x = valid.map((s) => s.mlMm as number);
  const y = valid.map((s) => s.apMm as number);
  const rmsMl = centredRms(x);
  const rmsAp = centredRms(y);
  return {
    ...base,
    pathLengthMm: value(lengthMm),
    meanSpeedMmPerS: observedS > 0 ? value(lengthMm / observedS) : unavailable("too-few-points"),
    rmsMlMm: value(rmsMl),
    rmsApMm: value(rmsAp),
    rmsResultantMm: value(Math.sqrt(rmsMl ** 2 + rmsAp ** 2)),
    ellipse: swayEllipse(x, y),
  };
}

/** (current - baseline) / baseline * 100. Needs both values and a finite, positive baseline. */
export function percentChange(current: BMetric<number>, baseline: BMetric<number> | null | undefined): BMetric<number> {
  if (!baseline || baseline.kind !== "value" || !Number.isFinite(baseline.value) || baseline.value <= 0) return unavailable("no-baseline");
  if (current.kind !== "value") return current;
  return value(((current.value - baseline.value) / baseline.value) * 100);
}

export const bval = <T,>(m: BMetric<T>): T | null => (m.kind === "value" ? m.value : null);
