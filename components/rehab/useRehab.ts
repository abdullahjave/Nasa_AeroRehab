"use client";

import { useMemo } from "react";
import { applyEdits, eligiblePlan, rehabView, scheduleOf, seededCompletions, type Completions, type ExerciseContext } from "@/lib/rehab";
import type { AstronautRecord } from "@/lib/demo";
import { useRehabEdits } from "./useRehabEdits";
import { useAstronaut } from "@/components/AstronautProvider";

const NONE: Completions = {};

/**
 * Eligible assignments + this astronaut's local edits -> the shared rehab view (page, Overview and Reports use this).
 * When nothing is assigned for the data mode and context (every Recorded case, and Demo Spaceflight), `view` is null and `completions` is empty,
 * so no count, percentage or milestone is produced from a plan that does not exist. Stored ticks are never read in that case, never changed.
 */
export function useRehab(astronaut: AstronautRecord, selectedDay: number, weekStart: number, context: ExerciseContext = "ground") {
  const { edits, setEdit } = useRehabEdits(astronaut.id);
  const { dataMode } = useAstronaut();
  const plan = eligiblePlan(astronaut, dataMode === "recorded" ? "recorded" : "demo", context);
  const base = useMemo(() => (plan ? seededCompletions(astronaut, scheduleOf(astronaut, plan.program)) : NONE), [astronaut, plan]);
  const completions = useMemo(() => (plan ? applyEdits(base, edits) : NONE), [plan, base, edits]);
  const view = useMemo(() => (plan ? rehabView(astronaut, completions, selectedDay, weekStart) : null), [plan, astronaut, completions, selectedDay, weekStart]);
  return { view, completions, setEdit, plan };
}
