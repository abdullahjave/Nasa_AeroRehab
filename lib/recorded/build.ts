import type { AstronautId, AstronautRecord, ImuCalibration, Mission, Session } from "../demo/types";
import type { RecordedBaseline, RecordedMission, RecordedProfile, RecordedSession, RecordedSnapshot, WalkingSessionView, PressureAssessmentView, BalanceAssessmentView } from "./types";
import { BALANCE_PROTOCOL_LABEL, PRESSURE_PROTOCOL_LABEL } from "./types";
import { missionDayOf } from "./validate";
import { walkingCadenceSpm, walkingSpeedMs } from "./walking";
import { loadShares, resultantRmsMm } from "./assessments";

// Builds the same AstronautRecord / Session shapes the pages already read, but only from saved database rows.
// A recorded session has no sensor samples, so every sample-based field is empty or null. Nothing comes from lib/demo fixtures.

/** The one ROM formula (existing convention): maximum angle minus minimum angle. null unless both are present. */
export function computeRom(minDeg: number | null, maxDeg: number | null): number | null {
  if (minDeg === null || maxDeg === null || !Number.isFinite(minDeg) || !Number.isFinite(maxDeg) || minDeg > maxDeg) return null;
  return Math.round((maxDeg - minDeg) * 1000) / 1000;
}

const NO_IMU: ImuCalibration = { status: "unavailable", biasG: [0, 0, 0], scaleFactor: null, tempC: null };

const ctxKey = (s: { astronautId: string; side: string; movement: string; protocol: string }) => `${s.astronautId}|${s.side}|${s.movement}|${s.protocol}`;

export function utcLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function sessionShape(r: RecordedSession, mission: RecordedMission, baseline: RecordedSession | null, isBaseline: boolean, sameDay: boolean): Session {
  const day = missionDayOf(r.recordedAt, mission);
  const rom = computeRom(r.minAngleDeg, r.maxAngleDeg);
  const baseRom = baseline ? computeRom(baseline.minAngleDeg, baseline.maxAngleDeg) : null;
  const usableBaseline = baseline && baseline.maxAngleDeg !== null && baseRom !== null;
  return {
    id: r.id,
    astronautId: r.astronautId as AstronautId,
    missionId: "mission-artemis-ii",
    missionDay: day,
    label: `Day ${day} · ${r.activity}${sameDay ? ` · ${r.recordedAt.slice(11, 16)}` : ""}`,
    startedAt: utcLabel(r.recordedAt),
    durationSec: 0,
    sampleIntervalSec: 0,
    kneeSamples: [],
    knee: { currentAngleDeg: null, peakFlexionDeg: r.maxAngleDeg, romDeg: rom, minAngleDeg: r.minAngleDeg },
    gait: null,
    pressureSpec: null,
    balance: null,
    joint: {
      peakTorqueNm: r.torqueNm,
      smoothnessPct: null,
      symmetryPct: null,
      contralateral: null,
      measurement: { side: r.side, movement: r.movement, protocol: r.protocol },
      baseline: usableBaseline && !isBaseline
        ? {
            side: baseline.side, movement: baseline.movement, protocol: baseline.protocol,
            peakFlexionDeg: baseline.maxAngleDeg as number, romDeg: baseRom as number, torqueNm: baseline.torqueNm,
            smoothnessPct: null, recordedMissionDay: missionDayOf(baseline.recordedAt, mission), reference: null,
          }
        : null,
      cartilage: null,
      checks: [],
      imu: { thigh: NO_IMU, shank: NO_IMU },
    },
    scenarioEvents: [],
    fatigue: null,
    recorded: { source: r.source, activity: r.activity, recordedAt: r.recordedAt, torqueNm: r.torqueNm, isBaseline },
  };
}

