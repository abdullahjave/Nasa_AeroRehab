import type { BalanceProtocol, BalanceSample, BalanceTrial, TrialSide } from "./types";

/** Parameters of one simulated balance trial. The generated samples are the only source of sway metrics. */
export type BalanceTrialSpec = {
  id: string;
  sessionId: string;
  missionDay: number;
  startedAt: string;
  side: TrialSide;
  protocol: BalanceProtocol;
  durationS: number;
  sampleRateHz: number;
  /** Overall sway amplitude per axis (mm). */
  ampMlMm: number;
  ampApMm: number;
  seed: number;
  /** Intervals (s since trial start) without data. */
  dropouts?: { fromS: number; toS: number }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic sway trace: a sum of slow and fast sinusoids per axis, with a small ML/AP coupling. */
export function buildTrial(spec: BalanceTrialSpec, astronautId: string): BalanceTrial {
  const n = Math.round(spec.durationS * spec.sampleRateHz);
  const samples: BalanceSample[] = [];
  const s = spec.seed;
  const TAU = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = i / spec.sampleRateHz;
    const timestampMs = Math.round((i * 1000) / spec.sampleRateHz);
    const missing = (spec.dropouts ?? []).some((d) => t >= d.fromS && t < d.toS);
    if (missing) {
      samples.push({ timestampMs, mlMm: null, apMm: null, status: "missing" });
      continue;
    }
    const ml =
      spec.ampMlMm *
      (0.62 * Math.sin(TAU * 0.21 * t + s) + 0.34 * Math.sin(TAU * 0.53 * t + 1.3 * s) + 0.18 * Math.sin(TAU * 1.37 * t + 2.1 * s) + 0.12 * Math.sin(TAU * 0.07 * t + 0.4 * s));
    const ap =
      spec.ampApMm *
        (0.58 * Math.sin(TAU * 0.17 * t + 0.7 * s) + 0.36 * Math.sin(TAU * 0.44 * t + 1.9 * s) + 0.2 * Math.sin(TAU * 1.11 * t + 2.7 * s) + 0.14 * Math.sin(TAU * 0.05 * t + s)) +
      0.15 * ml;
    samples.push({ timestampMs, mlMm: r2(ml), apMm: r2(ap), status: "ok" });
  }
  return {
    id: spec.id,
    astronautId,
    sessionId: spec.sessionId,
    missionDay: spec.missionDay,
    startedAt: spec.startedAt,
    side: spec.side,
    protocol: spec.protocol,
    durationS: spec.durationS,
    sampleRateHz: spec.sampleRateHz,
    source: "simulated",
    samples,
  };
}
