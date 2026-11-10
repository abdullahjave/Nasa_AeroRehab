import type {
  CopPath, FootAnalysis, FootSide, FrameAnalysis, Metric, PressureFrame, PressureSample, SensorForce, SessionAnalysis, UnavailableReason,
} from "./types";

/** 1 kPa acting on 1 cm^2 = 1000 N/m^2 * 1e-4 m^2 = 0.1 N. */
export const N_PER_KPA_CM2 = 0.1;

const value = <T,>(v: T): Metric<T> => ({ kind: "value", value: v });
const unavailable = (reason: UnavailableReason): Metric<never> => ({ kind: "unavailable", reason });

/** Force of one sensor in newtons: pressure_kPa * area_cm2 * 0.1. */
export function sensorForceN(pressureKpa: number, areaCm2: number): number {
  return pressureKpa * areaCm2 * N_PER_KPA_CM2;
}

/** Returns a message when the sample cannot be used, otherwise null. A missing sample is not invalid. */
export function validateSample(s: PressureSample): string | null {
  if (!Number.isFinite(s.areaCm2) || s.areaCm2 <= 0) return "area must be finite and > 0";
  if (!s.positionMm || !Number.isFinite(s.positionMm.x) || !Number.isFinite(s.positionMm.y)) return "position must be finite";
  if (s.status === "missing") return null;
  if (s.pressureKpa === null || !Number.isFinite(s.pressureKpa)) return "pressure must be a finite number";
  if (s.pressureKpa < 0) return "pressure must not be negative";
  return null;
}

const FOOT_FAIL = (side: FootSide, state: FootAnalysis["state"]): FootAnalysis => ({
  side,
  state,
  sensors: [],
  forceN: unavailable(state as UnavailableReason),
  peakKpa: unavailable(state as UnavailableReason),
  copMm: unavailable(state as UnavailableReason),
  loadedAreaCm2: unavailable(state as UnavailableReason),
  meanLoadedKpa: unavailable(state as UnavailableReason),
});

/** Analyse one foot of one frame. Every sensor of the foot must be valid; otherwise all its metrics are unavailable. */
export function analyzeFoot(side: FootSide, samples: PressureSample[]): FootAnalysis {
  const own = samples.filter((s) => s.side === side);
  if (own.length === 0) return FOOT_FAIL(side, "missing-foot");

  // Invalid data wins: corrupt input must never look like a normal missing sensor.
  const ids = new Set<string>();
  for (const s of own) {
    if (ids.has(s.sensorId)) return FOOT_FAIL(side, "invalid-input");
    ids.add(s.sensorId);
    if (validateSample(s) !== null) return FOOT_FAIL(side, "invalid-input");
  }
  const missing = own.filter((s) => s.status === "missing");
  if (missing.length === own.length) return FOOT_FAIL(side, "missing-foot");
  if (missing.length > 0) return FOOT_FAIL(side, "missing-sensor");

  const sensors: SensorForce[] = own.map((s) => ({
    sensorId: s.sensorId,
    pressureKpa: s.pressureKpa as number,
    areaCm2: s.areaCm2,
    forceN: sensorForceN(s.pressureKpa as number, s.areaCm2),
    positionMm: s.positionMm,
  }));
  const total = sensors.reduce((a, s) => a + s.forceN, 0);
  const loadedArea = sensors.filter((s) => s.pressureKpa > 0).reduce((a, s) => a + s.areaCm2, 0);

  let cop: FootAnalysis["copMm"];
  if (total > 0) {
    cop = value({
      x: sensors.reduce((a, s) => a + s.forceN * s.positionMm.x, 0) / total,
      y: sensors.reduce((a, s) => a + s.forceN * s.positionMm.y, 0) / total,
    });
  } else cop = unavailable("zero-load");

  return {
    side,
    state: "ok",
    sensors,
    forceN: value(total),
    peakKpa: value(Math.max(...sensors.map((s) => s.pressureKpa))),
    copMm: cop,
    loadedAreaCm2: value(loadedArea),
    meanLoadedKpa: loadedArea > 0 ? value((total / loadedArea) / N_PER_KPA_CM2) : unavailable("zero-load"),
  };
}

const footReason = (f: FootAnalysis): UnavailableReason => (f.state === "ok" ? "no-frames" : f.state);

/** Pick the most informative reason when one or both feet are unavailable. */
function bilateralReason(l: FootAnalysis, r: FootAnalysis): UnavailableReason {
  const reasons = [l, r].filter((f) => f.state !== "ok").map(footReason);
  for (const pref of ["invalid-input", "missing-foot", "missing-sensor"] as const) if (reasons.includes(pref)) return pref;
  return "no-frames";
}

