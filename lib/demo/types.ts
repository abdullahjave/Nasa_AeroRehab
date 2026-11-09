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

export type ZoneKey = "hallux" | "toes" | "mt1" | "mt23" | "mt45" | "midfoot" | "heel";
/** Plantar pressure per zone in kPa. null = insole unavailable for that zone. */
export type PressureZones = Record<ZoneKey, number | null>;

export type ImuCalibration = {
  status: "valid" | "stale" | "unavailable";
  biasG: [number, number, number];
  scaleFactor: number | null;
  tempC: number | null;
};

export type JointData = {
  /** Fixture: peak simulated torque at peak flexion. */
  peakTorqueNm: number | null;
  /** Fixture score, percent. */
  smoothnessPct: number | null;
  symmetryPct: number | null;
  /** Other-knee summary. null when there is no bilateral data. */
  contralateral: { romDeg: number; torqueNm: number; peakVelDegS: number } | null;
  /** Personal baseline for the instrumented knee. */
  baseline: { peakFlexionDeg: number; romDeg: number; torqueNm: number; smoothnessPct: number } | null;
  cartilage: { peakMpa: number; limitMpa: number; medial: number; lateral: number; patellofemoral: number } | null;
  checks: string[];
  imu: { thigh: ImuCalibration; shank: ImuCalibration };
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
  pressure: { left: PressureZones; right: PressureZones } | null;
  /** Percent of body load, left/right. null = insole unavailable. */
  loadSplit: { leftPct: number; rightPct: number } | null;
  /** Fixture score 0-100. null = not calibrated. */
  balanceIndex: number | null;
  /** Radar values 0-100: forward, backward, left, right, lateral. */
  balanceAxes: [number, number, number, number, number] | null;
  joint: JointData;
};

export type OverviewMetrics = {
  /** Fixture scores. Not computed from samples. */
  kis: number | null;
  kisMax: 100;
  readinessPct: number | null;
  /** Signed percent difference from personal baseline. */
  baselineDeviationPct: number | null;
  dailyActivity: {
    steps: number | null;
    stepGoal: number;
    distanceKm: number | null;
    activeMinutes: number | null;
    hourly: number[];
  };
  rehab: {
    progressPct: number | null;
    deltaVsLastPct: number | null;
    statusLabel: string;
    phase: string;
    week: number;
    totalWeeks: number;
    nextExercise: string;
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

export type Insight = {
  id: InsightId;
  astronautId: AstronautId;
  /** Session this insight was derived from. */
  sessionId: SessionId;
  severity: "info" | "watch";
  title: string;
  body: string;
  recommendation: string | null;
  generatedAt: string;
};

export type AstronautRecord = {
  id: AstronautId;
  missionId: MissionId;
  profile: AstronautProfile;
  sensors: Sensor[];
  sessions: Session[]; // oldest -> newest; the last one is the latest
  overview: OverviewMetrics;
  trend: TrendPoint[];
  insights: Insight[];
};
