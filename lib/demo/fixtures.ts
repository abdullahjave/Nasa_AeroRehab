import { buildKneeSeries } from "./knee-series";
import type {
  AstronautRecord, GaitData, ImuCalibration, JointData, Mission, PressureZones, Session, TrendPoint,
} from "./types";

// All values below are deterministic fixtures for the Simulated Data demo.

export const MISSION: Mission = {
  id: "mission-artemis-ii",
  name: "Artemis-II",
  day: 42,
  totalDays: 120,
  phase: "Sustained surface operations",
  nextCheckIn: "06:00 UTC",
  commsStatus: "nominal",
  crewOnline: 3,
  crewTotal: 3,
  hubId: "ISS-EXP-042",
  displayClockUtc: "14:32:16",
};

// ---------- small deterministic builders ----------

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Heel-strike times inside 10 s; left and right alternate, jitter is deterministic. */
function stepEvents(stepTimeS: number, seed: number) {
  const leftS: number[] = [];
  const rightS: number[] = [];
  for (let i = 0; i * stepTimeS < 10; i++) {
    const t = r2(0.2 + i * stepTimeS + 0.018 * Math.sin(i * 1.7 + seed));
    if (t >= 10) break;
    (i % 2 === 0 ? leftS : rightS).push(t);
  }
  return { leftS, rightS };
}

function strideSeries(strideLen: number, stepTime: number, seed: number) {
  const strideLengthM: number[] = [];
  const stepTimeS: number[] = [];
  for (let i = 0; i < 30; i++) {
    strideLengthM.push(r2(strideLen + 0.025 * Math.sin(i * 0.9 + seed) + 0.012 * Math.cos(i * 2.3 + seed)));
    stepTimeS.push(r2(stepTime + 0.008 * Math.sin(i * 1.1 + seed * 2) + 0.004 * Math.cos(i * 2.7)));
  }
  return { strideLengthM, stepTimeS };
}

type GaitInput = {
  speed: number; cadence: number; stride: number; delta: number; series: number[];
  stance: number; doubleSupport: number; stepTime: number; symmetry: number; regularity: number;
  scale?: { hip: number; knee: number; ankle: number }; seed: number;
  insight: { title: string; text: string };
};
function gait(g: GaitInput): GaitData {
  return {
    speedMs: g.speed, cadenceSpm: g.cadence, strideLengthM: g.stride, speedDeltaPct: g.delta, speedSeries: g.series,
    stancePct: g.stance, swingPct: 100 - g.stance, doubleSupportPct: g.doubleSupport,
    stepTimeS: g.stepTime, strideTimeS: r2(g.stepTime * 2), symmetryPct: g.symmetry, regularity: g.regularity,
    curveScale: g.scale ?? { hip: 1, knee: 1, ankle: 1 },
    stepEvents: stepEvents(g.stepTime, g.seed), strideSeries: strideSeries(g.stride, g.stepTime, g.seed),
    insight: g.insight,
  };
}

const NULL_ZONES: PressureZones = { hallux: null, toes: null, mt1: null, mt23: null, mt45: null, midfoot: null, heel: null };
const zones = (hallux: number, toes: number, mt1: number, mt23: number, mt45: number, midfoot: number, heel: number): PressureZones =>
  ({ hallux, toes, mt1, mt23, mt45, midfoot, heel });

const cal = (temp: number, bias: [number, number, number] = [0.02, 0.01, 0.02]): ImuCalibration =>
  ({ status: "valid", biasG: bias, scaleFactor: 1.0, tempC: temp });

type SessionInput = Omit<Session, "kneeSamples" | "knee" | "durationSec" | "sampleIntervalSec" | "missionId"> & {
  durationSec: number;
  peak: number;
  min: number;
  current: number;
  repPeriodSec: number;
  peakRep: number;
  phase: number;
  dropouts?: number[];
};

function session(i: SessionInput): Session {
  const interval = 2;
  const { peak, min, current, repPeriodSec, peakRep, phase, dropouts, ...rest } = i;
  return {
    ...rest,
    missionId: MISSION.id,
    sampleIntervalSec: interval,
    kneeSamples: buildKneeSeries({
      count: i.durationSec / interval, intervalSec: interval, peakDeg: peak, minDeg: min, currentDeg: current,
      repPeriodSec, peakRep, phase, dropouts,
    }),
    knee: { currentAngleDeg: current, peakFlexionDeg: peak, minAngleDeg: min, romDeg: peak - min },
  };
}

