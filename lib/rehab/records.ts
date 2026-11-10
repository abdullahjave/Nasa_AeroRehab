import { completionRate, isSessionComplete, sessionTotals, weeklyAdherence } from "./compute";
import { DEMO_DAY_DONE, DURATION_GAPS, EXERCISES, PROGRAMS, SEEDED_MISSES } from "./fixtures";
import type { Completions, DurationRecord, RecoveryScore, RehabProgram, ScheduledSession } from "./types";
import { MISSION } from "../demo/fixtures";
import type { AstronautRecord } from "../demo/types";

/** Demo mission date: Day 42 = 2026-11-10 (UTC). Day 1 = 2026-09-30. Calendar dates are derived from this. */
export const DEMO_DAY = MISSION.day;
const DAY1_UTC = Date.UTC(2026, 8, 30);
const DAY_MS = 86_400_000;

export const dayToDate = (day: number) => new Date(DAY1_UTC + (day - 1) * DAY_MS);
export const dayLabel = (day: number) => dayToDate(day).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const weekdayShort = (day: number) => dayToDate(day).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
/** Monday of the calendar week containing `day`, as a mission day. */
export const weekStartOf = (day: number) => day - ((dayToDate(day).getUTCDay() + 6) % 7);

export function programFor(a: AstronautRecord): RehabProgram | null {
  return PROGRAMS.find((p) => p.astronautId === a.id) ?? null;
}

const pad = (n: number) => String(n).padStart(3, "0");
const scheduleCache = new Map<string, ScheduledSession[]>();

/** All scheduled sessions of a program. Days 41/42 reuse the existing session IDs. */
export function scheduleOf(a: AstronautRecord, p: RehabProgram): ScheduledSession[] {
  const hit = scheduleCache.get(p.id);
  if (hit) return hit;
  const code = a.id.replace("astro-", "");
  const existing = new Map(a.sessions.map((s) => [s.missionDay, s.id]));
  const out: ScheduledSession[] = [];
  const end = p.startMissionDay + p.totalWeeks * 7 - 1;
  for (let day = p.startMissionDay; day <= end; day++) {
    if (p.restWeekdays.includes(dayToDate(day).getUTCDay())) continue;
    const id = existing.get(day) ?? `rehab-${code}-${pad(day)}`;
    out.push({ id, programId: p.id, missionDay: day, assignments: p.exercises.map((e) => ({ id: `${id}:${e}`, scheduledSessionId: id, exerciseId: e, required: true })) });
  }
  scheduleCache.set(p.id, out);
  return out;
}

/** Seeded completion state before local edits. */
export function seededCompletions(a: AstronautRecord, sched: ScheduledSession[]): Completions {
  const misses = SEEDED_MISSES[a.id] ?? [];
  const c: Completions = {};
  for (const s of sched) {
    if (s.missionDay > DEMO_DAY) continue;
    for (const as of s.assignments) {
      const missed = misses.some((m) => m.day === s.missionDay && (!m.exercise || m.exercise === as.exerciseId));
      const today = s.missionDay === DEMO_DAY;
      if (today ? (DEMO_DAY_DONE[a.id] ?? []).includes(as.exerciseId) : !missed) c[as.id] = true;
    }
  }
  return c;
}

/** Recorded durations for seeded completed sessions before the demo date. Today's session has no record yet. */
export function durationsOf(a: AstronautRecord, sched: ScheduledSession[]): DurationRecord[] {
  const gaps = DURATION_GAPS[a.id] ?? { missing: [], zero: [] };
  return sched
    .filter((s) => s.missionDay < DEMO_DAY)
    .map((s) => ({
      scheduledSessionId: s.id,
      minutes: gaps.missing.includes(s.missionDay) ? null : gaps.zero.includes(s.missionDay) ? 0 : 22 + (s.missionDay % 5) * 3,
    }));
}

/** Simulated weekly recovery scores, dated at the end of each program week (or the demo date for the current week). */
export function recoveryScores(p: RehabProgram): RecoveryScore[] {
  const out: RecoveryScore[] = [];
  const seed = p.progress.mobility % 7;
  for (let w = 1; w <= p.totalWeeks; w++) {
    const weekEnd = p.startMissionDay + w * 7 - 1;
    const day = Math.min(weekEnd, DEMO_DAY);
    if (p.startMissionDay + (w - 1) * 7 > DEMO_DAY) break;
    out.push({
      missionDay: day,
      programWeek: w,
      recoveryIndex: Math.min(97, 62 + w * 4 + seed),
      readiness: Math.min(98, 66 + w * 4 + (seed % 3)),
      muscleRecovery: Math.min(97, 64 + w * 4 + seed),
      jointReadiness: Math.min(96, 62 + w * 4 + (seed % 4)),
      fatigueIndex: Math.max(5, 30 - w * 3 - (seed % 3)),
    });
  }
  return out;
}

export const programWeekOf = (p: RehabProgram, day: number) => Math.floor((day - p.startMissionDay) / 7) + 1;

export type DayStatus = "completed" | "pending" | "incomplete" | "unscheduled" | "outside";

/** Everything the Rehabilitation page and the Overview rehab card show, from one set of records. */
export function rehabView(a: AstronautRecord, completions: Completions, selectedDay: number, weekStart: number) {
  const p = programFor(a);
  if (!p) return null;
  const sched = scheduleOf(a, p);
  const durations = durationsOf(a, sched);
  const byDay = new Map(sched.map((s) => [s.missionDay, s]));
  const programEnd = p.startMissionDay + p.totalWeeks * 7 - 1;
  const week = Array.from({ length: 7 }, (_, i) => weekStart + i).map((day) => {
    const s = byDay.get(day) ?? null;
    const inProgram = day >= p.startMissionDay && day <= programEnd;
    const status: DayStatus = !inProgram ? "outside" : !s ? "unscheduled" : isSessionComplete(s, completions) ? "completed" : day < DEMO_DAY ? "incomplete" : "pending";
    return { day, session: s, status, done: s ? s.assignments.filter((x) => completions[x.id]).length : 0, total: s?.assignments.length ?? 0 };
  });
  // Adherence scope: sessions of the shown week scheduled up to the demo date (future sessions are not yet due).
  const weekSessions = week.map((d) => d.session).filter((s): s is ScheduledSession => !!s && s.missionDay <= DEMO_DAY);
  const through = sched.filter((s) => s.missionDay <= selectedDay);
  const scores = recoveryScores(p);
  const scoreForDay = [...scores].reverse().find((r) => r.missionDay <= selectedDay) ?? null;
  const prog = p.progress;
  return {
    program: p,
    programEnd,
    selected: { day: selectedDay, session: byDay.get(selectedDay) ?? null, isToday: selectedDay === DEMO_DAY, programWeek: programWeekOf(p, selectedDay) },
    week,
    weeklyAdherence: weeklyAdherence(weekSessions, completions),
    completionRate: completionRate(through, completions),
    totals: sessionTotals(through, completions, durations),
    scores,
    score: scoreForDay,
    progress: { ...prog, overall: (prog.mobility + prog.strength + prog.balance + prog.endurance) / 4 },
    exercises: EXERCISES,
  };
}
