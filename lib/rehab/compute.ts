import type { Completions, DurationRecord, Ratio, ScheduledSession } from "./types";

const ratio = (num: number, den: number, reason: "no-scheduled-sessions" | "no-assignments"): Ratio =>
  den > 0 ? { kind: "value", num, den, pct: (num / den) * 100 } : { kind: "unavailable", reason };

/** Complete only when it has at least one required assignment and every required assignment is complete. */
export function isSessionComplete(s: ScheduledSession, c: Completions): boolean {
  const req = s.assignments.filter((a) => a.required);
  return req.length > 0 && req.every((a) => c[a.id] === true);
}

/** Weekly adherence = completed scheduled sessions / scheduled sessions. Unscheduled days add nothing. */
export function weeklyAdherence(sessionsInWeek: ScheduledSession[], c: Completions): Ratio {
  const done = sessionsInWeek.filter((s) => isSessionComplete(s, c)).length;
  return ratio(done, sessionsInWeek.length, "no-scheduled-sessions");
}

/** Completion rate = completed assigned items / assigned items. Each assignment id is counted once. */
export function completionRate(sessions: ScheduledSession[], c: Completions): Ratio {
  const ids = new Set<string>();
  for (const s of sessions) for (const a of s.assignments) ids.add(a.id);
  let done = 0;
  ids.forEach((id) => { if (c[id] === true) done++; });
  return ratio(done, ids.size, "no-assignments");
}

/**
 * Totals over distinct completed sessions. minutes sums recorded durations only; sessions without a recorded
 * duration are counted in missingDuration (minutes are never inferred). A recorded 0 counts as recorded.
 */
export function sessionTotals(sessions: ScheduledSession[], c: Completions, durations: DurationRecord[]) {
  const byId = new Map(durations.map((d) => [d.scheduledSessionId, d.minutes]));
  const completed = [...new Map(sessions.map((s) => [s.id, s])).values()].filter((s) => isSessionComplete(s, c));
  let minutes = 0;
  let missing = 0;
  for (const s of completed) {
    const m = byId.get(s.id);
    if (m === null || m === undefined || !Number.isFinite(m)) missing++;
    else minutes += m;
  }
  return { completedSessions: completed.length, minutes, missingDuration: missing, recordedDuration: completed.length - missing };
}

/** Idempotent setter: applying the same value twice leaves the map unchanged. */
export function setCompletion(c: Completions, assignmentId: string, done: boolean): Completions {
  if ((c[assignmentId] === true) === done) return c;
  const next = { ...c };
  if (done) next[assignmentId] = true;
  else delete next[assignmentId];
  return next;
}

/** Seeded completions with local edits on top (edits win). */
export function applyEdits(base: Completions, edits: Record<string, boolean>): Completions {
  let c = base;
  for (const [id, v] of Object.entries(edits)) c = setCompletion(c, id, v);
  return c;
}
