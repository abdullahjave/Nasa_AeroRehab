import { buildKneeSeries } from "./knee-series";
import type { PressureSpec } from "../pressure/simulate";
import type { BalanceTrialSpec } from "../balance/simulate";
import type {
  AstronautRecord, GaitData, ImuCalibration, JointData, Mission, Session, TrendPoint,
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
/**
 * Speed, cadence, stride length and step time describe the same steady walking interval, so they must agree:
 * speed = strides/s x stride length = (cadence / 120) x stride length, and step time = 60 / cadence.
 * Speed and cadence are the headline fixtures; stride length and step time are derived from them (the `stride`
 * and `stepTime` inputs are kept only as the nominal centre of the per-stride jitter series).
 */
export const strideFromSpeed = (speedMs: number, cadenceSpm: number) => r2((speedMs * 120) / cadenceSpm);
export const stepTimeFromCadence = (cadenceSpm: number) => r2(60 / cadenceSpm);

function gait(g: GaitInput): GaitData {
  const stride = strideFromSpeed(g.speed, g.cadence);
  const stepTime = stepTimeFromCadence(g.cadence);
  return {
    speedMs: g.speed, cadenceSpm: g.cadence, strideLengthM: stride, speedDeltaPct: g.delta, speedSeries: g.series,
    stancePct: g.stance, swingPct: 100 - g.stance, doubleSupportPct: g.doubleSupport,
    stepTimeS: stepTime, strideTimeS: r2(stepTime * 2), symmetryPct: g.symmetry, regularity: g.regularity,
    curveScale: g.scale ?? { hip: 1, knee: 1, ankle: 1 },
    stepEvents: stepEvents(stepTime, g.seed), strideSeries: strideSeries(stride, stepTime, g.seed),
    insight: g.insight,
  };
}

const ZN = ["hallux", "toes", "mt1", "mt23", "mt45", "midfoot", "heel"] as const;
const peaks = (v: number[]) => Object.fromEntries(ZN.map((z, i) => [z, v[i]])) as Record<(typeof ZN)[number], number>;
/** Simulated pressure recording: peak kPa per zone (hallux, toes, mt1, mt23, mt45, midfoot, heel) for each foot. */
const spec = (seed: number, left: number[], right: number[], leftBias: number, dropouts?: PressureSpec["dropouts"]): PressureSpec => ({
  seed, durationSec: 30, sampleRateHz: 20, peaksKpa: { left: peaks(left), right: peaks(right) }, leftBias, shiftAmp: 0.08, dropouts,
});

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

/** Seeded demo scenario event. IDs are unique per session so an event is counted once. */
const ev = (sessionKey: string, n: number, tSec: number, label: string) => ({
  id: `evt-${sessionKey}-${n}`,
  tSec,
  label,
  detail: `${label} (seeded demo scenario event, not detected from measurements).`,
});

const joint = (j: Omit<JointData, "checks"> & { checks?: string[] }): JointData => ({
  checks: ["Joint kinematics stable", "Torque within nominal range", "No abnormal vibration detected"],
  ...j,
});


// ---------- balance (single-leg stance) ----------

const bal = (index: number | null, indexStatus: string, p: number[] | null, scenarioFlag: string | null): Session["balance"] => ({
  index,
  indexStatus,
  profile: p ? { staticBalance: p[0], dynamicBalance: p[1], vestibular: p[2], proprioception: p[3], trunk: p[4], reactive: p[5] } : null,
  scenarioFlag,
});

type TrialOpts = {
  code: string;
  seed: number;
  amp: { left: [number, number]; right: [number, number] };
  /** Hold time (s) per day 36..42 for each side. */
  hold: { left: number[]; right: number[] };
  /** Amplitude grows by this fraction per day going back from Day 42 (improvement over time). */
  improve: number;
  skip?: { day: number; side: "left" | "right" }[];
  dropouts?: { day: number; side: "left" | "right"; fromS: number; toS: number }[];
};

/** Simulated single-leg trials for Days 36-42, linked to session IDs (Days 41/42 are full sessions). */
function balanceTrials(o: TrialOpts): BalanceTrialSpec[] {
  const out: BalanceTrialSpec[] = [];
  for (let day = 36; day <= 42; day++) {
    for (const side of ["left", "right"] as const) {
      if (o.skip?.some((x) => x.day === day && x.side === side)) continue;
      const k = 1 + o.improve * (42 - day);
      const i = day - 36;
      out.push({
        id: `bal-${o.code}-${String(day).padStart(3, "0")}-${side === "left" ? "L" : "R"}`,
        sessionId: `sess-${o.code}-${String(day).padStart(3, "0")}-${day === 42 ? "b" : "a"}`,
        missionDay: day,
        startedAt: `${String(8 + (i % 3)).padStart(2, "0")}:${side === "left" ? "12" : "18"} UTC`,
        side,
        protocol: "single-leg-stance-eyes-open",
        durationS: o.hold[side][i],
        sampleRateHz: 25,
        ampMlMm: Math.round(o.amp[side][0] * k * 100) / 100,
        ampApMm: Math.round(o.amp[side][1] * k * 100) / 100,
        seed: o.seed + day * 0.37 + (side === "left" ? 0 : 1.9),
        dropouts: o.dropouts?.filter((d) => d.day === day && d.side === side).map((d) => ({ fromS: d.fromS, toS: d.toS })),
      });
    }
  }
  return out;
}

// ---------- Dr. Chen ----------


// ---------- Dr. Chen history (Days 13-39) ----------
// Full session records built with the same builders as Day 41/42, so every page derives its metrics from the
// same samples and summaries. Values improve gradually with a small deterministic wobble. Day 27 had no walking
// recording (gait = null) so the walking-speed trend has one explicit missing measurement.
const CHEN_BASELINE = {
  side: "left" as const, movement: "knee-flexion-extension" as const, protocol: "active-knee-flexion",
  recordedMissionDay: 30, reference: { repPeriodSec: 20, phase: 0.7 },
  peakFlexionDeg: 125, romDeg: 121, torqueNm: 44, smoothnessPct: 94,
};
function chenHistory(): Session[] {
  const days = [13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39];
  return days.map((day, i) => {
    const f = i / (days.length - 1); // 0 -> 1 across the history
    const w = Math.sin(day * 1.7); // deterministic wobble, -1..1
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const peak = Math.round(102 + 14 * f + 1.5 * w);
    const min = day < 25 ? 6 : 5;
    const speed = r2(1.16 + 0.22 * f + 0.02 * w);
    const cadence = Math.round(99 + 11 * f + 1.2 * w);
    const stride = r2(1.12 + 0.14 * f + 0.01 * w);
    const key = `chen-${String(day).padStart(3, "0")}-a`;
    return session({
      id: `sess-${key}`, astronautId: "astro-chen", missionDay: day, label: `Day ${day} · Knee mobility`,
      startedAt: "08:20 UTC", durationSec: 600, peak, min, current: r1(min + 0.38 * (peak - min)), repPeriodSec: 20, peakRep: 14, phase: 0.3 + day * 0.21,
      gait: day === 27 ? null : gait({
        speed, cadence, stride, delta: 0, series: [-0.05, -0.04, -0.03, -0.02, -0.01, 0].map((d) => r2(speed + d)),
        stance: 63, doubleSupport: 13, stepTime: r2(60 / cadence), symmetry: Math.round(92 + 5 * f), regularity: r2(0.86 + 0.07 * f), seed: day * 0.13,
        insight: { title: "Gait pattern within nominal range", text: "Simulated history session." },
      }),
      pressureSpec: null,
      balance: bal(Math.round(83 + 9 * f + 1.2 * w), "Stable (demo)", null, null),
      scenarioEvents: [],
      fatigue: null,
      joint: joint({
        measurement: { side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion" },
        peakTorqueNm: Math.round(34 + 7 * f), smoothnessPct: Math.round(82 + 8 * f), symmetryPct: Math.round(90 + 7 * f),
        contralateral: { romDeg: 118, torqueNm: 43, peakVelDegS: 21 },
        baseline: CHEN_BASELINE,
        cartilage: { peakMpa: r1(2.4 + 0.3 * f), limitMpa: 3.5, medial: r1(2.4 + 0.3 * f), lateral: r1(2.0 + 0.2 * f), patellofemoral: 1.5 },
        imu: { thigh: cal(28.0), shank: cal(28.2) },
      }),
    });
  });
}

const chen: AstronautRecord = {
  id: "astro-chen",
  missionId: MISSION.id,
  profile: {
    fullName: "Dr. Mei Chen", displayName: "Dr. Chen", crewCode: "A-007", status: "Active", role: "Mission Specialist",
    ageYears: 41, heightCm: 168, massKg: 62, rehabFocus: "Left knee, post-ACL reconstruction", affectedLimb: "left", initials: "MC", portrait: "/images/astronaut-portrait.webp",
  },
  sensors: [
    { id: "sen-chen-thigh", label: "Thigh IMU", site: "thigh", status: "online", battery: 82 },
    { id: "sen-chen-shank", label: "Shank IMU", site: "shank", status: "online", battery: 76 },
    { id: "sen-chen-insole-l", label: "Left insole", site: "insole-left", status: "online", battery: 88 },
    { id: "sen-chen-insole-r", label: "Right insole", site: "insole-right", status: "online", battery: 71 },
  ],
  sessions: [
    ...chenHistory(),
    session({
      id: "sess-chen-041-a", astronautId: "astro-chen", missionDay: 41, label: "Day 41 · Strength set",
      startedAt: "08:10 UTC", durationSec: 900, peak: 113, min: 5, current: 51.2, repPeriodSec: 20, peakRep: 22, phase: 0.4,
      gait: gait({
        speed: 1.37, cadence: 109, stride: 1.25, delta: 1, series: [1.31, 1.33, 1.34, 1.36, 1.35, 1.37],
        stance: 63, doubleSupport: 13, stepTime: 0.55, symmetry: 96, regularity: 0.92, seed: 0.3,
        insight: { title: "Gait pattern within nominal range", text: "Stance and swing split is stable. Slight asymmetry in loading response." },
      }),
      pressureSpec: spec(1.4, [112, 66, 142, 168, 104, 42, 190], [120, 70, 152, 176, 112, 48, 204], 0.46), balance: bal(91, "Stable (demo)", [90, 84, 82, 78, 86, 80], null),
      scenarioEvents: [],
      fatigue: { pct: 58, label: "Low (demo)" },
      joint: joint({
        measurement: { side: "left", movement: "knee-flexion-extension", protocol: "loaded-knee-flexion" },
        peakTorqueNm: 40, smoothnessPct: 89, symmetryPct: 96,
        contralateral: { romDeg: 118, torqueNm: 43, peakVelDegS: 21 },
        baseline: { side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 30, reference: { repPeriodSec: 20, phase: 0.7 }, peakFlexionDeg: 125, romDeg: 121, torqueNm: 44, smoothnessPct: 94 },
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
      pressureSpec: spec(2.5, [120, 70, 150, 175, 110, 45, 198], [130, 75, 160, 185, 120, 50, 212], 0.48), balance: bal(94, "Stable (demo)", [92, 86, 84, 80, 88, 82], "Demo scenario: review single-leg tasks during reduced-gravity adaptation drills. Not a clinical assessment."),
      scenarioEvents: [ev("chen-042-b", 1, 470, "Flexion plateau"), ev("chen-042-b", 2, 1010, "Flexion plateau")],
      fatigue: { pct: 64, label: "Moderate (demo)" },
      joint: joint({
        measurement: { side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion" },
        peakTorqueNm: 42, smoothnessPct: 91, symmetryPct: 98,
        contralateral: { romDeg: 120, torqueNm: 44, peakVelDegS: 22 },
        baseline: { side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 30, reference: { repPeriodSec: 20, phase: 0.7 }, peakFlexionDeg: 125, romDeg: 121, torqueNm: 44, smoothnessPct: 94 },
        cartilage: { peakMpa: 2.8, limitMpa: 3.5, medial: 2.8, lateral: 2.2, patellofemoral: 1.6 },
        checks: ["Joint kinematics stable (±1.8°)", "Torque within nominal range", "No abnormal vibration detected"],
        imu: { thigh: cal(28.1), shank: cal(28.4) },
      }),
    }),
  ],
  overview: {
    kis: 92, kisMax: 100, readinessPct: 92,
    dailyActivity: { steps: 12600, stepGoal: 14000, distanceKm: 8.4, activeMinutes: 74, hourly: [2, 5, 9, 14, 11, 8, 12, 15, 10, 6, 4, 2] },
  },
  balanceTrials: balanceTrials({
    code: "chen", seed: 0.6, improve: 0.035,
    amp: { left: [3.1, 4.6], right: [2.7, 4.0] },
    hold: { left: [24.8, 25.6, 26.1, 27.0, 27.4, 28.1, 28.4], right: [27.9, 28.3, 28.6, 29.0, 29.2, 29.4, 29.6] },
  }),
  trend: trend("chen", [88, 90, 91, 92, 93, 94], [93, 94, 96, 96, 97, 98], [88, 89, 90, 91, 91, 92]),
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
      pressureSpec: null, balance: null,
      scenarioEvents: [ev("okafor-041-a", 1, 300, "Repetition hesitation")],
      fatigue: { pct: 70, label: "Moderate (demo)" },
      joint: joint({
        measurement: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion" },
        peakTorqueNm: 36, smoothnessPct: 84, symmetryPct: 90,
        contralateral: { romDeg: 112, torqueNm: 42, peakVelDegS: 18 },
        baseline: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 28, reference: { repPeriodSec: 24, phase: 2.0 }, peakFlexionDeg: 120, romDeg: 114, torqueNm: 43, smoothnessPct: 93 },
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
      pressureSpec: spec(3.6, [98, 58, 122, 150, 96, 38, 172], [118, 66, 148, 176, 112, 46, 205], 0.44, [{ side: "right", zone: "toes", fromSec: 12, toSec: 18 }]), balance: bal(null, "Not calibrated (demo)", null, "Demo scenario: repeat the left-leg trial after the shank sensor is recharged. Not a clinical assessment."),
      scenarioEvents: [ev("okafor-042-b", 1, 380, "Repetition hesitation"), ev("okafor-042-b", 2, 860, "Flexion plateau")],
      alertScenario: { severity: "action", label: "Simulated scenario: reduced range of motion escalated for the demo" },
      fatigue: null,
      joint: joint({
        measurement: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion" },
        peakTorqueNm: 38, smoothnessPct: 86, symmetryPct: 92,
        contralateral: { romDeg: 113, torqueNm: 43, peakVelDegS: 18 },
        baseline: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 28, reference: { repPeriodSec: 24, phase: 2.0 }, peakFlexionDeg: 120, romDeg: 114, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 3.0, limitMpa: 3.5, medial: 3.0, lateral: 2.4, patellofemoral: 2.0 },
        checks: ["Joint kinematics stable (±2.6°)", "Torque within nominal range", "Shank IMU battery low (18%)"],
        imu: { thigh: cal(27.7), shank: cal(28.0, [0.03, 0.02, 0.02]) },
      }),
    }),
  ],
  overview: {
    kis: 84, kisMax: 100, readinessPct: 81,
    dailyActivity: { steps: 9120, stepGoal: 12000, distanceKm: 6.1, activeMinutes: 58, hourly: [1, 3, 6, 9, 12, 10, 7, 8, 9, 5, 3, 1] },
  },
  balanceTrials: balanceTrials({
    code: "okafor", seed: 2.1, improve: 0.03,
    amp: { left: [3.4, 5.1], right: [3.9, 5.7] },
    hold: { left: [26.0, 26.4, 26.9, 27.2, 27.6, 0, 28.0], right: [22.5, 23.1, 23.8, 24.4, 25.0, 0, 25.6] },
    // Day 41 was a seated range-of-motion session: no stance trials.
    skip: [{ day: 41, side: "left" }, { day: 41, side: "right" }],
    // Shank sensor dropout during the Day 42 left trial.
    dropouts: [{ day: 42, side: "left", fromS: 8, toS: 11 }],
  }),
  trend: trend("okafor", [74, 76, 78, 79, 80, 81], [88, 90, 91, 92, 93, 94], [76, 78, 80, 81, 83, 84]),
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
      pressureSpec: spec(4.7, [110, 64, 140, 162, 102, 40, 186], [112, 66, 144, 166, 106, 44, 190], 0.52), balance: bal(87, "Stable (demo)", [86, 82, 80, 81, 84, 79], null),
      scenarioEvents: [],
      fatigue: { pct: 40, label: "Low (demo)" },
      joint: joint({
        measurement: { side: "right", movement: "knee-flexion-extension", protocol: "balance-drill-knee-tracking" },
        peakTorqueNm: 41, smoothnessPct: 90, symmetryPct: null,
        contralateral: null, baseline: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 33, reference: { repPeriodSec: 18, phase: 3.1 }, peakFlexionDeg: 120, romDeg: 117, torqueNm: 43, smoothnessPct: 93 },
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
      pressureSpec: spec(5.4, [114, 66, 146, 170, 108, 44, 192], [112, 66, 144, 166, 106, 44, 190], 0.5, [{ side: "right" }]), balance: bal(89, "Stable (demo)", [88, 84, 82, 83, 85, 81], null), dropouts: [212, 213, 214, 215],
      scenarioEvents: [ev("alvarez-042-b", 1, 650, "Repetition hesitation")],
      fatigue: { pct: 46, label: "Low (demo)" },
      joint: joint({
        measurement: { side: "right", movement: "knee-flexion-extension", protocol: "balance-drill-knee-tracking" },
        peakTorqueNm: 41, smoothnessPct: 90, symmetryPct: null,
        contralateral: null, baseline: { side: "right", movement: "knee-flexion-extension", protocol: "active-knee-flexion", recordedMissionDay: 33, reference: { repPeriodSec: 18, phase: 3.1 }, peakFlexionDeg: 120, romDeg: 117, torqueNm: 43, smoothnessPct: 93 },
        cartilage: { peakMpa: 2.6, limitMpa: 3.5, medial: 2.6, lateral: 2.1, patellofemoral: 1.5 },
        checks: ["Joint kinematics stable (±1.9°)", "Short knee data dropout near 07:00", "No abnormal vibration detected"],
        imu: { thigh: cal(28.3), shank: cal(28.6) },
      }),
    }),
  ],
  overview: {
    kis: 88, kisMax: 100, readinessPct: 90,
    dailyActivity: { steps: 11415, stepGoal: 14000, distanceKm: 7.6, activeMinutes: 81, hourly: [3, 6, 10, 13, 12, 9, 11, 14, 12, 7, 5, 3] },
  },
  balanceTrials: balanceTrials({
    code: "alvarez", seed: 4.3, improve: 0.025,
    amp: { left: [2.6, 3.9], right: [3.0, 4.5] },
    hold: { left: [28.0, 28.4, 28.8, 29.1, 29.3, 29.5, 29.7], right: [25.2, 25.9, 26.4, 26.9, 27.5, 28.0, 0] },
    // Right-leg trial not recorded on Day 42 (insole offline).
    skip: [{ day: 42, side: "right" }],
  }),
  trend: trend("alvarez", [86, 88, 90, 91, 92, 93], [90, 91, 93, 94, 95, 95], [82, 84, 85, 86, 87, 88]),
};

export const ASTRONAUTS: AstronautRecord[] = [chen, okafor, alvarez];