export function analyzeFrame(frame: PressureFrame): FrameAnalysis {
  if (!Number.isFinite(frame.timestampMs)) {
    const bad = (side: FootSide) => FOOT_FAIL(side, "invalid-input");
    return { timestampMs: frame.timestampMs, left: bad("left"), right: bad("right"), shares: unavailable("invalid-input"), differencePp: unavailable("invalid-input"), peakKpa: unavailable("invalid-input") };
  }
  const left = analyzeFoot("left", frame.samples);
  const right = analyzeFoot("right", frame.samples);

  let shares: FrameAnalysis["shares"];
  let differencePp: FrameAnalysis["differencePp"];
  let peak: FrameAnalysis["peakKpa"];

  if (left.state !== "ok" || right.state !== "ok") {
    // Never infer a 100% share from a foot that is not reporting.
    const reason = bilateralReason(left, right);
    shares = unavailable(reason);
    differencePp = unavailable(reason);
    peak = unavailable(reason);
  } else {
    const fl = (left.forceN as { value: number }).value;
    const fr = (right.forceN as { value: number }).value;
    const total = fl + fr;
    if (total > 0) {
      const leftPct = (fl / total) * 100;
      const rightPct = (fr / total) * 100;
      shares = value({ leftPct, rightPct });
      differencePp = value(Math.abs(leftPct - rightPct));
    } else {
      shares = unavailable("zero-load");
      differencePp = unavailable("zero-load");
    }
    peak = value(Math.max((left.peakKpa as { value: number }).value, (right.peakKpa as { value: number }).value));
  }
  return { timestampMs: frame.timestampMs, left, right, shares, differencePp, peakKpa: peak };
}

/** Maximum over the frames where the metric is available. null when none is. */
function maxOf(frames: FrameAnalysis[], pick: (f: FrameAnalysis) => Metric<number>): Metric<number> {
  if (frames.length === 0) return unavailable("no-frames");
  let best: number | null = null;
  let firstReason: UnavailableReason = "no-frames";
  frames.forEach((f, i) => {
    const m = pick(f);
    if (m.kind === "value") best = best === null ? m.value : Math.max(best, m.value);
    else if (i === 0) firstReason = m.reason;
  });
  return best === null ? unavailable(firstReason) : value(best);
}

export function analyzeSession(analyses: FrameAnalysis[]): SessionAnalysis {
  const both = analyses.filter((f) => f.left.state === "ok" && f.right.state === "ok");
  let sumL = 0;
  let sumR = 0;
  for (const f of both) {
    sumL += (f.left.forceN as { value: number }).value;
    sumR += (f.right.forceN as { value: number }).value;
  }
  const total = sumL + sumR;
  let meanShares: SessionAnalysis["meanShares"];
  let meanDiff: SessionAnalysis["meanDifferencePp"];
  if (analyses.length === 0) {
    meanShares = unavailable("no-frames");
    meanDiff = unavailable("no-frames");
  } else if (both.length === 0) {
    const reason = analyses.length ? bilateralReason(analyses[0].left, analyses[0].right) : "no-frames";
    meanShares = unavailable(reason);
    meanDiff = unavailable(reason);
  } else if (total > 0) {
    const l = (sumL / total) * 100;
    const r = (sumR / total) * 100;
    meanShares = value({ leftPct: l, rightPct: r });
    meanDiff = value(Math.abs(l - r));
  } else {
    meanShares = unavailable("zero-load");
    meanDiff = unavailable("zero-load");
  }
  return {
    frameCount: analyses.length,
    peakKpa: {
      left: maxOf(analyses, (f) => f.left.peakKpa),
      right: maxOf(analyses, (f) => f.right.peakKpa),
      overall: maxOf(analyses, (f) => f.peakKpa),
    },
    meanShares,
    meanDifferencePp: meanDiff,
    completeFrames: both.length,
  };
}

/**
 * CoP path of one foot between fromMs and toMs (inclusive). Only consecutive frames that both have a CoP add
 * length; a frame without a CoP breaks the path instead of being bridged. Returns unavailable when fewer than
 * two consecutive CoP points exist.
 */
export function copPath(analyses: FrameAnalysis[], side: FootSide, fromMs: number, toMs: number): Metric<CopPath> {
  const win = analyses.filter((f) => f.timestampMs >= fromMs && f.timestampMs <= toMs);
  if (win.length === 0) return unavailable("no-frames");
  const points: CopPath["points"] = [];
  let length = 0;
  let elapsedMs = 0;
  let prev: { x: number; y: number; t: number } | null = null;
  for (const f of win) {
    const m = (side === "left" ? f.left : f.right).copMm;
    if (m.kind === "value") {
      points.push({ timestampMs: f.timestampMs, x: m.value.x, y: m.value.y });
      if (prev) {
        length += Math.hypot(m.value.x - prev.x, m.value.y - prev.y);
        elapsedMs += f.timestampMs - prev.t;
      }
      prev = { x: m.value.x, y: m.value.y, t: f.timestampMs };
    } else prev = null;
  }
  if (points.length < 2 || elapsedMs <= 0) return unavailable("no-frames");
  return value({ points, lengthMm: length, meanSpeedMmPerS: length / (elapsedMs / 1000) });
}

/** Index of the frame closest to timestampMs. */
export function nearestFrameIndex(analyses: { timestampMs: number }[], timestampMs: number): number {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < analyses.length; i++) {
    const dd = Math.abs(analyses[i].timestampMs - timestampMs);
    if (dd < d) { d = dd; best = i; }
  }
  return best;
}

/** Display helper: round only at the edge. Returns null for unavailable metrics. */
export const valueOf = <T,>(m: Metric<T>): T | null => (m.kind === "value" ? m.value : null);
