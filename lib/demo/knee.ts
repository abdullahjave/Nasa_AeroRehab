import type { Session } from "./types";

/**
 * Smooth (cubic Hermite) knee angle at any session time, interpolated from the 2 s samples.
 * Returns null inside a sensor dropout. Shared by every chart/readout so they always agree.
 */
export function kneeAt(s: Session, t: number): number | null {
  const samples = s.kneeSamples;
  const dt = s.sampleIntervalSec;
  const end = samples[samples.length - 1].t;
  const tc = Math.max(0, Math.min(end, t));
  const i = Math.min(samples.length - 2, Math.floor(tc / dt));
  const p1 = samples[i].flexionDeg;
  const p2 = samples[i + 1].flexionDeg;
  if (p1 === null || p2 === null) return null;
  const p0 = samples[Math.max(0, i - 1)].flexionDeg ?? p1;
  const p3 = samples[Math.min(samples.length - 1, i + 2)].flexionDeg ?? p2;
  const x = (tc - samples[i].t) / dt;
  const m1 = (p2 - p0) / 2;
  const m2 = (p3 - p1) / 2;
  const x2 = x * x;
  const x3 = x2 * x;
  return (2 * x3 - 3 * x2 + 1) * p1 + (x3 - 2 * x2 + x) * m1 + (-2 * x3 + 3 * x2) * p2 + (x3 - x2) * m2;
}

export const sessionEnd = (s: Session) => s.kneeSamples[s.kneeSamples.length - 1].t;

/** Angular velocity (deg/s) by central difference. */
export function angularVelocityAt(s: Session, t: number): number | null {
  const h = 0.25;
  const a = kneeAt(s, t - h);
  const b = kneeAt(s, t + h);
  return a === null || b === null ? null : (b - a) / (2 * h);
}

/** Angular acceleration (deg/s^2) by central difference of velocity. */
export function angularAccelerationAt(s: Session, t: number): number | null {
  const h = 0.25;
  const a = angularVelocityAt(s, t - h);
  const b = angularVelocityAt(s, t + h);
  return a === null || b === null ? null : (b - a) / (2 * h);
}

/** Simulated joint torque (Nm): scales linearly with flexion up to the fixture peak torque. */
export function torqueAt(s: Session, t: number): number | null {
  const a = kneeAt(s, t);
  const peak = s.knee.peakFlexionDeg;
  const tq = s.joint.peakTorqueNm;
  if (a === null || peak === null || tq === null) return null;
  return (Math.max(0, a) / peak) * tq;
}

/** Session peak |angular velocity| in deg/s, scanned at 1 s steps. */
export function peakAngularVelocity(s: Session): number | null {
  let best: number | null = null;
  for (let t = 1; t < sessionEnd(s); t += 1) {
    const v = angularVelocityAt(s, t);
    if (v !== null && (best === null || Math.abs(v) > best)) best = Math.abs(v);
  }
  return best;
}
