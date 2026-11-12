import type { AstronautRecord } from "./types";

/** One point of the Overview "Progress Trend". Every value comes from the session itself; a missing measurement is null (a gap in the line), never invented. */
export type ProgressPoint = {
  sessionId: string;
  label: string;
  missionDay: number;
  /** Knee range of motion as a percentage of that session's baseline range of motion. */
  kneeRomPctOfBaseline: number | null;
  gaitSymmetryPct: number | null;
  /** Movement smoothness (%), from the joint record. */
  movementSmoothnessPct: number | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The last `max` sessions in date order, computed from the same session records every other page reads. */
export function progressTrend(a: AstronautRecord, max = 8): ProgressPoint[] {
  return [...a.sessions].sort((x, y) => x.missionDay - y.missionDay).slice(-max).map((s) => {
    const rom = s.knee.romDeg;
    const base = s.joint.baseline?.romDeg ?? null;
    return {
      sessionId: s.id, label: `Day ${s.missionDay}`, missionDay: s.missionDay,
      kneeRomPctOfBaseline: rom !== null && base !== null && base > 0 ? r1((rom / base) * 100) : null,
      gaitSymmetryPct: s.gait?.symmetryPct ?? null,
      movementSmoothnessPct: s.joint.smoothnessPct ?? null,
    };
  });
}
