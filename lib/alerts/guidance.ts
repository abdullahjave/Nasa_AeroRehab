// Demo guidance shown next to a finding. It is app demo content, NOT clinically reviewed, and it never drives severity
// or the primary action. Needs a clinician's review before any real use (see the Step 12 report).
export const GUIDANCE_SOURCE = "App demo content (not clinically reviewed)";

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function demoGuidance(kind: "reduced-rom" | "scenario-event" | "data-gap" | null, baselineDay: number | null, nextExercise: string, tSec: number | null): string[] {
  if (kind === null) return [`No finding selected. Current plan item: ${nextExercise}.`];
  if (kind === "reduced-rom")
    return [
      "Repeat the knee mobility set and re-measure ROM in the next session.",
      `Compare peak flexion and ROM with the Day ${baselineDay} baseline after the set.`,
      `Current plan item: ${nextExercise}.`,
    ];
  if (kind === "data-gap")
    return ["Check the knee sensor fit and battery before the next session.", "Repeat the repetitions that fall inside the gap."];
  return [`Review the repetition around ${mmss(tSec ?? 0)} in Joint Analytics.`, "Repeat the set if the pattern appears again.", `Current plan item: ${nextExercise}.`];
}
