// Exercise context for Rehabilitation, and the single rule for which assignments are ELIGIBLE (counted anywhere).
//
// The context is a DISPLAY choice on the Rehabilitation page. It does not change the astronaut's real mission environment or medical
// status. Equipment information (ARED, T2, CEVIS) is education, never an assignment, so it has no assignments and no completion state.
//
// Eligibility today:
//   Demo     + Ground / Post-flight Rehab -> the existing simulated sample plan (lib/rehab/fixtures.ts)
//   Demo     + Spaceflight Exercise       -> none (no simulated spaceflight plan exists)
//   Recorded + either context             -> none: the app has no workflow that saves a recorded exercise plan, and the sample plan is
//                                            demo content, so it is never presented as a recorded assignment.
// Overview tasks, the Rehabilitation counts and calendar, and Reports all ask this module, so they cannot disagree.

import { EXERCISES } from "./fixtures";
import { programFor, scheduleOf } from "./records";
import type { Assignment, ExerciseId, RehabProgram, Ratio, ScheduledSession } from "./types";
import type { AstronautRecord } from "../demo/types";

export type ExerciseContext = "spaceflight" | "ground";
export type DataModeName = "demo" | "recorded";

export const CONTEXTS: readonly ExerciseContext[] = ["spaceflight", "ground"];
export const CONTEXT_LABEL: Record<ExerciseContext, string> = { spaceflight: "Spaceflight Exercise", ground: "Ground / Post-flight Rehab" };
export const NO_PLAN = "No plan assigned";
export const NO_PLAN_CONTEXT = "No plan assigned for this context.";

/** Where eligible assignments came from. "demo-sample" is simulated; "recorded" is reserved for explicitly saved plans (none can be saved yet). */
export type PlanSource = "demo-sample" | "recorded";
export const PLAN_SOURCE_LABEL: Record<PlanSource, string> = { "demo-sample": "Sample plan (simulated)", recorded: "Recorded plan" };

export type EligiblePlan = { source: PlanSource; context: ExerciseContext; program: RehabProgram };

/** The plan whose assignments count for this astronaut, data mode and context, or null when nothing is assigned. */
export function eligiblePlan(a: AstronautRecord, mode: DataModeName, context: ExerciseContext): EligiblePlan | null {
  if (mode !== "demo" || context !== "ground") return null;
  const program = programFor(a);
  return program ? { source: "demo-sample", context, program } : null;
}

/** Scheduled sessions whose assignments are eligible in this mode and context ([] when nothing is assigned). */
export function eligibleSessions(a: AstronautRecord, mode: DataModeName, context: ExerciseContext): ScheduledSession[] {
  const p = eligiblePlan(a, mode, context);
  return p ? scheduleOf(a, p.program) : [];
}

/** Every context's eligible sessions, each tagged with its context (used by Overview, which has no context selector). */
export function allEligibleSessions(a: AstronautRecord, mode: DataModeName): { context: ExerciseContext; sessions: ScheduledSession[] }[] {
  return CONTEXTS.map((context) => ({ context, sessions: eligibleSessions(a, mode, context) })).filter((x) => x.sessions.length > 0);
}


/** completed / total as a Ratio; zero eligible assignments is "unavailable" (shown as "No plan assigned"), never 0% or 100%. */
export function eligibleRatio(assignments: readonly Assignment[], completions: Record<string, boolean>): Ratio {
  const ids = new Set(assignments.map((x) => x.id));
  let done = 0;
  ids.forEach((id) => { if (completions[id] === true) done++; });
  return ids.size > 0 ? { kind: "value", num: done, den: ids.size, pct: (done / ids.size) * 100 } : { kind: "unavailable", reason: "no-assignments" };
}

/** Reference-only sample ground activities (no prescription, no completion state). Shown when no plan is assigned in Ground / Post-flight. */
export const SAMPLE_GROUND_ACTIVITIES: ExerciseId[] = ["sit-to-stand", "resisted-mini-squat", "step-up", "calf-raise", "single-leg-balance"];
export const sampleActivity = (id: ExerciseId) => ({ id, name: EXERCISES[id].name, info: EXERCISES[id].info });

/** Plain text for "the next plan item" in guidance: only a simulated sample item in Demo, otherwise unknown. Never an equipment choice. */
export function planItemText(a: AstronautRecord, mode: DataModeName): string {
  const p = eligiblePlan(a, mode, "ground");
  if (!p) return "no plan assigned";
  const e = EXERCISES[p.program.exercises[0]];
  return `${e.name}, ${e.prescription} (sample ground rehab plan, simulated)`;
}

/**
 * Wording shown wherever completion ticks saved in Recorded mode exist but are not counted (no recorded plan is assigned).
 * Nothing is deleted or reinterpreted: the entries stay in this browser. Earlier versions counted them against the simulated sample plan.
 */
export function excludedTicksNote(count: number): string | null {
  if (count <= 0) return null;
  const n = `${count} saved completion entr${count === 1 ? "y" : "ies"}`;
  return `${n} from the simulated sample plan ${count === 1 ? "is" : "are"} kept in this browser, unchanged, but not counted because no recorded plan is assigned. Earlier versions counted ${count === 1 ? "it" : "them"} against that sample plan.`;
}
