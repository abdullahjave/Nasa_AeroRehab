import type { PressureSpec } from "../pressure/simulate";
import type { BalanceTrialSpec } from "../balance/simulate";

// Shared simulated dataset types. Every reading that can be missing is `number | null`;
// the UI renders null as "Unavailable" (never 0). All values are fixtures, not live data.

export type AstronautId = "astro-chen" | "astro-okafor" | "astro-alvarez";
export type MissionId = "mission-artemis-ii";
export type SessionId = string; // e.g. "sess-chen-042-b"
export type InsightId = string;

export type SensorStatus = "online" | "offline" | "low-battery";

export type Sensor = {
  id: string;
  label: string;
  site: "thigh" | "shank" | "insole-left" | "insole-right";
  status: SensorStatus;
  /** 0-100, null when the sensor is offline. */
  battery: number | null;
  /** Link signal 0-100. Optional: the demo fixtures do not provide it, and the UI never invents one. */
  signalPct?: number | null;
};

export type AstronautProfile = {
  fullName: string;
  /** Short form used in the top bar, e.g. "Dr. Chen". */
  displayName: string;
  /** Crew code shown on the profile card, e.g. "A-007". */
  crewCode: string;
  status: string;
  role: string;
  ageYears: number;
  heightCm: number;
  massKg: number;
  rehabFocus: string;
  affectedLimb: "left" | "right";
  initials: string;
  /** Supplied portrait for this one astronaut (public path). Crew without one show initials, never another person's image. */
  portrait?: string;
};

export type Mission = {
  id: MissionId;
  name: string;
  day: number;
  totalDays: number;
  phase: string;
  nextCheckIn: string;
  commsStatus: "nominal" | "degraded";
  crewOnline: number;
  crewTotal: number;
  /** Sensor-hub identifier shown in the sidebar. */
  hubId: string;
  /** Fixed display clock for the top bar (fixture, not a live clock). */
  displayClockUtc: string;
};

export type KneeSample = {
  /** Seconds since session start. */
  t: number;
  /** Knee flexion in degrees. null = sensor dropout. */
  flexionDeg: number | null;
};

export type KneeSummary = {
  /** Latest sample. Distinct from peak and ROM. */
  currentAngleDeg: number | null;
  /** Maximum flexion in the session. */
  peakFlexionDeg: number | null;
  /** Range of motion = peak flexion minus minimum (extension) angle. */
  romDeg: number | null;
  /** Minimum angle in the session (extension). */
  minAngleDeg: number | null;
};

export type GaitData = {
  speedMs: number | null;
  cadenceSpm: number | null;
  strideLengthM: number | null;
  speedDeltaPct: number | null;
  /** Recent speed samples for the preview sparkline. */
  speedSeries: number[];
  stancePct: number | null;
  swingPct: number | null;
  doubleSupportPct: number | null;
  stepTimeS: number | null;
  strideTimeS: number | null;
  symmetryPct: number | null;
  regularity: number | null;
  /** Per-astronaut amplitude scaling of the joint-angle curves. */
  curveScale: { hip: number; knee: number; ankle: number };
  /** Heel-strike times (s) inside a 10 s window. */
  stepEvents: { leftS: number[]; rightS: number[] } | null;
  /** 30 consecutive strides. */
  strideSeries: { strideLengthM: number[]; stepTimeS: number[] } | null;
  insight: { title: string; text: string };
};

export type { ZoneKey } from "../pressure/types";

export type ImuCalibration = {
  status: "valid" | "stale" | "unavailable";
  biasG: [number, number, number];
  scaleFactor: number | null;
  tempC: number | null;
};

export type KneeMeasurementContext = {
  side: "left" | "right";
  movement: "knee-flexion-extension";
  /** e.g. "active-knee-flexion", "loaded-knee-flexion", "balance-drill-knee-tracking". */
  protocol: string;
};

/** Seeded scenario event (not computed from measurements). */
export type ScenarioEvent = { id: string; tSec: number; label: string; detail: string };