function trend(prefix: string, rom: number[], sym: number[], move: number[]): TrendPoint[] {
  const last = MISSION.day;
  return rom.map((v, idx) => {
    const day = last - (rom.length - 1 - idx);
    return {
      sessionId: `sess-${prefix}-${String(day).padStart(3, "0")}-${day === last ? "b" : "a"}`,
      label: `Day ${day}`,
      missionDay: day,
      kneeRomPct: v,
      gaitSymmetryPct: sym[idx],
      movementScorePct: move[idx],
    };
  });
}

const joint = (j: Omit<JointData, "checks"> & { checks?: string[] }): JointData => ({
  checks: ["Joint kinematics stable", "Torque within nominal range", "No abnormal vibration detected"],
  ...j,
});

// ---------- Dr. Chen ----------

const chen: AstronautRecord = {
  id: "astro-chen",
  missionId: MISSION.id,
  profile: {
    fullName: "Dr. Mei Chen", displayName: "Dr. Chen", crewCode: "A-007", status: "Active", role: "Mission Specialist",
    ageYears: 41, heightCm: 168, massKg: 62, rehabFocus: "Left knee, post-ACL reconstruction", affectedLimb: "left", initials: "MC",
  },
  sensors: [
    { id: "sen-chen-thigh", label: "Thigh IMU", site: "thigh", status: "online", battery: 82 },
    { id: "sen-chen-shank", label: "Shank IMU", site: "shank", status: "online", battery: 76 },
    { id: "sen-chen-insole-l", label: "Left insole", site: "insole-left", status: "online", battery: 88 },
    { id: "sen-chen-insole-r", label: "Right insole", site: "insole-right", status: "online", battery: 71 },
  ],
  sessions: [
    session({
      id: "sess-chen-041-a", astronautId: "astro-chen", missionDay: 41, label: "Day 41 · Strength set",
      startedAt: "08:10 UTC", durationSec: 900, peak: 113, min: 5, current: 51.2, repPeriodSec: 20, peakRep: 22, phase: 0.4,
      gait: gait({
        speed: 1.37, cadence: 109, stride: 1.25, delta: 1, series: [1.31, 1.33, 1.34, 1.36, 1.35, 1.37],
        stance: 63, doubleSupport: 13, stepTime: 0.55, symmetry: 96, regularity: 0.92, seed: 0.3,
        insight: { title: "Gait pattern within nominal range", text: "Stance and swing split is stable. Slight asymmetry in loading response." },
      }),
      pressure: { left: zones(112, 66, 142, 168, 104, 42, 190), right: zones(120, 70, 152, 176, 112, 48, 204) },
      loadSplit: { leftPct: 46, rightPct: 54 }, balanceIndex: 91, balanceAxes: [90, 91, 92, 90, 91],
      joint: joint({
        peakTorqueNm: 40, smoothnessPct: 89, symmetryPct: 96,
        contralateral: { romDeg: 118, torqueNm: 43, peakVelDegS: 21 },
        baseline: { peakFlexionDeg: 125, romDeg: 121, torqueNm: 44, smoothnessPct: 94 },
        cartilage: { peakMpa: 2.7, limitMpa: 3.5, medial: 2.7, lateral: 2.1, patellofemoral: 1.5 },
        imu: { thigh: cal(27.9), shank: cal(28.2) },
      }),
    }),
    session({
      id: "sess-chen-042-b", astronautId: "astro-chen", missionDay: 42, label: "Day 42 · Knee mobility",
      startedAt: "08:30 UTC", durationSec: 1200, peak: 118, min: 4, current: 46.8, repPeriodSec: 20, peakRep: 34, phase: 1.1,
      gait: gait({
        speed: 1.42, cadence: 112, stride: 1.28, delta: 3, series: [1.34, 1.37, 1.39, 1.38, 1.41, 1.42],
        stance: 62, doubleSupport: 12, stepTime: 0.54, symmetry: 98, regularity: 0.94, seed: 1.1,
        insight: {
          title: "Gait pattern within nominal range",
          text: "Slight increase in knee flexion at mid-stance (+2.1°), within tolerance. Continue current rehabilitation plan.",
        },
      }),
      pressure: { left: zones(120, 70, 150, 175, 110, 45, 198), right: zones(130, 75, 160, 185, 120, 50, 212) },
      loadSplit: { leftPct: 48, rightPct: 52 }, balanceIndex: 94, balanceAxes: [95, 92, 95, 93, 94],
      joint: joint({
        peakTorqueNm: 42, smoothnessPct: 91, symmetryPct: 98,
        contralateral: { romDeg: 120, torqueNm: 44, peakVelDegS: 22 },
        baseline: { peakFlexionDeg: 125, romDeg: 121, torqueNm: 44, smoothnessPct: 94 },
        cartilage: { peakMpa: 2.8, limitMpa: 3.5, medial: 2.8, lateral: 2.2, patellofemoral: 1.6 },
        checks: ["Joint kinematics stable (±1.8°)", "Torque within nominal range", "No abnormal vibration detected"],
        imu: { thigh: cal(28.1), shank: cal(28.4) },
      }),
    }),
  ],
  overview: {
    kis: 92, kisMax: 100, readinessPct: 92, baselineDeviationPct: -2.1,
    dailyActivity: { steps: 12600, stepGoal: 14000, distanceKm: 8.4, activeMinutes: 74, hourly: [2, 5, 9, 14, 11, 8, 12, 15, 10, 6, 4, 2] },
    rehab: { progressPct: 68, deltaVsLastPct: 8, statusLabel: "On Track", phase: "Phase 3 · Strength", week: 9, totalWeeks: 12, nextExercise: "Single-leg squat, 3 x 8" },
  },
  trend: trend("chen", [88, 90, 91, 92, 93, 94], [93, 94, 96, 96, 97, 98], [88, 89, 90, 91, 91, 92]),
  insights: [
    {
      id: "ins-chen-001", astronautId: "astro-chen", sessionId: "sess-chen-042-b", severity: "watch",
      title: "Slight Gait Deviation Detected",
      body: "Knee flexion reduced by 6° during prolonged EVA simulation.",
      recommendation: "Perform 5 min mobility drill.",
      generatedAt: "Day 42 · 08:52 UTC",
    },
  ],
};

