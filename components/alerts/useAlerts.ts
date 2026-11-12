"use client";

import { useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import { buildAlerts, summarize } from "@/lib/alerts";
import { EXERCISES, programFor } from "@/lib/rehab";

/** The single alert list for the selected astronaut and session. Overview and AI Insights both read this. */
export function useAlerts() {
  const { astronaut, session } = useAstronaut();
  return useMemo(() => {
    const p = programFor(astronaut);
    const nextExercise = p ? `${EXERCISES[p.exercises[0]].name}, ${EXERCISES[p.exercises[0]].prescription}` : "no active plan";
    const alerts = buildAlerts(astronaut, session, { nextExercise });
    return { alerts, summary: summarize(alerts, session), astronaut, session };
  }, [astronaut, session]);
}