export type JointData = {
  /** Fixture: peak simulated torque at peak flexion. */
  peakTorqueNm: number | null;
  /** Fixture score, percent. */
  smoothnessPct: number | null;
  symmetryPct: number | null;
  /** Other-knee summary. null when there is no bilateral data. */
  contralateral: { romDeg: number; torqueNm: number; peakVelDegS: number } | null;
  /** What the session's knee time series measures. Used to decide whether a baseline is comparable. */
  measurement: KneeMeasurementContext;
  /**
   * Personal baseline for a knee. Comparable only when side, movement and protocol match `measurement`.
   * `reference` parameters regenerate the baseline recording (simulated) for the repetition overlay.
   */
  baseline: (KneeMeasurementContext & {
    peakFlexionDeg: number;
    romDeg: number;
    /** null for a recorded (manual) baseline that has no torque reading. */
    torqueNm: number | null;
    /** null for a recorded baseline: there is no sample trace to score. */
    smoothnessPct: number | null;
    recordedMissionDay: number;
    /** Parameters that regenerate a SIMULATED baseline trace. null for recorded baselines: no trace is invented. */
    reference: { repPeriodSec: number; phase: number } | null;
  }) | null;
  cartilage: { peakMpa: number; limitMpa: number; medial: number; lateral: number; patellofemoral: number } | null;
  checks: string[];
  imu: { thigh: ImuCalibration; shank: ImuCalibration };
};

/** Labelled simulated fixtures: there is no documented scoring model behind these numbers. */
export type SessionBalance = {
  /** Demo Balance Index 0-100. null = not calibrated. */
  index: number | null;
  /** Demo status text shown next to the index. */
  indexStatus: string;
  /** Demo radar scores 0-100. */
  profile: { staticBalance: number; dynamicBalance: number; vestibular: number; proprioception: number; trunk: number; reactive: number } | null;
  /** Scenario flag for the demo. Not a clinical assessment. */
  scenarioFlag: string | null;
};

export type Session = {
  id: SessionId;
  astronautId: AstronautId;
  missionId: MissionId;
  missionDay: number;
  label: string;
  startedAt: string; // display string, UTC
  durationSec: number;
  sampleIntervalSec: number;
  kneeSamples: KneeSample[];
  knee: KneeSummary;
  /** null = session has no gait data. */
  gait: GaitData | null;
  /**
   * Parameters of the simulated plantar-pressure recording (null = none for this session). Samples, shares,
   * peaks and CoP are all derived from these in lib/pressure; there are no separate load-split fixtures.
   */
  pressureSpec: PressureSpec | null;
  /** Session-level balance demo fixtures. Sway metrics are computed from the trials in AstronautRecord.balanceTrials. */
  balance: SessionBalance | null;
  joint: JointData;
  /** Seeded demo scenario events on the session timeline. Measured events (data gaps) are derived separately. */
  scenarioEvents: ScenarioEvent[];
  /** Demo scenario fatigue output. null = no fatigue indicator for this session. */
  fatigue: { pct: number; label: string } | null;
  /**
   * Explicit, labelled simulated scenario that escalates this session's reduced-ROM finding to "Action Required".
   * Without it the same finding is "Needs Attention". Not a clinical rule.
   */
  alertScenario?: { severity: "action"; label: string };
  /**
   * Present only for sessions that come from the local database ("recorded" mode). Such a session has no sensor samples:
   * kneeSamples, gait, pressure and balance are empty or null, and nothing is filled from demo fixtures.
   */
  recorded?: {
    source: "manual";
    activity: string;
    /** ISO 8601, UTC. */
    recordedAt: string;
    torqueNm: number | null;
    /** This session is the saved baseline for its side, movement and protocol. */
    isBaseline: boolean;
    /** Placeholder shown for an astronaut with no saved sessions. Never listed as a session. */
    empty?: boolean;
  };
};

export type OverviewMetrics = {
  /** Fixture scores. Not computed from samples. */
  kis: number | null;
  kisMax: 100;
  readinessPct: number | null;
  dailyActivity: {
    steps: number | null;
    stepGoal: number;
    distanceKm: number | null;
    activeMinutes: number | null;
    hourly: number[];
  };
};

export type TrendPoint = {
  sessionId: SessionId;
  /** Axis label, e.g. "Day 38". */
  label: string;
  missionDay: number;
  kneeRomPct: number | null;
  gaitSymmetryPct: number | null;
  movementScorePct: number | null;
};


export type AstronautRecord = {
  id: AstronautId;
  missionId: MissionId;
  profile: AstronautProfile;
  sensors: Sensor[];
  sessions: Session[]; // oldest -> newest; the last one is the latest
  /** Recorded mode only: saved manual walking sessions (oldest -> newest). Absent in demo mode. */
  walking?: import("../recorded/types").WalkingSessionView[];
  /** Recorded mode only: saved manual pressure and balance assessments (oldest -> newest). Absent in demo mode. */
  pressure?: import("../recorded/types").PressureAssessmentView[];
  balance?: import("../recorded/types").BalanceAssessmentView[];
  overview: OverviewMetrics;
  trend: TrendPoint[];
  /** Simulated balance trials (single-leg stance), linked by sessionId; includes history days. */
  balanceTrials: BalanceTrialSpec[];
};
