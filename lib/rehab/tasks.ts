import { DEMO_DAY } from "./records";
import { allEligibleSessions, CONTEXT_LABEL, type DataModeName, type ExerciseContext } from "./context";
import { EXERCISES } from "./fixtures";
import type { Completions, ExerciseId } from "./types";
import type { AstronautRecord } from "../demo/types";

export type TodayTask = { assignmentId: string; exerciseId: ExerciseId; name: string; prescription: string; done: boolean; context: ExerciseContext };
export type TodayTasks =
  | { kind: "tasks"; day: number; tasks: TodayTask[]; done: number; total: number; scope: string }
  | { kind: "none"; day: number; reason: "no-program" | "no-session-today" };

/**
 * The ELIGIBLE assignments for the demo mission day (see lib/rehab/context.ts), with their current completion state. Uses the same eligible
 * sessions and completion records as the Rehabilitation page; nothing is invented when there is no assignment. `mode` defaults to Demo.
 * In Recorded mode no plan can be assigned yet, so the result is "no-program" ("No plan assigned"), not 0% or 100%.
 */
export function todaysTasks(a: AstronautRecord, completions: Completions, day: number = DEMO_DAY, mode: DataModeName = "demo"): TodayTasks {
  const groups = allEligibleSessions(a, mode);
  if (groups.length === 0) return { kind: "none", day, reason: "no-program" };
  const tasks: TodayTask[] = [];
  for (const g of groups) {
    const s = g.sessions.find((x) => x.missionDay === day);
    for (const as of s?.assignments ?? []) {
      tasks.push({ assignmentId: as.id, exerciseId: as.exerciseId, name: EXERCISES[as.exerciseId].name, prescription: EXERCISES[as.exerciseId].prescription, done: completions[as.id] === true, context: g.context });
    }
  }
  if (tasks.length === 0) return { kind: "none", day, reason: "no-session-today" };
  const scope = [...new Set(tasks.map((t) => CONTEXT_LABEL[t.context]))].join(" + ");
  return { kind: "tasks", day, tasks, done: tasks.filter((t) => t.done).length, total: tasks.length, scope };
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