// ---------- Cmdr. Okafor ----------

const okafor: AstronautRecord = {
  id: "astro-okafor",
  missionId: MISSION.id,
  profile: {
    fullName: "Cmdr. Tunde Okafor", displayName: "Cmdr. Okafor", crewCode: "A-001", status: "Active", role: "Mission Commander",
    ageYears: 47, heightCm: 183, massKg: 84, rehabFocus: "Right knee, meniscus repair", affectedLimb: "right", initials: "TO",
  },
  sensors: [
    { id: "sen-okafor-thigh", label: "Thigh IMU", site: "thigh", status: "online", battery: 64 },
    { id: "sen-okafor-shank", label: "Shank IMU", site: "shank", status: "low-battery", battery: 18 },
    { id: "sen-okafor-insole-l", label: "Left insole", site: "insole-left", status: "online", battery: 77 },
    { id: "sen-okafor-insole-r", label: "Right insole", site: "insole-right", status: "online", battery: 69 },
  ],
  sessions: [
    session({
      id: "sess-okafor-041-a", astronautId: "astro-okafor", missionDay: 41, label: "Day 41 · Range of motion (no gait)",
      startedAt: "09:40 UTC", durationSec: 900, peak: 99, min: 8, current: 38.4, repPeriodSec: 24, peakRep: 15, phase: 2.3,
      gait: null, // seated session: no walking, so no gait data
      pressure: null, loadSplit: null, balanceIndex: null, balanceAxes: null,
      joint: joint({
        peakTorqueNm: 36, smoothnessPct: 84, symmetryPct: 90,
        contralateral: { romDeg: 112, torqueNm: 42, peakVelDegS: 18 },
        baseline: { peakFlexionDeg: 120, romDeg: 114, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 2.9, limitMpa: 3.5, medial: 2.9, lateral: 2.3, patellofemoral: 1.9 },
        imu: { thigh: cal(27.6), shank: cal(27.9) },
      }),
    }),
    session({
      id: "sess-okafor-042-b", astronautId: "astro-okafor", missionDay: 42, label: "Day 42 · Range of motion",
      startedAt: "09:55 UTC", durationSec: 1200, peak: 104, min: 7, current: 33.5, repPeriodSec: 24, peakRep: 41, phase: 2.9,
      gait: gait({
        speed: 1.21, cadence: 104, stride: 1.14, delta: -2, series: [1.17, 1.18, 1.2, 1.19, 1.2, 1.21],
        stance: 64, doubleSupport: 14, stepTime: 0.58, symmetry: 94, regularity: 0.88, seed: 2.2,
        scale: { hip: 0.92, knee: 0.86, ankle: 0.9 },
        insight: { title: "Mild asymmetry in loading", text: "Right-side stance is slightly longer than left. Monitor over the next three sessions." },
      }),
      pressure: { left: zones(98, 58, 122, 150, 96, 38, 172), right: zones(118, 66, 148, 176, 112, 46, 205) },
      loadSplit: { leftPct: 44, rightPct: 56 }, balanceIndex: null, balanceAxes: null,
      joint: joint({
        peakTorqueNm: 38, smoothnessPct: 86, symmetryPct: 92,
        contralateral: { romDeg: 113, torqueNm: 43, peakVelDegS: 18 },
        baseline: { peakFlexionDeg: 120, romDeg: 114, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 3.0, limitMpa: 3.5, medial: 3.0, lateral: 2.4, patellofemoral: 2.0 },
        checks: ["Joint kinematics stable (±2.6°)", "Torque within nominal range", "Shank IMU battery low (18%)"],
        imu: { thigh: cal(27.7), shank: cal(28.0, [0.03, 0.02, 0.02]) },
      }),
    }),
  ],
  overview: {
    kis: 84, kisMax: 100, readinessPct: 81, baselineDeviationPct: -6.8,
    dailyActivity: { steps: 9120, stepGoal: 12000, distanceKm: 6.1, activeMinutes: 58, hourly: [1, 3, 6, 9, 12, 10, 7, 8, 9, 5, 3, 1] },
    rehab: { progressPct: 54, deltaVsLastPct: 5, statusLabel: "On Track", phase: "Phase 2 · Mobility", week: 6, totalWeeks: 12, nextExercise: "Heel slides, 3 x 15" },
  },
  trend: trend("okafor", [74, 76, 78, 79, 80, 81], [88, 90, 91, 92, 93, 94], [76, 78, 80, 81, 83, 84]),
  insights: [
    {
      id: "ins-okafor-001", astronautId: "astro-okafor", sessionId: "sess-okafor-042-b", severity: "watch",
      title: "Shank sensor battery is low",
      body: "The shank IMU is at 18%. Balance Index is not calibrated for this astronaut yet.",
      recommendation: "Recharge before the next session.",
      generatedAt: "Day 42 · 10:21 UTC",
    },
  ],
};

