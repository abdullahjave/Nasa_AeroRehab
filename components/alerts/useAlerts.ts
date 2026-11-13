"use client";

import { useMemo } from "react";
import { useAstronaut } from "@/components/AstronautProvider";
import { buildAlerts, summarize } from "@/lib/alerts";
import { planItemText } from "@/lib/rehab";

/** The single alert list for the selected astronaut and session. Overview and AI Insights both read this. */
export function useAlerts() {
  const { astronaut, session, dataMode } = useAstronaut();
  return useMemo(() => {
    // Only the simulated sample plan item (Demo) or "no plan assigned"; an educational equipment selection never reaches here.
    const nextExercise = planItemText(astronaut, dataMode === "recorded" ? "recorded" : "demo");
    const alerts = buildAlerts(astronaut, session, { nextExercise });
    return { alerts, summary: summarize(alerts, session), astronaut, session };
  }, [astronaut, session, dataMode]);
}