/** Placeholder for an astronaut without saved sessions: every reading is null. It is never listed as a session. */
export function emptySession(astronautId: string, mission: RecordedMission): Session {
  const r: RecordedSession = { id: `rec-empty-${astronautId}`, astronautId, recordedAt: `${mission.startDate}T00:00:00.000Z`, activity: "No saved sessions", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", source: "manual", minAngleDeg: null, maxAngleDeg: null, torqueNm: null, updatedAt: "" };
  const s = sessionShape(r, mission, null, false, false);
  return { ...s, label: "No saved sessions", startedAt: "", recorded: { ...(s.recorded as NonNullable<Session["recorded"]>), empty: true } };
}

export function missionShape(m: RecordedMission, demoMission: Mission): Mission {
  // The "current day" stays the app's fixed demo date so the exercise plan and today's tasks use one clock.
  return { ...demoMission, id: "mission-artemis-ii", name: m.name, day: m.currentDay, totalDays: m.totalDays, crewTotal: 3, crewOnline: 0 };
}

/** Walking sessions for one astronaut, oldest first, with speed and cadence calculated once from the saved totals. */
function walkingViews(p: RecordedProfile, snap: RecordedSnapshot): WalkingSessionView[] {
  const mine = snap.walkingSessions.filter((w) => w.astronautId === p.id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  return mine.map((w) => {
    const day = missionDayOf(w.recordedAt, snap.mission);
    return { ...w, missionDay: day, label: `Day ${day} \u00b7 Walking \u00b7 ${w.recordedAt.slice(11, 16)}`, startedAt: utcLabel(w.recordedAt), speedMs: walkingSpeedMs(w.distanceM, w.durationS), cadenceSpm: walkingCadenceSpm(w.steps, w.durationS) };
  });
}

function pressureViews(p: RecordedProfile, snap: RecordedSnapshot): PressureAssessmentView[] {
  return snap.pressureAssessments.filter((x) => x.astronautId === p.id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)).map((x) => {
    const day = missionDayOf(x.recordedAt, snap.mission);
    return { ...x, missionDay: day, label: `Day ${day} \u00b7 ${PRESSURE_PROTOCOL_LABEL[x.protocol]} \u00b7 ${x.recordedAt.slice(11, 16)}`, startedAt: utcLabel(x.recordedAt), shares: loadShares(x.leftForceN, x.rightForceN), csvImport: (snap.sensorImports ?? []).find((i) => i.kind === "pressure" && i.assessmentId === x.id) ?? null };
  });
}
function balanceViews(p: RecordedProfile, snap: RecordedSnapshot): BalanceAssessmentView[] {
  return snap.balanceAssessments.filter((x) => x.astronautId === p.id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)).map((x) => {
    const day = missionDayOf(x.recordedAt, snap.mission);
    return { ...x, missionDay: day, label: `Day ${day} \u00b7 ${x.trialSide === "left" ? "Left" : "Right"} leg \u00b7 ${BALANCE_PROTOCOL_LABEL[x.protocol]} \u00b7 ${x.recordedAt.slice(11, 16)}`, startedAt: utcLabel(x.recordedAt), resultantRmsMm: resultantRmsMm(x.mlRmsMm, x.apRmsMm), csvImport: (snap.sensorImports ?? []).find((i) => i.kind === "balance" && i.assessmentId === x.id) ?? null };
  });
}

export function recordedAstronaut(p: RecordedProfile, snap: RecordedSnapshot, portrait?: string): AstronautRecord {
  const byId = new Map(snap.sessions.map((s) => [s.id, s]));
  const base = new Map(snap.baselines.map((b: RecordedBaseline) => [ctxKey(b), b.sessionId]));
  const mine = snap.sessions.filter((s) => s.astronautId === p.id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  const days = new Map<string, number>();
  mine.forEach((s) => days.set(s.recordedAt.slice(0, 10), (days.get(s.recordedAt.slice(0, 10)) ?? 0) + 1));
  const sessions = mine.map((s) => {
    const bid = base.get(ctxKey(s));
    const b = bid ? byId.get(bid) ?? null : null;
    return sessionShape(s, snap.mission, b, bid === s.id, (days.get(s.recordedAt.slice(0, 10)) ?? 0) > 1);
  });
  return {
    id: p.id as AstronautId,
    missionId: "mission-artemis-ii",
    profile: { fullName: p.fullName, displayName: p.displayName, crewCode: p.crewCode, status: p.status, role: p.role, ageYears: p.ageYears, heightCm: p.heightCm, massKg: p.massKg, rehabFocus: p.rehabFocus, affectedLimb: p.affectedLimb, initials: p.initials, portrait },
    sensors: [], // no instrumented sensors are connected in recorded mode
    sessions,
    walking: walkingViews(p, snap),
    pressure: pressureViews(p, snap),
    balance: balanceViews(p, snap),
    overview: { kis: null, kisMax: 100, readinessPct: null, dailyActivity: { steps: null, stepGoal: 0, distanceKm: null, activeMinutes: null, hourly: [] } },
    trend: [],
    balanceTrials: [],
  };
}

export function recordedAstronauts(snap: RecordedSnapshot, portraits: Record<string, string | undefined> = {}): AstronautRecord[] {
  return snap.astronauts.map((p) => recordedAstronaut(p, snap, portraits[p.id]));
}

/** ROM series across saved sessions for one astronaut, side and protocol (session-to-session trend). */
export function romTrend(a: AstronautRecord, side?: "left" | "right", protocol?: string) {
  return a.sessions
    .filter((s) => (!side || s.joint.measurement.side === side) && (!protocol || s.joint.measurement.protocol === protocol))
    .map((s) => ({ sessionId: s.id, label: s.label, missionDay: s.missionDay, recordedAt: s.recorded?.recordedAt ?? "", romDeg: s.knee.romDeg, isBaseline: !!s.recorded?.isBaseline }));
}
