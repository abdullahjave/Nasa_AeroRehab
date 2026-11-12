import { DEMO_DAY, programFor, scheduleOf } from "./records";
import { EXERCISES } from "./fixtures";
import type { Completions, ExerciseId } from "./types";
import type { AstronautRecord } from "../demo/types";

export type TodayTask = { assignmentId: string; exerciseId: ExerciseId; name: string; prescription: string; done: boolean };
export type TodayTasks =
  | { kind: "tasks"; day: number; tasks: TodayTask[]; done: number; total: number }
  | { kind: "none"; day: number; reason: "no-program" | "no-session-today" };

/**
 * The exercises actually assigned for the demo mission day, with their current completion state. Uses the same program,
 * schedule and completion records as the Rehabilitation page; nothing is invented when there is no assignment.
 */
export function todaysTasks(a: AstronautRecord, completions: Completions, day: number = DEMO_DAY): TodayTasks {
  const p = programFor(a);
  if (!p) return { kind: "none", day, reason: "no-program" };
  const s = scheduleOf(a, p).find((x) => x.missionDay === day);
  if (!s || s.assignments.length === 0) return { kind: "none", day, reason: "no-session-today" };
  const tasks = s.assignments.map((as) => ({
    assignmentId: as.id, exerciseId: as.exerciseId, name: EXERCISES[as.exerciseId].name, prescription: EXERCISES[as.exerciseId].prescription, done: !!completions[as.id],
  }));
  return { kind: "tasks", day, tasks, done: tasks.filter((t) => t.done).length, total: tasks.length };
}

export type Milestone = { id: "daily-plan"; label: "Daily plan complete"; done: number; total: number; earned: boolean };

/**
 * "Daily plan complete" for one day's assignment ids. Progress counts DISTINCT assignment ids that are completed, so a
 * repeated id or a repeated click can never add to it, and undoing a task lowers it again. It is derived from the
 * completion records only: it never reads alert severity, measurements or readiness scores, and none of them read it.
 */
export function planMilestone(assignmentIds: readonly string[], completions: Completions): Milestone {
  const ids = new Set(assignmentIds);
  let done = 0;
  for (const id of ids) if (completions[id] === true) done++;
  return { id: "daily-plan", label: "Daily plan complete", done, total: ids.size, earned: ids.size > 0 && done === ids.size };
}

export function todaysMilestone(t: TodayTasks): Milestone | null {
  return t.kind === "tasks" ? planMilestone(t.tasks.map((x) => x.assignmentId), Object.fromEntries(t.tasks.map((x) => [x.assignmentId, x.done]))) : null;
}
