// Plantar-pressure data model. Pure types: no React, no browser APIs, so the same code can later take real sensor input.
//
// FOOT-LOCAL COORDINATE FRAME (millimetres), identical for both feet:
//   origin : centre of the heel, at the posterior-most point of the foot on its long axis
//   +y     : anterior (heel -> toes)
//   +x     : medial (toward the other foot). Negative x is lateral.
// Both feet use this same definition, so the right foot is the mirror image of the left when drawn.
// UNITS: pressure kPa, area cm^2, position mm, time ms (since the start of the recording), force N.

export type FootSide = "left" | "right";
export type ZoneKey = "hallux" | "toes" | "mt1" | "mt23" | "mt45" | "midfoot" | "heel";

/** "missing" = the sensor delivered no reading (disconnected, dropped out). A measured 0 kPa has status "ok". */
export type SampleStatus = "ok" | "missing";

export type PressureSample = {
  /** Milliseconds since the start of the recording. */
  timestampMs: number;
  sensorId: string;
  side: FootSide;
  /** kPa. Must be null when status is "missing". 0 is a valid measured value. */
  pressureKpa: number | null;
  /** Active sensing area in cm^2. Must be finite and > 0. */
  areaCm2: number;
  /** Sensor centre in the foot-local frame above, in mm. */
  positionMm: { x: number; y: number };
  status: SampleStatus;
};

/** All samples that share one timestamp. */
export type PressureFrame = { timestampMs: number; samples: PressureSample[] };

export type UnavailableReason =
  | "missing-foot" // no readings at all for that foot (e.g. insole disconnected)
  | "missing-sensor" // at least one sensor of the foot has no reading
  | "invalid-input" // negative/non-finite reading, bad geometry, duplicate sensor id, bad timestamp
  | "zero-load" // measured, but total force is 0 so a share / CoP is undefined
  | "no-frames"; // nothing to aggregate

export type Metric<T> = { kind: "value"; value: T } | { kind: "unavailable"; reason: UnavailableReason };

export type SensorForce = {
  sensorId: string;
  pressureKpa: number;
  areaCm2: number;
  /** pressure_kPa * area_cm2 * 0.1 */
  forceN: number;
  positionMm: { x: number; y: number };
};

export type FootAnalysis = {
  side: FootSide;
  /** "ok" when every sensor of the foot has a valid measured reading. */
  state: "ok" | Exclude<UnavailableReason, "zero-load" | "no-frames">;
  sensors: SensorForce[];
  forceN: Metric<number>;
  /** Highest sensor pressure (kPa). Defined only when the whole foot is valid. */
  peakKpa: Metric<number>;
  /** Force-weighted centre of pressure in the foot-local frame (mm). */
  copMm: Metric<{ x: number; y: number }>;
  /** Sum of the active area of sensors reading above 0 kPa (cm^2). */
  loadedAreaCm2: Metric<number>;
  /** Total force / loaded area, in kPa. */
  meanLoadedKpa: Metric<number>;
};

export type FrameAnalysis = {
  timestampMs: number;
  left: FootAnalysis;
  right: FootAnalysis;
  /** Bilateral share of total force, percent. Needs both feet valid and total force > 0. */
  shares: Metric<{ leftPct: number; rightPct: number }>;
  /** |left% - right%| in percentage points. */
  differencePp: Metric<number>;
  /** Peak of both feet. Needs both feet valid. */
  peakKpa: Metric<number>;
};

export type SessionAnalysis = {
  frameCount: number;
  peakKpa: { left: Metric<number>; right: Metric<number>; overall: Metric<number> };
  /** Share from summed force over frames where both feet are valid: sum(F_left) / sum(F_left + F_right). */
  meanShares: Metric<{ leftPct: number; rightPct: number }>;
  meanDifferencePp: Metric<number>;
  /** Frames where both feet were fully valid. */
  completeFrames: number;
};

export type CopPath = {
  points: { timestampMs: number; x: number; y: number }[];
  /** Sum of straight-line distances between CoP points of consecutive frames (mm). Gaps are not bridged. */
  lengthMm: number;
  /** lengthMm divided by the elapsed time of the counted segments (mm/s). */
  meanSpeedMmPerS: number;
};