// ---------- Maj. Alvarez ----------

const alvarez: AstronautRecord = {
  id: "astro-alvarez",
  missionId: MISSION.id,
  profile: {
    fullName: "Maj. Sofia Alvarez", displayName: "Maj. Alvarez", crewCode: "A-012", status: "Active", role: "Flight Engineer",
    ageYears: 36, heightCm: 172, massKg: 66, rehabFocus: "Right ankle, lateral ligament sprain", affectedLimb: "right", initials: "SA",
  },
  sensors: [
    { id: "sen-alvarez-thigh", label: "Thigh IMU", site: "thigh", status: "online", battery: 91 },
    { id: "sen-alvarez-shank", label: "Shank IMU", site: "shank", status: "online", battery: 85 },
    { id: "sen-alvarez-insole-l", label: "Left insole", site: "insole-left", status: "online", battery: 73 },
    { id: "sen-alvarez-insole-r", label: "Right insole", site: "insole-right", status: "offline", battery: null },
  ],
  sessions: [
    session({
      id: "sess-alvarez-041-a", astronautId: "astro-alvarez", missionDay: 41, label: "Day 41 · Balance drills",
      startedAt: "07:20 UTC", durationSec: 900, peak: 110, min: 3, current: 58.0, repPeriodSec: 18, peakRep: 30, phase: 3.7,
      gait: gait({
        speed: 1.31, cadence: 106, stride: 1.2, delta: 2, series: [1.27, 1.28, 1.3, 1.29, 1.3, 1.31],
        stance: 62, doubleSupport: 12, stepTime: 0.57, symmetry: 94, regularity: 0.89, seed: 3.3,
        scale: { hip: 0.97, knee: 0.95, ankle: 0.96 },
        insight: { title: "Gait pattern within nominal range", text: "Cadence is steady. Continue balance drills." },
      }),
      pressure: { left: zones(110, 64, 140, 162, 102, 40, 186), right: zones(112, 66, 144, 166, 106, 44, 190) },
      loadSplit: { leftPct: 52, rightPct: 48 }, balanceIndex: 87, balanceAxes: [86, 87, 88, 86, 85],
      joint: joint({
        peakTorqueNm: 41, smoothnessPct: 90, symmetryPct: null,
        contralateral: null, baseline: { peakFlexionDeg: 120, romDeg: 117, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 2.6, limitMpa: 3.5, medial: 2.6, lateral: 2.2, patellofemoral: 1.5 },
        imu: { thigh: cal(28.3), shank: cal(28.6) },
      }),
    }),
    session({
      id: "sess-alvarez-042-b", astronautId: "astro-alvarez", missionDay: 42, label: "Day 42 · Balance drills",
      startedAt: "07:35 UTC", durationSec: 1200, peak: 112, min: 2, current: 61.2, repPeriodSec: 18, peakRep: 52, phase: 4.2,
      gait: gait({
        speed: 1.35, cadence: 108, stride: 1.22, delta: 3, series: [1.29, 1.31, 1.32, 1.34, 1.33, 1.35],
        stance: 62, doubleSupport: 12, stepTime: 0.56, symmetry: 95, regularity: 0.9, seed: 4.4,
        scale: { hip: 0.98, knee: 0.96, ankle: 0.97 },
        insight: { title: "Gait pattern within nominal range", text: "Step timing is regular. Right insole is offline, so left/right load comparison is unavailable." },
      }),
      pressure: { left: zones(114, 66, 146, 170, 108, 44, 192), right: NULL_ZONES },
      loadSplit: null, balanceIndex: 89, balanceAxes: [90, 88, 89, 90, 88], dropouts: [212, 213, 214, 215],
      joint: joint({
        peakTorqueNm: 41, smoothnessPct: 90, symmetryPct: null,
        contralateral: null, baseline: { peakFlexionDeg: 120, romDeg: 117, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 2.6, limitMpa: 3.5, medial: 2.6, lateral: 2.1, patellofemoral: 1.5 },
        checks: ["Joint kinematics stable (±1.9°)", "Short knee data dropout near 07:00", "No abnormal vibration detected"],
        imu: { thigh: cal(28.3), shank: cal(28.6) },
      }),
    }),
  ],
  overview: {
    kis: 88, kisMax: 100, readinessPct: 90, baselineDeviationPct: 1.3,
    dailyActivity: { steps: 11415, stepGoal: 14000, distanceKm: 7.6, activeMinutes: 81, hourly: [3, 6, 10, 13, 12, 9, 11, 14, 12, 7, 5, 3] },
    rehab: { progressPct: 77, deltaVsLastPct: 6, statusLabel: "On Track", phase: "Phase 3 · Strength", week: 10, totalWeeks: 12, nextExercise: "Single-leg balance, 4 x 30 s" },
  },
  trend: trend("alvarez", [86, 88, 90, 91, 92, 93], [90, 91, 93, 94, 95, 95], [82, 84, 85, 86, 87, 88]),
  insights: [
    {
      id: "ins-alvarez-001", astronautId: "astro-alvarez", sessionId: "sess-alvarez-042-b", severity: "watch",
      title: "Right insole is offline",
      body: "Left-right pressure split cannot be computed while the right insole is offline.",
      recommendation: "Re-seat the right insole and re-run the walk test.",
      generatedAt: "Day 42 · 07:58 UTC",
    },
  ],
};

export const ASTRONAUTS: AstronautRecord[] = [chen, okafor, alvarez];
