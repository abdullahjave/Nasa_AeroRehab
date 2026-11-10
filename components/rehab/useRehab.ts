"use client";

import { useMemo } from "react";
import { applyEdits, programFor, rehabView, scheduleOf, seededCompletions } from "@/lib/rehab";
import type { AstronautRecord } from "@/lib/demo";
import { useRehabEdits } from "./useRehabEdits";

/** Seeded completions + this astronaut's local edits -> the shared rehab view (page and Overview use this). */
export function useRehab(astronaut: AstronautRecord, selectedDay: number, weekStart: number) {
  const { edits, setEdit } = useRehabEdits(astronaut.id);
  const base = useMemo(() => {
    const p = programFor(astronaut);
    return p ? seededCompletions(astronaut, scheduleOf(astronaut, p)) : {};
  }, [astronaut]);
  const completions = useMemo(() => applyEdits(base, edits), [base, edits]);
  const view = useMemo(() => rehabView(astronaut, completions, selectedDay, weekStart), [astronaut, completions, selectedDay, weekStart]);
  return { view, completions, setEdit };
}
