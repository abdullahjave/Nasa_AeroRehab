// Balance (postural sway) data model. Pure types, no React.
//
// TRIAL COORDINATE FRAME (millimetres), one frame per trial:
//   origin : centre of the force-plate area under the stance foot, fixed at the start of the trial
//   +ML (x): toward the astronaut's right (medio-lateral axis of the plate, same for left and right trials)
//   +AP (y): anterior (antero-posterior axis, toward the toes)
// A trial has exactly one stance foot, so left and right foot-local coordinates are never mixed.
//
// SAMPLING: fixed rate per trial (sampleRateHz). Every expected sample slot is present in `samples`; a slot
// without data has status "missing" (ml/ap = null). timestampMs is ms since the trial start and must increase.
// A CoP that stays exactly still is a valid measurement (zero movement), not missing data.

export type TrialSide = "left" | "right";
export type BalanceProtocol = "single-leg-stance-eyes-open";

export type BalanceSample = {
  timestampMs: number;
  mlMm: number | null;
  apMm: number | null;
  status: "ok" | "missing";
};

export type BalanceTrial = {
  id: string;
  astronautId: string;
  /** Session the trial belongs to (may be a history session without a full record in the dataset). */
  sessionId: string;
  missionDay: number;
  /** Display start time, e.g. "08:42 UTC". */
  startedAt: string;
  side: TrialSide;
  protocol: BalanceProtocol;
  /** How long the stance was held (s); equals the recorded span. */
  durationS: number;
  sampleRateHz: number;
  /** "simulated" = generated balance CoP trace, not taken from the Load & Pressure insole data. */
  source: "simulated";
  samples: BalanceSample[];
};

export type BalanceReason =
  | "no-samples"
  | "insufficient-coverage"
  | "too-few-points"
  | "degenerate"
  | "invalid-input"
  | "no-baseline"
  | "no-trial";

export type BMetric<T> = { kind: "value"; value: T } | { kind: "unavailable"; reason: BalanceReason };

export type SwayEllipse = {
  /** Centre (mean ML, mean AP), mm. */
  cx: number;
  cy: number;
  /** Semi-axes in mm (a >= b) and orientation of the major axis from +ML, radians. */
  a: number;
  b: number;
  angleRad: number;
  /** pi * 5.991 * sqrt(det(cov)), mm^2. */
  areaMm2: number;
};

export type TrialSummary = {
  totalSamples: number;
  validSamples: number;
  /** validSamples / totalSamples (0-1). */
  coverage: number;
  /** True when 0 < missing and coverage is still >= MIN_COVERAGE. */
  partial: boolean;
  issues: string[];
  pathLengthMm: BMetric<number>;
  meanSpeedMmPerS: BMetric<number>;
  rmsMlMm: BMetric<number>;
  rmsApMm: BMetric<number>;
  /** sqrt(rmsMl^2 + rmsAp^2). */
  rmsResultantMm: BMetric<number>;
  ellipse: BMetric<SwayEllipse>;
};
